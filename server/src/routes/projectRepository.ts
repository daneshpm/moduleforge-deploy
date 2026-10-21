import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import axios from 'axios';
import { prisma } from '../prisma';
import { gitService, RepoPathError } from '../services/gitService';
import { loadZip, ZipLimitError, ZIP_LIMITS } from '../services/zipLimits';
import { projectRepoService } from '../services/projectRepoService';
import semver from 'semver';
import { validateZipBuffer, validateContractInZip, LEGACY_WARNING, ContractValidationResult } from '../validator';
import { contractColumns, findModuleByIdOrSlug } from '../services/moduleVersioning';
import {
  FileEntry,
  extractZipFiles,
  fingerprintFiles,
  scanDirFingerprint,
  parseFileMap,
  selectVersion,
  summarizeUpdate,
  planUpgrade,
  loadVersionFiles,
} from '../services/moduleInstall';
import {
  resolve as resolveDependencies,
  candidateFromModule,
  projectModuleRefsFromRows,
  resolveWarnings,
  parseDependsOn,
  CandidateModule,
} from '../services/dependencyResolver';

import { projectMemberParam, projectOwnerOnly, getProjectAccess } from '../middleware/access';
import { getUserId, isEnforced } from '../middleware/auth';

export const projectRepositoryRouter = Router();
projectRepositoryRouter.param('projectId', projectMemberParam);

const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const tempUploadDir = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');
try {
  fs.mkdirSync(tempUploadDir, { recursive: true });
} catch (_) {}

