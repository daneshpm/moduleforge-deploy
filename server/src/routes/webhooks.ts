import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { prisma } from '../prisma';
import { validateZipBuffer } from '../validator';
import { realtimeEventManager } from '../services/realtimeEvents';

export const webhooksRouter = Router();

const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const storageDir = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');
try { fs.mkdirSync(storageDir, { recursive: true }); } catch (_) {}

// Verify GitHub Webhook Signature using GITHUB_WEBHOOK_SECRET
function verifyGitHubSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!rawBody || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSig = signatureHeader.slice(7);
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(digest, 'hex'));
  } catch (e) {
    return false;
  }
}

// Helper: Extract all changed files in this push event
function getChangedFilesFromPayload(payload: any): string[] {
  const fileSet = new Set<string>();

  if (payload.head_commit) {
    (payload.head_commit.added || []).forEach((f: string) => fileSet.add(f));
    (payload.head_commit.modified || []).forEach((f: string) => fileSet.add(f));
    (payload.head_commit.removed || []).forEach((f: string) => fileSet.add(f));
  }

  if (Array.isArray(payload.commits)) {
    for (const c of payload.commits) {
      (c.added || []).forEach((f: string) => fileSet.add(f));
      (c.modified || []).forEach((f: string) => fileSet.add(f));
      (c.removed || []).forEach((f: string) => fileSet.add(f));
    }
  }

  return Array.from(fileSet);
}

