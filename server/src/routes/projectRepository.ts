import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import axios from 'axios';
import { prisma } from '../prisma';
import { gitService } from '../services/gitService';
import { projectRepoService } from '../services/projectRepoService';
import { validateZipBuffer } from '../validator';

export const projectRepositoryRouter = Router();

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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELETE / DISCONNECT REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.delete('/:projectId/repository', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    await prisma.repository.deleteMany({ where: { projectId } });
    await prisma.project.update({
      where: { id: projectId },
      data: { gitRepositoryUrl: null, gitOwner: null, gitRepo: null },
    });
    res.json({ success: true, message: 'Repository disconnected from project.' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
  }
});

projectRepositoryRouter.get('/:projectId/repository/branches', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { repoDir } = await resolveProject(projectId);
    const branchInfo = await gitService.getBranches(repoDir);
    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: e.message });
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
        version = '1.0.0',
      } = req.body;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No ZIP file provided.' });
      }
      uploadedFilePath = file.path;

      const fileBuffer = fs.readFileSync(file.path);
      const validation = await validateZipBuffer(fileBuffer);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error || 'Invalid ZIP file.',
        });
      }

      const { project } = await resolveProject(projectId);

      const name = moduleName || validation.extractedMetadata?.name || file.originalname.replace(/\.zip$/i, '');
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetDest = destinationPath || `modules/${slug}`;

      // Extract ZIP in memory
      const zip = await JSZip.loadAsync(fileBuffer);
      const extractedFiles: Array<{ path: string; content: Buffer }> = [];

      // Detect top-level root folder prefix if ZIP wrapped everything in single directory
      const allEntries = Object.keys(zip.files);
      const firstParts = new Set<string>();
      allEntries.forEach((p) => {
        const parts = p.split('/');
        if (parts.length > 1) firstParts.add(parts[0]);
      });
      const singleRoot = firstParts.size === 1 ? Array.from(firstParts)[0] + '/' : '';

      for (const relativePath of allEntries) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;

        // Strip single root if present
        let cleanRelPath = relativePath;
        if (singleRoot && cleanRelPath.startsWith(singleRoot)) {
          cleanRelPath = cleanRelPath.substring(singleRoot.length);
        }

        // Prevent security path traversal in zip
        if (cleanRelPath.includes('..') || cleanRelPath.startsWith('/') || cleanRelPath.startsWith('\\')) {
          continue;
        }

        const buffer = await zipEntry.async('nodebuffer');
        extractedFiles.push({ path: cleanRelPath, content: buffer });
      }

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
            slug: `${slug}-${Date.now().toString().slice(-4)}`,
            description: validation.extractedMetadata?.description || `${name} software module`,
            author,
            categoryName: catName,
            version,
            sourceType: 'upload',
            repositoryType: 'moduleforge',
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
            technologies: JSON.stringify(validation.extractedMetadata?.technologies || ['Node.js']),
          },
        });
      }

      // Link to ProjectModule if not already linked
      const existingPm = await prisma.projectModule.findFirst({
        where: { projectId: project.id, moduleId: dbMod.id },
      });

      if (!existingPm) {
        const pmCount = await prisma.projectModule.count({ where: { projectId: project.id } });
        await prisma.projectModule.create({
          data: {
            projectId: project.id,
            moduleId: dbMod.id,
            moduleVersion: version,
            xPosition: 80 + (pmCount % 3) * 360,
            yPosition: 80 + Math.floor(pmCount / 3) * 280,
            repositoryType: 'moduleforge',
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
            currentCommitSha: ingestResult.commit.sha,
            lastCommitMessage: ingestResult.commit.message,
            lastCommitAuthor: ingestResult.commit.author,
            gitStatus: 'up_to_date',
            lastSyncedAt: new Date(),
          },
        });
      }

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

      res.json({
        success: true,
        message: `Successfully added ${name} module (${ingestResult.fileCount} files) to ${targetDest}`,
        commit: ingestResult.commit,
        manifest: ingestResult.manifest,
        destinationPath: targetDest,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
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
      const name = moduleName || repo.replace(/[-_]/g, ' ');
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetDest = destinationPath || `modules/${slug}`;

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
      });

      const zip = await JSZip.loadAsync(ghResponse.data);
      const extractedFiles: Array<{ path: string; content: Buffer }> = [];

      // GitHub zipball has a single root folder e.g. "owner-repo-sha/"
      const allEntries = Object.keys(zip.files);
      const firstParts = new Set<string>();
      allEntries.forEach((p) => {
        const parts = p.split('/');
        if (parts.length > 1) firstParts.add(parts[0]);
      });
      const singleRoot = firstParts.size === 1 ? Array.from(firstParts)[0] + '/' : '';

      for (const relativePath of allEntries) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;

        let cleanRelPath = relativePath;
        if (singleRoot && cleanRelPath.startsWith(singleRoot)) {
          cleanRelPath = cleanRelPath.substring(singleRoot.length);
        }

        if (cleanRelPath.includes('..') || cleanRelPath.startsWith('/') || cleanRelPath.startsWith('\\')) {
          continue;
        }

        const buffer = await zipEntry.async('nodebuffer');
        extractedFiles.push({ path: cleanRelPath, content: buffer });
      }

      const { project } = await resolveProject(projectId);

      const ingestResult = await gitService.ingestModuleFiles(
        project.id,
        project.name,
        targetDest,
        extractedFiles,
        `Add ${name} module from GitHub (${owner}/${repo})`,
        author,
        { id: slug, name, version: '1.0.0' }
      );

      // Link Module in ModuleForge database
      let dbMod = await prisma.module.findFirst({
        where: { OR: [{ slug }, { githubRepo: repo }] },
      });

      if (!dbMod) {
        dbMod = await prisma.module.create({
          data: {
            name,
            slug: `${slug}-${Date.now().toString().slice(-4)}`,
            description: `Imported from https://github.com/${owner}/${repo}`,
            author: owner,
            categoryName: 'Custom',
            version: '1.0.0',
            sourceType: 'github',
            githubUrl: `https://github.com/${owner}/${repo}`,
            githubOwner: owner,
            githubRepo: repo,
            repositoryType: 'github',
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
          },
        });
      }

      const existingPm = await prisma.projectModule.findFirst({
        where: { projectId: project.id, moduleId: dbMod.id },
      });

      if (!existingPm) {
        const pmCount = await prisma.projectModule.count({ where: { projectId: project.id } });
        await prisma.projectModule.create({
          data: {
            projectId: project.id,
            moduleId: dbMod.id,
            moduleVersion: '1.0.0',
            xPosition: 80 + (pmCount % 3) * 360,
            yPosition: 80 + Math.floor(pmCount / 3) * 280,
            repositoryType: 'github',
            githubRepository: `${owner}/${repo}`,
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
            currentCommitSha: ingestResult.commit.sha,
            lastCommitMessage: ingestResult.commit.message,
            lastCommitAuthor: ingestResult.commit.author,
            gitStatus: 'up_to_date',
            lastSyncedAt: new Date(),
          },
        });
      }

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

      res.json({
        success: true,
        message: `Successfully imported GitHub module ${owner}/${repo} to ${targetDest}`,
        commit: ingestResult.commit,
        manifest: ingestResult.manifest,
        destinationPath: targetDest,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. INGEST MARKETPLACE MODULE INTO OVERALL PROJECT REPO
// ─────────────────────────────────────────────────────────────────────────────
projectRepositoryRouter.post(
  '/:projectId/repository/modules/ingest-marketplace',
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const {
        moduleId,
        version = '1.0.0',
        destinationPath,
        author = 'Developer',
      } = req.body;

      if (!moduleId) {
        return res.status(400).json({ success: false, error: 'Module ID is required.' });
      }

      const mod = await prisma.module.findUnique({ where: { id: moduleId } });
      if (!mod) {
        return res.status(404).json({ success: false, error: 'Marketplace module not found.' });
      }

      const { project } = await resolveProject(projectId);
      const slug = mod.slug || mod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetDest = destinationPath || `modules/${slug}`;

      // Source files for marketplace module
      const files: Array<{ path: string; content: Buffer | string }> = [];

      // 1. If module has zipStoragePath or repositoryPath, copy files
      if (mod.zipStoragePath && fs.existsSync(mod.zipStoragePath)) {
        const zipBuffer = fs.readFileSync(mod.zipStoragePath);
        const zip = await JSZip.loadAsync(zipBuffer);
        for (const relPath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relPath];
          if (zipEntry.dir || relPath.includes('..')) continue;
          files.push({ path: relPath, content: await zipEntry.async('nodebuffer') });
        }
      } else if (mod.repositoryPath && fs.existsSync(mod.repositoryPath)) {
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
          version: version || mod.version || '1.0.0',
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

      // Link to ProjectModule
      const existingPm = await prisma.projectModule.findFirst({
        where: { projectId: project.id, moduleId: mod.id },
      });

      if (!existingPm) {
        const pmCount = await prisma.projectModule.count({ where: { projectId: project.id } });
        await prisma.projectModule.create({
          data: {
            projectId: project.id,
            moduleId: mod.id,
            moduleVersion: version,
            xPosition: 80 + (pmCount % 3) * 360,
            yPosition: 80 + Math.floor(pmCount / 3) * 280,
            repositoryType: 'moduleforge',
            repositoryPath: path.join(await gitService.getProjectRepoDir(project.id), targetDest),
            currentCommitSha: ingestResult.commit.sha,
            lastCommitMessage: ingestResult.commit.message,
            lastCommitAuthor: ingestResult.commit.author,
            gitStatus: 'up_to_date',
            lastSyncedAt: new Date(),
          },
        });
      }

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

      res.json({
        success: true,
        message: `Added ${mod.name} v${version} to ${targetDest}`,
        commit: ingestResult.commit,
        manifest: ingestResult.manifest,
        destinationPath: targetDest,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

export default projectRepositoryRouter;