const upload = multer({
  dest: tempUploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/** Unsafe user paths are 400, zip bombs are 413, everything else is a 500. */
function fail(res: Response, e: any) {
  const status = e instanceof RepoPathError ? 400 : e instanceof ZipLimitError ? 413 : 500;
  res.status(status).json({ success: false, error: e?.message || 'Request failed' });
}

// Non-blocking contract/dependency warnings returned by the import flows
async function importWarnings(
  projectId: string,
  candidate: CandidateModule | null,
  contract?: ContractValidationResult
): Promise<string[]> {
  const warnings: string[] = [...(contract?.warnings || [])];
  if (contract && !contract.valid) {
    warnings.push(...contract.errors.map((e) => `module.json ${e.path}: ${e.message}`));
  }
  try {
    if (candidate) {
      const rows = await prisma.projectModule.findMany({ where: { projectId }, include: { module: true } });
      warnings.push(...resolveWarnings(resolveDependencies(projectModuleRefsFromRows(rows), candidate)));
    }
  } catch (e) {
    // warnings must never block an import
  }
  return warnings;
}

function candidateFromContract(contract?: ContractValidationResult): CandidateModule | null {
  const m = contract?.manifest;
  return m ? { id: m.id, version: m.version, dependsOn: m.dependsOn || [] } : null;
}

// Helper to resolve Project & its repo directory
async function resolveProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      repository: true,
      modules: { include: { module: true } },
    },
  });

  if (!project) {
    throw new Error('Project not found.');
  }

  const repoDir = await gitService.ensureProjectRepo(project.id, project.name, {
    description: project.description || undefined,
    gitUrl: project.repository?.url || project.gitRepositoryUrl || undefined,
    owner: project.repository?.owner || project.gitOwner || undefined,
    repo: project.repository?.name || project.gitRepo || undefined,
    defaultBranch: project.repository?.defaultBranch || 'main',
  });

  return { project, repoDir };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET REPOSITORY OVERVIEW & STATS
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.get('/:projectId/repository', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { project, repoDir } = await resolveProject(projectId);

    const status = await gitService.getStatus(repoDir);
    const manifest = await gitService.readProjectManifest(projectId);
    const history = await gitService.getHistory(repoDir, 10);
    const fileTree = gitService.getFileTree(repoDir);

    // Count all files in file tree
    function countFiles(items: any[]): number {
      let count = 0;
      for (const item of items) {
        if (item.type === 'file') count++;
        if (item.children) count += countFiles(item.children);
      }
      return count;
    }
    const totalFiles = countFiles(fileTree);

    res.json({
      success: true,
      hasRepository: Boolean(project.repository || fs.existsSync(path.join(repoDir, '.git'))),
      repository: project.repository || (project.gitRepositoryUrl ? {
        provider: 'github',
        owner: project.gitOwner || 'user',
        name: project.gitRepo || project.name,
        url: project.gitRepositoryUrl,
        defaultBranch: project.gitBranch || 'main',
      } : null),
      status,
      stats: {
        branch: status.branch,
        totalFiles,
        modulesCount: Array.isArray(manifest.modules) ? manifest.modules.length : (project.modules?.length || 0),
        latestCommit: status.latestCommit,
        isClean: status.isClean,
      },
      manifest,
      latestCommits: history.slice(0, 5),
    });
  } catch (e: any) {
    fail(res, e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CREATE OR CONNECT REPOSITORY FOR EXISTING PROJECT
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.post('/:projectId/repository', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const {
      option = 'create_new', // 'create_new' | 'connect_existing' | 'none'
      repositoryName,
      description,
      visibility = 'private',
      gitUrl,
      owner,
      repo,
      token,
    } = req.body;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { repository: true },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found.' });
    }

    const repoName = (repositoryName || project.name).trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    let repoUrl = gitUrl || '';
    let repoOwner = owner || 'user';
    let finalRepoName = repo || repoName;
    let externalId: string | null = null;
    let defaultBranch = 'main';

    const userToken = token || (req.headers['x-github-token'] as string | undefined);

    if (option === 'create_new') {
      if (!userToken) {
        return res.status(400).json({
          success: false,
          error:
            'Personal GitHub access token is required to create a repository on your GitHub account. Please provide your token.',
        });
      }

      // 1. Provision on GitHub using user's personal token
      const ghResult = await projectRepoService.createGitHubRepo({
        name: repoName,
        description: description || project.description || '',
        isPrivate: visibility === 'private',
        token: userToken,
      });

      if (!ghResult.success) {
        return res.status(400).json({ success: false, error: ghResult.error });
      }

      repoUrl = ghResult.url || `https://github.com/${ghResult.owner}/${repoName}`;
      repoOwner = ghResult.owner || 'user';
      finalRepoName = ghResult.name || repoName;
      externalId = ghResult.externalId || null;
      defaultBranch = ghResult.defaultBranch || 'main';
    } else if (option === 'connect_existing') {
      if (!gitUrl && (!owner || !repo)) {
        return res.status(400).json({
          success: false,
          error: 'GitHub repository URL or Owner/Repo name is required.',
        });
      }

      if (gitUrl && (!owner || !repo)) {
        const match = gitUrl.replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          repoOwner = match[1];
          finalRepoName = match[2];
        }
      }

      repoUrl = gitUrl || `https://github.com/${repoOwner}/${finalRepoName}`;
    }

    // 2. Initialize local repo with files
    const repoDir = await gitService.ensureProjectRepo(project.id, project.name, {
      description: description || project.description || '',
      gitUrl: repoUrl,
      owner: repoOwner,
      repo: finalRepoName,
      defaultBranch,
      token: userToken,
    });

    // 3. Upsert Repository in database
    const repository = await prisma.repository.upsert({
      where: { projectId: project.id },
      update: {
        provider: 'github',
        externalId,
        owner: repoOwner,
        name: finalRepoName,
        url: repoUrl,
        defaultBranch,
      },
      create: {
        projectId: project.id,
        provider: 'github',
        externalId,
        owner: repoOwner,
        name: finalRepoName,
        url: repoUrl,
        defaultBranch,
      },
    });

    // Update project git fields for backward compatibility
    await prisma.project.update({
      where: { id: project.id },
      data: {
        gitRepositoryUrl: repoUrl,
        gitOwner: repoOwner,
        gitRepo: finalRepoName,
        gitBranch: defaultBranch,
      },
    });

    // Log Activity
    await prisma.projectActivity.create({
      data: {
        projectId: project.id,
        action: 'repository_connected',
        description: `Project repository ${repoOwner}/${finalRepoName} initialized and connected`,
        status: 'synced',
      },
    });

    res.json({
      success: true,
      repository,
      message: 'Repository created and initialized successfully.',
    });
  } catch (e: any) {
    fail(res, e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELETE / DISCONNECT REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.delete('/:projectId/repository', projectOwnerOnly, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await prisma.repository.deleteMany({ where: { projectId } });
    await prisma.project.update({
      where: { id: projectId },
      data: { gitRepositoryUrl: null, gitOwner: null, gitRepo: null },
    });
    res.json({ success: true, message: 'Repository disconnected from project.' });
  } catch (e: any) {
    fail(res, e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROJECT FILE TREE & FILE CONTENT
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.get('/:projectId/repository/files', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { repoDir } = await resolveProject(projectId);
    const files = gitService.getFileTree(repoDir);
    res.json({ success: true, files });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.get('/:projectId/repository/file', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Query parameter path is required.' });
    }

    const { repoDir } = await resolveProject(projectId);
    const content = gitService.readFile(repoDir, filePath);
    res.json({ success: true, path: filePath, content });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.post('/:projectId/repository/file', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Path and content are required.' });
    }

    const { repoDir } = await resolveProject(projectId);
    gitService.saveFile(repoDir, filePath, content);
    const status = await gitService.getStatus(repoDir);

    res.json({ success: true, message: `Saved ${filePath}`, gitStatus: status.gitStatus });
  } catch (e: any) {
    fail(res, e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMMIT CHANGES (FROM CODE EDITOR / WORKSPACE)
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.post('/:projectId/repository/commit', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { message, author = 'Developer' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Commit message is required.' });
    }

    const { repoDir } = await resolveProject(projectId);
    const commitRecord = await gitService.commit(repoDir, message.trim(), author.trim());

    // Update project sync status & activity
    await prisma.project.update({
      where: { id: projectId },
      data: {
        currentCommitSha: commitRecord.sha,
        lastSyncedAt: new Date(),
      },
    });

    await prisma.projectActivity.create({
      data: {
        projectId,
        action: 'committed',
        actorName: author,
        description: `Committed "${commitRecord.message}" (${commitRecord.shortSha})`,
        commitSha: commitRecord.sha,
        status: 'synced',
      },
    });

    res.json({
      success: true,
      commit: commitRecord,
      message: 'Changes committed successfully to project repository.',
    });
  } catch (e: any) {
    fail(res, e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMMIT HISTORY & BRANCHES
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.get('/:projectId/repository/commits', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const limit = Number(req.query.limit) || 30;
    const { repoDir } = await resolveProject(projectId);
    const history = await gitService.getHistory(repoDir, limit);
    res.json({ success: true, history });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.get('/:projectId/repository/branches', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { repoDir } = await resolveProject(projectId);
    const branchInfo = await gitService.getBranches(repoDir);
    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.post('/:projectId/repository/branches', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { branchName } = req.body;
    if (!branchName || !branchName.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name is required.' });
    }

    const { repoDir } = await resolveProject(projectId);
    const branchInfo = await gitService.createBranch(repoDir, branchName);
    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.post('/:projectId/repository/checkout', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { branchName } = req.body;
    if (!branchName || !branchName.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name is required.' });
    }

    const { repoDir } = await resolveProject(projectId);
    const branchInfo = await gitService.switchBranch(repoDir, branchName);
    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.post('/:projectId/repository/push', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { branch, token } = req.body;
    const authToken = (req.headers['x-github-token'] as string) || token || process.env.GITHUB_TOKEN;
    const { repoDir } = await resolveProject(projectId);

    const pushRes = await gitService.push(repoDir, branch, authToken);
    res.json({ ...pushRes });
  } catch (e: any) {
    fail(res, e);
  }
});

projectRepositoryRouter.post('/:projectId/repository/pull', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { branch, token } = req.body;
    const authToken = (req.headers['x-github-token'] as string) || token || process.env.GITHUB_TOKEN;
    const { repoDir } = await resolveProject(projectId);

    const pullRes = await gitService.pull(repoDir, branch, authToken);
    res.json({ ...pullRes });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared ingestion helpers (zip upload, GitHub, marketplace and upgrades all go through these)
// ─────────────────────────────────────────────────────────────────────────────
function manifestIdFromJson(raw: unknown): string | null {
  try {
    const id = typeof raw === 'string' && raw ? JSON.parse(raw).id : null;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

/** Create or update the ProjectModule for an install/upgrade, recording version, manifest id, pin and the file baseline. */
async function recordInstall(args: {
  projectId: string;
  moduleId: string;
  version: string;
  contractId: string | null;
  pinnedRange?: string | null;
  files: FileEntry[];
  targetDest: string;
  commit: { sha: string; message: string; author: string };
  repositoryType: string;
  githubRepository?: string;
}) {
  const repoDir = await gitService.getProjectRepoDir(args.projectId);
  const fp = fingerprintFiles(args.files);
  const install = {
    moduleVersion: args.version,
    installedContractId: args.contractId,
    installedAt: new Date(),
    installedHash: fp.hash,
    installedFiles: JSON.stringify(fp.map),
  };
  const common = {
    repositoryPath: path.join(repoDir, args.targetDest),
    currentCommitSha: args.commit.sha,
    lastCommitMessage: args.commit.message,
    lastCommitAuthor: args.commit.author,
    gitStatus: 'up_to_date',
    lastSyncedAt: new Date(),
  };
  const existingPm = await prisma.projectModule.findFirst({
    where: { projectId: args.projectId, moduleId: args.moduleId },
  });
  if (existingPm) {
    return prisma.projectModule.update({
      where: { id: existingPm.id },
      data: { ...install, ...common, ...(args.pinnedRange !== undefined ? { pinnedRange: args.pinnedRange } : {}) },
    });
  }
  const pmCount = await prisma.projectModule.count({ where: { projectId: args.projectId } });
  return prisma.projectModule.create({
    data: {
      projectId: args.projectId,
      moduleId: args.moduleId,
      ...install,
      pinnedRange: args.pinnedRange ?? null,
      xPosition: 80 + (pmCount % 3) * 360,
      yPosition: 80 + Math.floor(pmCount / 3) * 280,
      repositoryType: args.repositoryType,
      ...(args.githubRepository ? { githubRepository: args.githubRepository } : {}),
      ...common,
    },
  });
}

/** Everything about one published version that the resolver / installer needs. */
function versionView(mod: any, versionRow?: any | null) {
  const src = versionRow || mod;
  return {
    ...mod,
    version: versionRow?.version || mod.version,
    dependsOn: src.dependsOn,
    moduleJson: src.moduleJson,
    contractVersion: src.contractVersion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. INGEST MODULE FROM ZIP UPLOAD INTO OVERALL PROJECT REPO
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.post(
  '/:projectId/repository/modules/ingest-zip',
  upload.single('file'),
  async (req: Request, res: Response) => {
    let uploadedFilePath: string | null = null;
    try {
      const { projectId } = req.params;
      const file = req.file;
      const {
        moduleName,
        destinationPath,
        author = 'Developer',
        version: bodyVersion = '1.0.0',
      } = req.body;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No ZIP file provided.' });
      }
      uploadedFilePath = file.path;

      const fileBuffer = fs.readFileSync(file.path);
      const validation = await validateZipBuffer(fileBuffer);
      if (!validation.valid) {
        return res.status(validation.status || 400).json({
          success: false,
          error: validation.error || 'Invalid ZIP file.',
        });
      }

      const { project } = await resolveProject(projectId);

      // A valid v1 manifest is authoritative for identity and version
      const manifest = validation.contract?.valid ? validation.contract.manifest : undefined;
      const version: string = manifest?.version || bodyVersion;
      const name = moduleName || manifest?.name || validation.extractedMetadata?.name || file.originalname.replace(/\.zip$/i, '');
      const slug = manifest?.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetDest = destinationPath || `modules/${slug}`;

      const extractedFiles = await extractZipFiles(await loadZip(fileBuffer));
      if (extractedFiles.length === 0) {
        return res.status(400).json({ success: false, error: 'ZIP file contains no extractable files.' });
      }

      // Ingest into project repo
      const ingestResult = await gitService.ingestModuleFiles(
        project.id,
        project.name,
        targetDest,
        extractedFiles,
        `Add ${name} module`,
        author,
        { id: slug, name, version }
      );

      // Create or find Module in ModuleForge database
      let dbMod = await prisma.module.findFirst({
        where: { OR: [{ slug }, { name }] },
      });

      if (!dbMod) {
        const catName = validation.extractedMetadata?.category || 'Custom';
        await prisma.category.upsert({
          where: { name: catName },
          update: {},
          create: { name: catName, slug: catName.toLowerCase().replace(/[^a-z0-9]/g, '-') },
        });

        dbMod = await prisma.module.create({
          data: {
            name,
            slug: manifest ? slug : `${slug}-${Date.now().toString().slice(-4)}`,
            description: validation.extractedMetadata?.description || `${name} software module`,
            author,
            categoryName: catName,
            version,
            sourceType: 'upload',
            repositoryType: 'moduleforge',
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
            technologies: JSON.stringify(validation.extractedMetadata?.technologies || ['Node.js']),
            moduleJson: manifest ? JSON.stringify(manifest) : null,
            ...(validation.contract ? contractColumns(validation.contract) : {}),
          },
        });
      }

      // Link to ProjectModule (records installed version, manifest id and file baseline)
      await recordInstall({
        projectId: project.id,
        moduleId: dbMod.id,
        version,
        contractId: manifest?.id || null,
        files: extractedFiles,
        targetDest,
        commit: ingestResult.commit,
        repositoryType: 'moduleforge',
      });

      // Log Activity
      await prisma.projectActivity.create({
        data: {
          projectId: project.id,
          moduleName: name,
          action: 'module_added',
          actorName: author,
          description: `Added "${name}" module to project repository at ${targetDest}`,
          commitSha: ingestResult.commit.sha,
          status: 'synced',
        },
      });

      const warnings = await importWarnings(project.id, candidateFromContract(validation.contract), validation.contract);
      res.json({
        success: true,
        warnings,
        message: `Successfully added ${name} module (${ingestResult.fileCount} files) to ${targetDest}`,
        commit: ingestResult.commit,
        manifest: ingestResult.manifest,
        destinationPath: targetDest,
        installedVersion: version,
      });
    } catch (e: any) {
      fail(res, e);
    } finally {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (_) {}
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. INGEST MODULE FROM GITHUB REPO INTO OVERALL PROJECT REPO
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.post(
  '/:projectId/repository/modules/ingest-github',
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const {
        githubUrl,
        moduleName,
        destinationPath,
        author = 'Developer',
        token,
      } = req.body;

      if (!githubUrl || !githubUrl.trim()) {
        return res.status(400).json({ success: false, error: 'GitHub repository URL is required.' });
      }

      const match = githubUrl.replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        return res.status(400).json({ success: false, error: 'Invalid GitHub URL format.' });
      }

      const [_, owner, repo] = match;

      // Download repo archive zip from GitHub API
      const authToken = token || process.env.GITHUB_TOKEN;
      const zipDownloadUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;

      const headers: Record<string, string> = {
        'User-Agent': 'ModuleForge-Platform',
        Accept: 'application/vnd.github+json',
      };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;

      const ghResponse = await axios.get(zipDownloadUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: ZIP_LIMITS.maxDownloadBytes,
        maxBodyLength: ZIP_LIMITS.maxDownloadBytes,
      });

      const zip = await loadZip(ghResponse.data);
      const ghContract = await validateContractInZip(zip);
      const manifest = ghContract.valid ? ghContract.manifest : undefined;
      const version: string = manifest?.version || '1.0.0';
      const name = moduleName || manifest?.name || repo.replace(/[-_]/g, ' ');
      const slug = manifest?.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetDest = destinationPath || `modules/${slug}`;

      // GitHub zipball has a single root folder e.g. "owner-repo-sha/"
      const extractedFiles = await extractZipFiles(zip);

      const { project } = await resolveProject(projectId);

      const ingestResult = await gitService.ingestModuleFiles(
        project.id,
        project.name,
        targetDest,
        extractedFiles,
        `Add ${name} module from GitHub (${owner}/${repo})`,
        author,
        { id: slug, name, version }
      );

      // Link Module in ModuleForge database
      let dbMod = await prisma.module.findFirst({
        where: { OR: [{ slug }, { githubRepo: repo }] },
      });

      if (!dbMod) {
        dbMod = await prisma.module.create({
          data: {
            name,
            slug: manifest ? slug : `${slug}-${Date.now().toString().slice(-4)}`,
            description: `Imported from https://github.com/${owner}/${repo}`,
            author: owner,
            categoryName: 'Custom',
            version,
            sourceType: 'github',
            githubUrl: `https://github.com/${owner}/${repo}`,
            githubOwner: owner,
            githubRepo: repo,
            repositoryType: 'github',
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
            moduleJson: manifest ? JSON.stringify(manifest) : null,
            ...contractColumns(ghContract),
          },
        });
      }

      await recordInstall({
        projectId: project.id,
        moduleId: dbMod.id,
        version,
        contractId: manifest?.id || null,
        files: extractedFiles,
        targetDest,
        commit: ingestResult.commit,
        repositoryType: 'github',
        githubRepository: `${owner}/${repo}`,
      });

      await prisma.projectActivity.create({
        data: {
          projectId: project.id,
          moduleName: name,
          action: 'github_module_imported',
          actorName: author,
          description: `Imported GitHub module "${owner}/${repo}" into ${targetDest}`,
          commitSha: ingestResult.commit.sha,
          status: 'synced',
        },
      });

      const warnings = await importWarnings(project.id, candidateFromContract(ghContract), ghContract);
      res.json({
        success: true,
        warnings,
        message: `Successfully imported GitHub module ${owner}/${repo} to ${targetDest}`,
        commit: ingestResult.commit,
        manifest: ingestResult.manifest,
        destinationPath: targetDest,
        installedVersion: version,
      });
    } catch (e: any) {
      fail(res, e);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. INGEST MARKETPLACE MODULE INTO OVERALL PROJECT REPO
//    Body: moduleId, optional `version` (exact) or `range` (semver; highest satisfying published version)
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.post(
  '/:projectId/repository/modules/ingest-marketplace',
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const {
        moduleId,
        version: requestedVersion,
        range,
        destinationPath,
        author = 'Developer',
      } = req.body;

      if (!moduleId) {
        return res.status(400).json({ success: false, error: 'Module ID is required.' });
      }

      const mod = await findModuleByIdOrSlug(moduleId);
      if (!mod) {
        return res.status(404).json({ success: false, error: 'Marketplace module not found.' });
      }

      // Re-installing over an installed module would bypass the upgrade permission check, dependency
      // resolution and local-edit conflict detection: it must go through the upgrade endpoint.
      const alreadyInstalled = await prisma.projectModule.findFirst({ where: { projectId, moduleId: mod.id } });
      if (alreadyInstalled) {
        return res.status(409).json({
          success: false,
          error: `"${mod.name}" is already installed in this project (v${alreadyInstalled.moduleVersion || mod.version}). Use POST /api/projects/${projectId}/modules/${alreadyInstalled.id}/upgrade to change its version.`,
          projectModuleId: alreadyInstalled.id,
          installedVersion: alreadyInstalled.moduleVersion || null,
          upgradeEndpoint: `/api/projects/${projectId}/modules/${alreadyInstalled.id}/upgrade`,
        });
      }

      // Resolve which published version to install
      const versionRows = await prisma.moduleVersion.findMany({ where: { moduleId: mod.id } });
      let versionRow: any = null;
      let version: string;
      if (versionRows.length > 0) {
        const sel = selectVersion(versionRows.map((v) => v.version), { version: requestedVersion, range });
        if (sel.error || !sel.version) {
          return res.status(sel.status || 404).json({ success: false, error: sel.error });
        }
        version = sel.version;
        versionRow = versionRows.find((v) => v.version === version) || null;
      } else {
        // legacy module without version history: only its current version exists
        version = mod.version;
        if (requestedVersion && requestedVersion !== version) {
          return res.status(404).json({ success: false, error: `Version ${requestedVersion} is not published` });
        }
        if (range && !(semver.validRange(range) && semver.satisfies(version, range))) {
          return res.status(404).json({ success: false, error: `No published version satisfies ${range}` });
        }
      }

      const { project } = await resolveProject(projectId);
      const slug = mod.slug || mod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetDest = destinationPath || `modules/${slug}`;

      // Source files for this exact version
      let files: Array<{ path: string; content: Buffer | string }> = (await loadVersionFiles(mod, versionRow, version)) || [];

      // Fallback: module lives in a local repository path
      if (files.length === 0 && mod.repositoryPath && fs.existsSync(mod.repositoryPath)) {
        function scanDir(dir: string, rel: string = '') {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (['.git', 'node_modules', 'dist', '.cache'].includes(ent.name)) continue;
            const full = path.join(dir, ent.name);
            const rPath = rel ? `${rel}/${ent.name}` : ent.name;
            if (ent.isDirectory()) {
              scanDir(full, rPath);
            } else {
              files.push({ path: rPath, content: fs.readFileSync(full) });
            }
          }
        }
        try {
          scanDir(mod.repositoryPath);
        } catch (_) {}
      }

      // If no local files found, generate clean standalone module template
      if (files.length === 0) {
        const pkgJson = {
          name: slug,
          version,
          description: mod.description,
          main: 'index.js',
          scripts: {
            dev: mod.frontendCommand || 'node index.js',
            start: mod.backendCommand || 'node index.js',
          },
          dependencies: {},
        };
        files.push({ path: 'package.json', content: JSON.stringify(pkgJson, null, 2) });
        files.push({
          path: 'index.js',
          content: `// ${mod.name} Module (v${version})\nconsole.log('[${mod.name}] Initialized in project overall repository');\nmodule.exports = { name: '${mod.name}', version: '${version}' };\n`,
        });
        files.push({
          path: 'README.md',
          content: `# ${mod.name} (v${version})\n\n${mod.description}\n\nCategory: **${mod.categoryName}**\nAuthor: **${mod.author}**\n`,
        });
      }

      const commitMsg = `Add ${mod.name} v${version}`;

      const ingestResult = await gitService.ingestModuleFiles(
        project.id,
        project.name,
        targetDest,
        files,
        commitMsg,
        author,
        { id: slug, name: mod.name, version }
      );

      // Increment download counter
      await prisma.module.update({
        where: { id: mod.id },
        data: { downloads: { increment: 1 } },
      });

      const view = versionView(mod, versionRow);
      await recordInstall({
        projectId: project.id,
        moduleId: mod.id,
        version,
        contractId: manifestIdFromJson(view.moduleJson),
        pinnedRange: range || null,
        files,
        targetDest,
        commit: ingestResult.commit,
        repositoryType: 'moduleforge',
      });

      // Log Activity
      await prisma.projectActivity.create({
        data: {
          projectId: project.id,
          moduleName: mod.name,
          action: 'marketplace_module_added',
          actorName: author,
          description: `Added "${mod.name}" (v${version}) from Marketplace to ${targetDest}`,
          commitSha: ingestResult.commit.sha,
          status: 'synced',
        },
      });

      const warnings = view.contractVersion ? [] : [LEGACY_WARNING];
      warnings.push(...(await importWarnings(project.id, candidateFromModule(view, version))));
      res.json({
        success: true,
        warnings,
        message: `Added ${mod.name} v${version} to ${targetDest}`,
        commit: ingestResult.commit,
        manifest: ingestResult.manifest,
        destinationPath: targetDest,
        installedVersion: version,
        pinnedRange: range || null,
      });
    } catch (e: any) {
      fail(res, e);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. UPDATES + UPGRADE FLOW
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.get('/:projectId/updates', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const repoDir = await gitService.getProjectRepoDir(projectId);
    const rows = await prisma.projectModule.findMany({
      where: { projectId },
      include: { module: { include: { versions: true } } },
    });
    const updates = rows.map((pm: any) => {
      const published: any[] = pm.module.versions || [];
      const versions = published.map((v) => v.version);
      if (!versions.includes(pm.module.version)) versions.push(pm.module.version);
      const sum = summarizeUpdate(pm.moduleVersion, versions, pm.pinnedRange);
      const between = published
        .filter((v) => semver.valid(v.version) && semver.valid(pm.moduleVersion) && semver.gt(v.version, pm.moduleVersion))
        .sort((a, b) => semver.compare(a.version, b.version));
      const latestRow = published.find((v) => v.version === sum.latest);
      return {
        projectModuleId: pm.id,
        moduleId: pm.moduleId,
        slug: pm.module.slug,
        name: pm.module.name,
        contractId: pm.installedContractId ?? null,
        path: pm.repositoryPath ? path.relative(repoDir, pm.repositoryPath).split(path.sep).join('/') : null,
        ...sum,
        changelog: latestRow?.changelog ?? null,
        changelogs: between.filter((v) => v.changelog).map((v) => ({ version: v.version, changelog: v.changelog })),
      };
    });
    res.json({ success: true, projectId, updates });
  } catch (e: any) {
    fail(res, e);
  }
});

/** Upgrading rewrites project files: project owner, team owner/admin or an accepted project admin/owner only. */
async function canUpgradeProject(req: Request, projectId: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const userId = getUserId(req);
  if (!userId) return isEnforced() ? { ok: false, status: 401, error: 'Authentication required' } : { ok: true };
  const access = await getProjectAccess(userId, projectId);
  if (!access.exists || !access.isMember) return { ok: false, status: 404, error: 'Project not found' };
  if (access.isOwner) return { ok: true };
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true } });
  const projectAdmin = await prisma.projectMember.findFirst({
    where: { projectId, userId, status: 'accepted', role: { in: ['owner', 'admin'] } },
  });
  if (projectAdmin) return { ok: true };
  if (project?.teamId) {
    const tm = await prisma.teamMember.findFirst({ where: { teamId: project.teamId, userId, role: { in: ['owner', 'admin'] } } });
    if (tm) return { ok: true };
  }
  return { ok: false, status: 403, error: 'Only a project owner or admin can upgrade modules' };
}

projectRepositoryRouter.post('/:projectId/modules/:pmId/upgrade', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { toVersion, dryRun = false, force = false } = req.body || {};

    const rights = await canUpgradeProject(req, projectId);
    if (!rights.ok) return res.status(rights.status || 403).json({ success: false, error: rights.error });

    const pm: any = await prisma.projectModule.findFirst({
      where: { id: pmId, projectId },
      include: { module: { include: { versions: true } } },
    });
    if (!pm) return res.status(404).json({ success: false, error: 'Project module not found' });
    const mod = pm.module;

    const published: any[] = mod.versions || [];
    const versions = published.map((v) => v.version);
    let target: string | null;
    if (toVersion) {
      if (!versions.includes(toVersion)) {
        return res.status(404).json({ success: false, error: `Version ${toVersion} is not published` });
      }
      target = toVersion;
    } else {
      target = summarizeUpdate(pm.moduleVersion, versions, pm.pinnedRange).latestSatisfyingPinnedRange;
    }
    if (!target || target === pm.moduleVersion) {
      return res.json({ success: true, upToDate: true, dryRun: !!dryRun, from: pm.moduleVersion, to: pm.moduleVersion, message: 'Already up to date' });
    }
    const targetRow = published.find((v) => v.version === target);
    const breaking = semver.valid(target) && semver.valid(pm.moduleVersion) ? semver.major(target) > semver.major(pm.moduleVersion) : false;

    // 1. Dependency resolution against the rest of the project
    const rows: any[] = await prisma.projectModule.findMany({ where: { projectId }, include: { module: { include: { versions: true } } } });
    const others = rows
      .filter((r) => r.id !== pm.id)
      .map((r) => {
        // use the dependsOn of the version actually installed, not the module's latest
        const installedRow = (r.module.versions || []).find((v: any) => v.version === r.moduleVersion);
        const rowView = versionView(r.module, installedRow);
        return {
          id: r.module.slug,
          aliases: [r.module.id, ...(manifestIdFromJson(rowView.moduleJson) ? [manifestIdFromJson(rowView.moduleJson) as string] : [])],
          version: r.moduleVersion || r.module.version,
          dependsOn: parseDependsOn(rowView.dependsOn),
        };
      });
    const view = versionView(mod, targetRow);
    const candidate = candidateFromModule(view, target);
    const allDeps = candidate.dependsOn || [];
    const optionalIds = new Set(parseDependsOn(view.dependsOn).filter((d: any) => d.optional).map((d) => d.id));
    candidate.dependsOn = allDeps.filter((d) => !optionalIds.has(d.id));
    const resolved = resolveDependencies(others, candidate);
    const depWarnings = [
      ...allDeps
        .filter((d) => optionalIds.has(d.id) && !others.some((o) => [o.id, ...(o.aliases || [])].includes(d.id)))
        .map((d) => `Optional dependency ${d.id} ${d.versionRange} is not installed`),
    ];
    if (resolved.missing.length || resolved.conflicts.length) {
      return res.status(409).json({
        success: false,
        error: 'Upgrade blocked by dependencies',
        blocked: true,
        from: pm.moduleVersion,
        to: target,
        missing: resolved.missing,
        conflicts: resolved.conflicts,
        details: resolveWarnings(resolved),
      });
    }

    // 2. New files + local-edit detection
    const newFiles = await loadVersionFiles(mod, targetRow, target);
    if (!newFiles || newFiles.length === 0) {
      return res.status(422).json({ success: false, error: `No archive is stored for ${mod.slug}@${target}; cannot upgrade` });
    }
    const { project, repoDir } = await resolveProject(projectId);
    const destAbs = pm.repositoryPath ? path.resolve(pm.repositoryPath) : '';
    const destRel = destAbs ? path.relative(repoDir, destAbs).split(path.sep).join('/') : '';
    if (!destRel || destRel.startsWith('..') || path.isAbsolute(destRel)) {
      return res.status(422).json({ success: false, error: 'Module directory is not inside the project repository; cannot upgrade' });
    }
    const next = fingerprintFiles(newFiles);
    const baseline = parseFileMap(pm.installedFiles);
    const local = scanDirFingerprint(destAbs);
    const plan = planUpgrade(baseline, local, next.map);

    const response: any = {
      success: true,
      dryRun: !!dryRun,
      moduleId: mod.id,
      projectModuleId: pm.id,
      name: mod.name,
      from: pm.moduleVersion,
      to: target,
      breaking,
      destinationPath: destRel,
      changelog: targetRow?.changelog ?? null,
      files: {
        added: plan.added,
        changed: plan.changed,
        removed: plan.removed,
        preserved: plan.preserved,
        unchangedCount: plan.unchanged.length,
      },
      conflicts: plan.conflicts,
      warnings: depWarnings,
      forced: !!force && plan.conflicts.length > 0,
    };

    if (plan.conflicts.length > 0 && !force) {
      return res.status(409).json({ ...response, success: false, error: 'Local changes would be overwritten; review the conflicts or retry with force: true', blocked: true, wouldApply: false });
    }
    if (dryRun) {
      return res.json({ ...response, wouldApply: true });
    }

    // 3. Apply: remove files dropped by the new version, then reuse the normal ingestion path
    const keep = new Set(plan.preserved);
    for (const rel of plan.removed) {
      const abs = path.resolve(destAbs, rel);
      if (abs.startsWith(destAbs + path.sep) && fs.existsSync(abs)) fs.rmSync(abs, { force: true });
    }
    const writeFiles = newFiles.filter((f) => !keep.has(f.path));
    let actor = (req.body && req.body.author) as string | undefined;
    const uid = getUserId(req);
    if (!actor && uid) {
      const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, email: true } } as any).catch(() => null);
      actor = (u as any)?.name || (u as any)?.email;
    }
    actor = actor || 'Developer';

    const message = `Upgrade ${mod.name} ${pm.moduleVersion} -> ${target}`;
    const ingestResult = await gitService.ingestModuleFiles(
      project.id,
      project.name,
      destRel,
      writeFiles,
      message,
      actor,
      { id: mod.slug, name: mod.name, version: target }
    );

    const updatedPm = await recordInstall({
      projectId: project.id,
      moduleId: mod.id,
      version: target,
      contractId: manifestIdFromJson(view.moduleJson),
      files: newFiles,
      targetDest: destRel,
      commit: ingestResult.commit,
      repositoryType: pm.repositoryType || 'moduleforge',
    });
    await prisma.moduleCommit.create({
      data: {
        moduleId: mod.id,
        projectModuleId: pm.id,
        commitSha: ingestResult.commit.sha,
        message,
        author: actor,
        branch: ingestResult.commit.branch || 'main',
        changedFiles: JSON.stringify([...plan.added, ...plan.changed, ...plan.removed]),
      },
    });
    await prisma.projectActivity.create({
      data: {
        projectId: project.id,
        moduleName: mod.name,
        action: 'module_upgraded',
        actorName: actor,
        description: `Upgraded "${mod.name}" from v${pm.moduleVersion} to v${target}${breaking ? ' (breaking)' : ''}`,
        commitSha: ingestResult.commit.sha,
        status: 'synced',
      },
    });

    res.json({ ...response, applied: true, commit: ingestResult.commit, projectModule: updatedPm });
  } catch (e: any) {
    fail(res, e);
  }
});

export default projectRepositoryRouter;