// POST /api/webhooks/github & POST /api/github/webhook - Receive GitHub Push Webhook
const handleWebhook = async (req: any, res: any) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'moduleforge_webhook_secret';

    // 1. Verify HMAC signature when provided
    if (signature) {
      const isValid = verifyGitHubSignature(req.rawBody, signature, secret);
      if (!isValid) {
        console.warn('⚠️ GitHub Webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid GitHub webhook signature' });
      }
    }

    // 2. Only process push events (or test ping events)
    if (event === 'ping') {
      return res.json({ message: 'GitHub Webhook ping received successfully' });
    }

    if (event && event !== 'push') {
      return res.json({ message: `Ignored event: ${event}` });
    }

    const payload = req.body;
    if (!payload || !payload.repository) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const owner = payload.repository.owner?.login || payload.repository.owner?.name;
    const repo = payload.repository.name;
    const repoFullName = `${owner}/${repo}`.toLowerCase();
    const afterCommitSha = payload.after || payload.head_commit?.id || 'unknown';
    const commitMessage = payload.head_commit?.message || 'Updated via GitHub push';
    const commitAuthor = payload.head_commit?.author?.name || payload.pusher?.name || 'GitHub Developer';
    const changedFiles = getChangedFilesFromPayload(payload);

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Missing owner/repo in webhook payload' });
    }

    console.log(`⚡ Received GitHub Webhook push for ${owner}/${repo} (Commit: ${afterCommitSha.slice(0, 7)} by ${commitAuthor})`);
    console.log(`📂 Changed files (${changedFiles.length}):`, changedFiles.slice(0, 5));

    // 3. Check for standalone Module records connected to this repo
    const directModules = await prisma.module.findMany({
      where: {
        sourceType: 'github',
        githubOwner: { equals: owner },
        githubRepo: { equals: repo },
      },
    });

    for (const mod of directModules) {
      const branch = mod.githubBranch || 'main';
      const candidateUrls = [
        `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`,
        `https://codeload.github.com/${owner}/${repo}/zip/HEAD`,
        `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
      ];

      let archiveBuffer: Buffer | null = null;
      for (const url of candidateUrls) {
        try {
          const zipRes = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'ModuleForge-Platform' },
            timeout: 20000,
          });
          if (zipRes.data && zipRes.data.byteLength > 100) {
            archiveBuffer = Buffer.from(zipRes.data);
            break;
          }
        } catch (e) {
          // continue
        }
      }

      if (archiveBuffer) {
        const zipValidation = await validateZipBuffer(archiveBuffer);
        if (zipValidation.valid) {
          const zipFileName = `github-${owner}-${repo}-${Date.now()}.zip`;
          const permanentPath = path.join(storageDir, zipFileName);
          fs.writeFileSync(permanentPath, archiveBuffer);

          await prisma.module.update({
            where: { id: mod.id },
            data: {
              zipStoragePath: permanentPath,
              githubCurrentCommit: afterCommitSha,
              githubLatestCommit: afterCommitSha,
              githubLastSyncedAt: new Date(),
              githubSyncStatus: 'synced',
            },
          });

          await prisma.moduleSync.create({
            data: {
              moduleId: mod.id,
              commitSha: afterCommitSha,
              commitMessage,
              author: commitAuthor,
              status: 'synced',
            },
          });
        }
      }
    }

    // 4. Find all Project instances connected at project-level (Monorepo) OR module-level
    // Case A: Project-level monorepo (e.g. company/company-erp)
    const monorepoProjects = await prisma.project.findMany({
      where: {
        OR: [
          { gitOwner: owner, gitRepo: repo },
          { gitRepositoryUrl: { contains: repo } },
        ],
      },
      include: {
        modules: {
          include: { module: true },
        },
      },
    });

    // Case B: Per-module repositories (e.g. company/crm, company/books)
    const perModuleMatches = await prisma.projectModule.findMany({
      where: {
        OR: [
          { githubRepository: { in: [repoFullName, repo.toLowerCase()] } },
          { module: { githubOwner: owner, githubRepo: repo } },
        ],
      },
      include: {
        module: true,
        project: true,
      },
    });

    const affectedProjectModules: any[] = [...perModuleMatches];

    // Identify changed modules in Monorepos
    for (const project of monorepoProjects) {
      for (const pm of project.modules) {
        const modNameLower = pm.module.name.toLowerCase();
        const modSlugLower = pm.module.slug.toLowerCase();

        // Check if changed files touch "modules/<name>/" or "modules/<slug>/"
        const isAffected = changedFiles.length === 0 || changedFiles.some((f) => {
          const fLower = f.toLowerCase();
          return (
            fLower.startsWith(`modules/${modNameLower}/`) ||
            fLower.startsWith(`modules/${modSlugLower}/`) ||
            fLower.startsWith(`${modNameLower}/`) ||
            fLower.startsWith(`${modSlugLower}/`)
          );
        });

        if (isAffected && !affectedProjectModules.some((existing) => existing.id === pm.id)) {
          affectedProjectModules.push({
            ...pm,
            project,
          });
        }
      }
    }

    console.log(`🎯 Identified ${affectedProjectModules.length} affected project modules to sync.`);

    // 5. Update Database & Broadcast to connected team members in Real-Time
    const { deploymentProvider } = require('../services/deploymentProvider');

    for (const pm of affectedProjectModules) {
      console.log(`⚡ Syncing module "${pm.module.name}" in project "${pm.project.name}"...`);

      // Set status to updating
      await prisma.projectModule.update({
        where: { id: pm.id },
        data: { deploymentStatus: 'updating' },
      });

      // Broadcast updating event
      realtimeEventManager.broadcastToProject(pm.projectId, {
        type: 'MODULE_UPDATED',
        moduleId: pm.moduleId,
        moduleName: pm.module.name,
        commitSha: afterCommitSha,
        author: commitAuthor,
        message: `Building latest version (${afterCommitSha.slice(0, 7)})`,
        status: 'updating',
      });

      try {
        const deployRes = await deploymentProvider.deploy({
          moduleName: pm.module.name,
          commitSha: afterCommitSha,
          port: pm.module.frontendPort || 5173,
        });

        if (deployRes.success) {
          // Update DB with single source of truth
          const updatedPm = await prisma.projectModule.update({
            where: { id: pm.id },
            data: {
              currentCommitSha: afterCommitSha,
              lastCommitMessage: commitMessage,
              lastCommitAuthor: commitAuthor,
              deploymentUrl: deployRes.deploymentUrl,
              deploymentStatus: 'synced',
              lastSyncedAt: new Date(),
            },
          });

          await prisma.moduleDeployment.create({
            data: {
              projectModuleId: pm.id,
              commitSha: afterCommitSha,
              commitMessage,
              author: commitAuthor,
              deploymentUrl: deployRes.deploymentUrl,
              status: 'success',
              buildLogs: deployRes.buildLogs,
            },
          });

          // Log project activity
          await prisma.projectActivity.create({
            data: {
              projectId: pm.projectId,
              moduleName: pm.module.name,
              action: 'updated',
              actorName: commitAuthor,
              description: commitMessage,
              commitSha: afterCommitSha,
              status: 'synced',
            },
          });

          // 🟢 BROADCAST REALTIME UPDATE TO ALL AUTHORIZED TEAM MEMBERS
          realtimeEventManager.broadcastToProject(pm.projectId, {
            type: 'MODULE_UPDATED',
            moduleId: pm.moduleId,
            moduleName: pm.module.name,
            commitSha: afterCommitSha,
            author: commitAuthor,
            message: commitMessage,
            status: 'synced',
            data: updatedPm,
          });

          console.log(`🟢 Successfully synced and broadcasted "${pm.module.name}" in project "${pm.project.name}"`);
        } else {
          throw new Error('Build failed');
        }
      } catch (deployErr: any) {
        console.error(`🔴 Deployment failed for module "${pm.module.name}":`, deployErr.message);

        await prisma.projectModule.update({
          where: { id: pm.id },
          data: { deploymentStatus: 'failed' },
        });

        await prisma.moduleDeployment.create({
          data: {
            projectModuleId: pm.id,
            commitSha: afterCommitSha,
            commitMessage,
            author: commitAuthor,
            status: 'failed',
            buildLogs: `[${new Date().toISOString()}] 🔴 Build failed: ${deployErr.message}`,
          },
        });

        await prisma.projectActivity.create({
          data: {
            projectId: pm.projectId,
            moduleName: pm.module.name,
            action: 'build_failed',
            actorName: commitAuthor,
            description: `Build failed for ${commitMessage}`,
            commitSha: afterCommitSha,
            status: 'failed',
          },
        });

        realtimeEventManager.broadcastToProject(pm.projectId, {
          type: 'MODULE_UPDATED',
          moduleId: pm.moduleId,
          moduleName: pm.module.name,
          commitSha: afterCommitSha,
          author: commitAuthor,
          message: `Build failed: ${commitMessage}`,
          status: 'failed',
        });
      }
    }

    res.json({
      success: true,
      directModulesCount: directModules.length,
      affectedProjectModulesCount: affectedProjectModules.length,
      commitSha: afterCommitSha,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
};

webhooksRouter.post('/github', handleWebhook);
webhooksRouter.post('/', handleWebhook);
