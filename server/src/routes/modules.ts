import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import axios from 'axios';
import { prisma } from '../prisma';
import { validateZipBuffer } from '../validator';
import { gitService } from '../services/gitService';
import {
  registerWebhook,
  deleteWebhook,
  getWebhookStatus,
  getWebhookUrl,
} from '../services/githubWebhookService';

export const modulesRouter = Router();

// On Vercel the filesystem outside /tmp is read-only — use /tmp in production
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const storageDir = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads');
try { fs.mkdirSync(storageDir, { recursive: true }); } catch (_) {}

const upload = multer({
  dest: storageDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('zip') || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  },
});

// Helper to format module object for API output
function formatModuleOutput(mod: any) {
  let parsedTech: string[] = [];
  if (mod.technologies) {
    try {
      parsedTech = JSON.parse(mod.technologies);
    } catch (e) {
      if (typeof mod.technologies === 'string') {
        parsedTech = mod.technologies.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }
  return {
    ...mod,
    technologies: parsedTech,
  };
}

// GET /api/modules - Browse / Search / Filter / Sort
modulesRouter.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'popular' } = req.query as {
      category?: string;
      search?: string;
      sort?: string;
    };

    const where: any = { isPublished: true };

    if (category && category !== 'All') {
      where.categoryName = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { author: { contains: q } },
        { slug: { contains: q } },
      ];
    }

    let orderBy: any = { downloads: 'desc' };
    if (sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (sort === 'name') {
      orderBy = { name: 'asc' };
    } else if (sort === 'downloads' || sort === 'popular') {
      orderBy = { downloads: 'desc' };
    }

    const modules = await prisma.module.findMany({
      where,
      orderBy,
      include: {
        category: true,
      },
    });

    res.json(modules.map(formatModuleOutput));
  } catch (error: any) {
    console.error('Error fetching modules (using fallback):', error.message);
    res.json([]);
  }
});

// GET /api/modules/:idOrSlug - Details
modulesRouter.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    const module = await prisma.module.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        category: true,
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(formatModuleOutput(module));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/modules/upload - Upload & Validate ZIP file (Does NOT require module.json)
modulesRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ valid: false, error: 'No ZIP file uploaded' });
    }

    const fileBuffer = fs.readFileSync(file.path);
    const zipValidation = await validateZipBuffer(fileBuffer);

    if (!zipValidation.valid) {
      // Unlink bad file
      fs.unlinkSync(file.path);
      return res.status(400).json({
        valid: false,
        error: zipValidation.error || 'Invalid or corrupted ZIP file.',
      });
    }

    // Move file to permanent storage directory
    const permanentFileName = `upload-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const permanentPath = path.join(storageDir, permanentFileName);
    fs.renameSync(file.path, permanentPath);

    res.json({
      valid: true,
      message: 'ZIP file is valid',
      storagePath: permanentPath,
      fileInfo: {
        filename: file.originalname,
        sizeBytes: file.size,
        fileCount: zipValidation.fileCount,
      },
      extractedMetadata: zipValidation.extractedMetadata,
    });
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ valid: false, error: error.message || 'Invalid or corrupted ZIP file.' });
  }
});

// POST /api/modules/github - GitHub Import & Retrieve Repo Archive
modulesRouter.post('/github', async (req, res) => {
  try {
    let { repoUrl } = req.body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({ valid: false, error: 'GitHub repository URL is required' });
    }

    let urlStr = repoUrl.trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = `https://${urlStr}`;
    }

    // Match github.com/owner/repo with flexible regex supporting /tree/branch or extra paths
    const match = urlStr.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/i);
    if (!match) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid GitHub repository URL format. Use format: https://github.com/user/repository',
      });
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/i, '');

    // 1. Try fetching repository metadata from GitHub API (graceful fallback if rate-limited)
    let repoInfo: any = null;
    let defaultBranch = 'main';

    try {
      const apiRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'User-Agent': 'ModuleForge-Platform' },
        timeout: 8000,
      });
      repoInfo = apiRes.data;
      if (repoInfo.default_branch) {
        defaultBranch = repoInfo.default_branch;
      }
    } catch (e: any) {
      console.warn(`GitHub API metadata call failed for ${owner}/${repo}:`, e.message);
      // Fallback: Proceed to direct archive download if API rate limited or offline
    }

    // 2. Try downloading repository ZIP archive from candidate URLs
    const candidateUrls = [
      `https://codeload.github.com/${owner}/${repo}/zip/HEAD`,
      `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${defaultBranch}`,
      `https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`,
      `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
      `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`,
    ];

    let archiveBuffer: Buffer | null = null;
    let downloadErr: string | null = null;

    for (const url of candidateUrls) {
      try {
        const zipRes = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: { 'User-Agent': 'ModuleForge-Platform' },
          timeout: 20000,
          maxRedirects: 5,
        });
        if (zipRes.data && zipRes.data.byteLength > 100) {
          archiveBuffer = Buffer.from(zipRes.data);
          break;
        }
      } catch (e: any) {
        downloadErr = e.message;
      }
    }

    if (!archiveBuffer) {
      return res.status(404).json({
        valid: false,
        error: `GitHub repository "${owner}/${repo}" could not be reached or downloaded. Ensure repository is public. Error: ${downloadErr || 'Download failed'}`,
      });
    }

    // 3. Validate downloaded archive using JSZip
    const zipValidation = await validateZipBuffer(archiveBuffer);
    if (!zipValidation.valid) {
      return res.status(400).json({
        valid: false,
        error: zipValidation.error || 'Invalid or corrupted ZIP file downloaded from GitHub repository.',
      });
    }

    // 4. Save archive locally for storage
    const zipFileName = `github-${owner}-${repo}-${Date.now()}.zip`;
    const permanentPath = path.join(storageDir, zipFileName);
    fs.writeFileSync(permanentPath, archiveBuffer);

    res.json({
      valid: true,
      message: 'Repository found & downloaded',
      storagePath: permanentPath,
      repoInfo: {
        name: repoInfo?.name || repo,
        owner: repoInfo?.owner?.login || owner,
        repo: repo,
        defaultBranch,
        description: repoInfo?.description || '',
        htmlUrl: repoInfo?.html_url || `https://github.com/${owner}/${repo}`,
        stars: repoInfo?.stargazers_count || 0,
      },
      extractedMetadata: zipValidation.extractedMetadata,
    });
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message || 'Failed to import GitHub repository' });
  }
});

// POST /api/modules - Create & Publish Module with User Form Metadata
modulesRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      author,
      version = '1.0.0',
      technologies = [],
      sourceType = 'upload',
      storagePath,
      githubUrl,
      githubOwner,
      githubRepo,
      githubBranch = 'main',
      frontendCommand = 'npm run dev',
      backendCommand = '',
      frontendPort = 5173,
      backendPort = 5000,
      frontendUrl = 'http://localhost:5173',
      backendUrl = 'http://localhost:5000',
      workingDir = '.',
      envVars = [],
      deployedUrl,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Module name is required' });
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Module description is required' });
    }

    let cleanDeployedUrl: string | null = null;
    if (deployedUrl && typeof deployedUrl === 'string' && deployedUrl.trim()) {
      const trimmed = deployedUrl.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return res.status(400).json({ error: 'Deployed link must be a valid URL starting with http:// or https://' });
      }
      cleanDeployedUrl = trimmed;
    }

    const categoryName = category || 'Other';
    const authorName = author || 'Developer';

    // Generate slug from module name
    let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) slug = `module-${Date.now()}`;

    // Ensure category exists in DB
    await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName, slug: categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-') },
    });

    const technologiesJson = JSON.stringify(Array.isArray(technologies) ? technologies : []);
    const envVarsJson = JSON.stringify(Array.isArray(envVars) ? envVars : (typeof envVars === 'string' ? envVars.split(',').map((s: string) => s.trim()).filter(Boolean) : []));

    let savedModule: any = null;
    const initialCommitSha = sourceType === 'github' ? `${Date.now().toString(16).slice(-7)}` : null;
    const existing = await prisma.module.findUnique({ where: { slug } });
    const repoType = sourceType === 'github' ? 'github' : (sourceType === 'moduleforge' ? 'moduleforge' : 'upload');

    const moduleData = {
      name: name.trim(),
      description: description.trim(),
      author: authorName,
      categoryName,
      version: version || '1.0.0',
      technologies: technologiesJson,
      sourceType,
      repositoryType: repoType,
      repositoryUrl: sourceType === 'moduleforge' ? `moduleforge/${slug}` : (sourceType === 'github' ? githubUrl : null),
      defaultBranch: 'main',
      githubUrl,
      githubOwner,
      githubRepo,
      githubBranch,
      githubCurrentCommit: initialCommitSha,
      githubLatestCommit: initialCommitSha,
      githubLastSyncedAt: sourceType === 'github' ? new Date() : null,
      githubSyncStatus: sourceType === 'github' ? 'synced' : 'not_connected',
      frontendCommand: frontendCommand || 'npm run dev',
      backendCommand: backendCommand || '',
      frontendPort: frontendPort ? Number(frontendPort) : 5173,
      backendPort: backendPort ? Number(backendPort) : 5000,
      frontendUrl: frontendUrl || 'http://localhost:5173',
      backendUrl: backendUrl || 'http://localhost:5000',
      workingDir: workingDir || '.',
      envVars: envVarsJson,
      zipStoragePath: storagePath || null,
      deployedUrl: cleanDeployedUrl,
      isPublished: true,
    };

    if (existing) {
      const finalSlug = `${slug}-${Date.now().toString().slice(-4)}`;
      savedModule = await prisma.module.create({
        data: {
          ...moduleData,
          slug: finalSlug,
          repositoryUrl: sourceType === 'moduleforge' ? `moduleforge/${finalSlug}` : moduleData.repositoryUrl,
          versions: {
            create: {
              version: version || '1.0.0',
              zipStoragePath: storagePath || null,
            },
          },
        },
        include: { category: true },
      });
    } else {
      savedModule = await prisma.module.create({
        data: {
          ...moduleData,
          slug,
          versions: {
            create: {
              version: version || '1.0.0',
              zipStoragePath: storagePath || null,
            },
          },
        },
        include: { category: true },
      });
    }

    // If moduleforge repository, ensure git repo initialized on disk
    if (sourceType === 'moduleforge' && savedModule) {
      const repoDir = await gitService.ensureRepo(savedModule.id, savedModule.name);
      const status = await gitService.getStatus(repoDir);
      if (status.latestCommit?.sha) {
        await prisma.module.update({
          where: { id: savedModule.id },
          data: {
            repositoryPath: repoDir,
            githubCurrentCommit: status.latestCommit.sha,
            githubLatestCommit: status.latestCommit.sha,
          },
        });
      }
    }

    if (sourceType === 'github' && savedModule && initialCommitSha) {
      await prisma.moduleSync.create({
        data: {
          moduleId: savedModule.id,
          commitSha: initialCommitSha,
          commitMessage: `Imported module "${name}" from GitHub repository`,
          author: authorName,
          status: 'synced',
        },
      });
    }

    res.status(201).json({
      success: true,
      module: formatModuleOutput(savedModule),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/modules/:id - Update Module (including Deployed URL)
modulesRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      author,
      version,
      technologies,
      deployedUrl,
      frontendCommand,
      backendCommand,
      frontendPort,
      backendPort,
      frontendUrl,
      backendUrl,
      workingDir,
      envVars,
    } = req.body;

    const existing = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const updateData: any = {};

    if (name !== undefined && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (description !== undefined && typeof description === 'string' && description.trim()) {
      updateData.description = description.trim();
    }
    if (author !== undefined && typeof author === 'string') {
      updateData.author = author.trim();
    }
    if (version !== undefined && typeof version === 'string') {
      updateData.version = version.trim();
    }
    if (category !== undefined && typeof category === 'string' && category.trim()) {
      updateData.categoryName = category.trim();
      await prisma.category.upsert({
        where: { name: updateData.categoryName },
        update: {},
        create: { name: updateData.categoryName, slug: updateData.categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-') },
      });
    }
    if (technologies !== undefined) {
      updateData.technologies = JSON.stringify(Array.isArray(technologies) ? technologies : []);
    }
    if (envVars !== undefined) {
      updateData.envVars = JSON.stringify(Array.isArray(envVars) ? envVars : (typeof envVars === 'string' ? envVars.split(',').map((s: string) => s.trim()).filter(Boolean) : []));
    }

    if (deployedUrl !== undefined) {
      if (deployedUrl === null || deployedUrl === '') {
        updateData.deployedUrl = null;
      } else if (typeof deployedUrl === 'string') {
        const trimmed = deployedUrl.trim();
        if (trimmed === '') {
          updateData.deployedUrl = null;
        } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          return res.status(400).json({ error: 'Deployed link must be a valid URL starting with http:// or https://' });
        } else {
          updateData.deployedUrl = trimmed;
        }
      }
    }

    if (frontendCommand !== undefined) updateData.frontendCommand = frontendCommand;
    if (backendCommand !== undefined) updateData.backendCommand = backendCommand;
    if (frontendPort !== undefined) updateData.frontendPort = Number(frontendPort) || 5173;
    if (backendPort !== undefined) updateData.backendPort = Number(backendPort) || 5000;
    if (frontendUrl !== undefined) updateData.frontendUrl = frontendUrl;
    if (backendUrl !== undefined) updateData.backendUrl = backendUrl;
    if (workingDir !== undefined) updateData.workingDir = workingDir;

    const updated = await prisma.module.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true },
    });

    res.json({
      success: true,
      module: formatModuleOutput(updated),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/modules/:id - Patch alias
modulesRouter.patch('/:id', async (req, res) => {
  // Delegate to PUT handler logic
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      author,
      version,
      technologies,
      deployedUrl,
      frontendCommand,
      backendCommand,
      frontendPort,
      backendPort,
      frontendUrl,
      backendUrl,
      workingDir,
      envVars,
    } = req.body;

    const existing = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const updateData: any = {};

    if (name !== undefined && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (description !== undefined && typeof description === 'string' && description.trim()) {
      updateData.description = description.trim();
    }
    if (author !== undefined && typeof author === 'string') {
      updateData.author = author.trim();
    }
    if (version !== undefined && typeof version === 'string') {
      updateData.version = version.trim();
    }
    if (category !== undefined && typeof category === 'string' && category.trim()) {
      updateData.categoryName = category.trim();
      await prisma.category.upsert({
        where: { name: updateData.categoryName },
        update: {},
        create: { name: updateData.categoryName, slug: updateData.categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-') },
      });
    }
    if (technologies !== undefined) {
      updateData.technologies = JSON.stringify(Array.isArray(technologies) ? technologies : []);
    }
    if (envVars !== undefined) {
      updateData.envVars = JSON.stringify(Array.isArray(envVars) ? envVars : (typeof envVars === 'string' ? envVars.split(',').map((s: string) => s.trim()).filter(Boolean) : []));
    }

    if (deployedUrl !== undefined) {
      if (deployedUrl === null || deployedUrl === '') {
        updateData.deployedUrl = null;
      } else if (typeof deployedUrl === 'string') {
        const trimmed = deployedUrl.trim();
        if (trimmed === '') {
          updateData.deployedUrl = null;
        } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          return res.status(400).json({ error: 'Deployed link must be a valid URL starting with http:// or https://' });
        } else {
          updateData.deployedUrl = trimmed;
        }
      }
    }

    if (frontendCommand !== undefined) updateData.frontendCommand = frontendCommand;
    if (backendCommand !== undefined) updateData.backendCommand = backendCommand;
    if (frontendPort !== undefined) updateData.frontendPort = Number(frontendPort) || 5173;
    if (backendPort !== undefined) updateData.backendPort = Number(backendPort) || 5000;
    if (frontendUrl !== undefined) updateData.frontendUrl = frontendUrl;
    if (backendUrl !== undefined) updateData.backendUrl = backendUrl;
    if (workingDir !== undefined) updateData.workingDir = workingDir;

    const updated = await prisma.module.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true },
    });

    res.json({
      success: true,
      module: formatModuleOutput(updated),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/modules/:id/download - Download single module ZIP archive
modulesRouter.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Increment download count
    await prisma.module.update({
      where: { id: module.id },
      data: { downloads: { increment: 1 } },
    });

    if (module.zipStoragePath && fs.existsSync(module.zipStoragePath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${module.slug}-v${module.version}.zip"`);
      return fs.createReadStream(module.zipStoragePath).pipe(res);
    }

    // Fallback if github module without local zip cache
    if (module.sourceType === 'github' && module.githubOwner && module.githubRepo) {
      const zipUrl = `https://codeload.github.com/${module.githubOwner}/${module.githubRepo}/zip/refs/heads/${module.githubBranch || 'main'}`;
      const zipRes = await axios.get(zipUrl, { responseType: 'stream' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${module.slug}-v${module.version}.zip"`);
      return zipRes.data.pipe(res);
    }

    return res.status(404).json({ error: 'Module package ZIP file not found on server' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/modules/:id - Delete module folder & database record
modulesRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // 1. Delete associated local ZIP package file if it exists
    if (module.zipStoragePath && fs.existsSync(module.zipStoragePath)) {
      try {
        fs.unlinkSync(module.zipStoragePath);
      } catch (e) {
        console.warn('Failed to delete module storage file:', e);
      }
    }

    // 2. Delete module versions & project module associations first
    await prisma.moduleVersion.deleteMany({ where: { moduleId: module.id } });
    await prisma.projectModule.deleteMany({ where: { moduleId: module.id } });

    // 3. Delete module record from database
    await prisma.module.delete({
      where: { id: module.id },
    });

    res.json({ success: true, message: `Module "${module.name}" deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/modules/:id/check-sync - Check GitHub for new commits
modulesRouter.post('/:id/check-sync', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    if (module.sourceType !== 'github' || !module.githubOwner || !module.githubRepo) {
      return res.status(400).json({ error: 'Module is not connected to GitHub' });
    }

    const owner = module.githubOwner;
    const repo = module.githubRepo;
    const branch = module.githubBranch || 'main';

    let latestCommitSha = module.githubCurrentCommit || 'unknown';
    let commitMessage = 'Latest commit on GitHub';
    let commitAuthor = owner;

    // Fetch latest commit metadata from GitHub API
    try {
      const commitRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
        {
          headers: { 'User-Agent': 'ModuleForge-Platform' },
          timeout: 8000,
        }
      );
      if (commitRes.data) {
        latestCommitSha = commitRes.data.sha;
        commitMessage = commitRes.data.commit?.message || commitMessage;
        commitAuthor = commitRes.data.commit?.author?.name || commitRes.data.author?.login || commitAuthor;
      }
    } catch (e: any) {
      console.warn(`GitHub API commit check failed for ${owner}/${repo}:`, e.message);
    }

    const currentCommit = module.githubCurrentCommit;
    const hasUpdate = Boolean(currentCommit && latestCommitSha && currentCommit !== latestCommitSha);
    const newStatus = hasUpdate ? 'update_available' : 'synced';

    const updatedModule = await prisma.module.update({
      where: { id: module.id },
      data: {
        githubLatestCommit: latestCommitSha,
        githubSyncStatus: newStatus,
      },
    });

    return res.json({
      success: true,
      status: newStatus,
      currentCommit: currentCommit || latestCommitSha,
      latestCommit: latestCommitSha,
      hasUpdate,
      commitMessage,
      author: commitAuthor,
      module: formatModuleOutput(updatedModule),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/modules/:id/sync - Perform Manual Synchronization
modulesRouter.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    if (module.sourceType !== 'github' || !module.githubOwner || !module.githubRepo) {
      return res.status(400).json({ error: 'Module is not connected to GitHub' });
    }

    const owner = module.githubOwner;
    const repo = module.githubRepo;
    const branch = module.githubBranch || 'main';

    let latestCommitSha = `${Date.now().toString(16)}`;
    let commitMessage = 'Manual synchronization';
    let commitAuthor = 'Developer';

    // Fetch commit info
    try {
      const commitRes = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
        {
          headers: { 'User-Agent': 'ModuleForge-Platform' },
          timeout: 8000,
        }
      );
      if (commitRes.data) {
        latestCommitSha = commitRes.data.sha;
        commitMessage = commitRes.data.commit?.message || commitMessage;
        commitAuthor = commitRes.data.commit?.author?.name || commitRes.data.author?.login || commitAuthor;
      }
    } catch (e: any) {
      console.warn(`Commit info API call failed, using default commit sha:`, e.message);
    }

    // Download latest repo ZIP archive
    const candidateUrls = [
      `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`,
      `https://codeload.github.com/${owner}/${repo}/zip/HEAD`,
      `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
    ];

    let archiveBuffer: Buffer | null = null;
    let downloadErr: string | null = null;

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
      } catch (e: any) {
        downloadErr = e.message;
      }
    }

    if (!archiveBuffer) {
      await prisma.module.update({
        where: { id: module.id },
        data: { githubSyncStatus: 'sync_failed' },
      });
      return res.status(500).json({ error: `Failed to download repository archive: ${downloadErr || 'Network error'}` });
    }

    const zipValidation = await validateZipBuffer(archiveBuffer);
    if (!zipValidation.valid) {
      return res.status(400).json({ error: zipValidation.error || 'Invalid repository archive' });
    }

    // Save archive to disk
    const zipFileName = `github-${owner}-${repo}-${Date.now()}.zip`;
    const permanentPath = path.join(storageDir, zipFileName);
    fs.writeFileSync(permanentPath, archiveBuffer);

    // Update module in DB
    const updatedModule = await prisma.module.update({
      where: { id: module.id },
      data: {
        zipStoragePath: permanentPath,
        githubCurrentCommit: latestCommitSha,
        githubLatestCommit: latestCommitSha,
        githubLastSyncedAt: new Date(),
        githubSyncStatus: 'synced',
      },
    });

    // Create sync history entry
    const syncLog = await prisma.moduleSync.create({
      data: {
        moduleId: module.id,
        commitSha: latestCommitSha,
        commitMessage,
        author: commitAuthor,
        status: 'synced',
      },
    });

    res.json({
      success: true,
      message: 'Module synchronized successfully',
      module: formatModuleOutput(updatedModule),
      syncLog,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/modules/:id/sync-history - Fetch Sync History Logs
modulesRouter.get('/:id/sync-history', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const syncLogs = await prisma.moduleSync.findMany({
      where: { moduleId: module.id },
      orderBy: { syncedAt: 'desc' },
      take: 20,
    });

    res.json(syncLogs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/modules/:id/webhook-status - Check whether a GitHub webhook is registered
modulesRouter.get('/:id/webhook-status', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    if (module.sourceType !== 'github' || !module.githubOwner || !module.githubRepo) {
      return res.json({
        registered: false,
        reason: 'Module is not connected to GitHub',
      });
    }

    const status = await getWebhookStatus(module.id);
    return res.json({
      ...status,
      webhookEndpoint: getWebhookUrl(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/modules/:id/register-webhook - Register a GitHub push webhook
modulesRouter.post('/:id/register-webhook', async (req, res) => {
  try {
    const { id } = req.params;
    // Allow client to pass their own token from the Settings page
    // We pass it as overrides rather than mutating process.env (which is global and unsafe in serverless)
    const { githubToken, webhookSecret } = req.body || {};

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    if (module.sourceType !== 'github' || !module.githubOwner || !module.githubRepo) {
      return res.status(400).json({ error: 'Module must be linked to a GitHub repository' });
    }

    const result = await registerWebhook(module.id, { githubToken, webhookSecret });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      alreadyRegistered: result.alreadyRegistered ?? false,
      webhookId: result.webhookId,
      webhookUrl: result.webhookUrl,
      message: result.alreadyRegistered
        ? 'Webhook was already registered on GitHub'
        : `Webhook registered — GitHub will now push events to ${result.webhookUrl}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/modules/:id/webhook - Remove the GitHub push webhook
modulesRouter.delete('/:id/webhook', async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const result = await deleteWebhook(module.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      message: 'GitHub webhook removed successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/modules/:id/runtime-config - Update Module Runtime Configuration
modulesRouter.put('/:id/runtime-config', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      frontendCommand,
      backendCommand,
      frontendPort,
      backendPort,
      frontendUrl,
      backendUrl,
      workingDir,
      envVars,
    } = req.body;

    const module = await prisma.module.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const envVarsJson = JSON.stringify(
      Array.isArray(envVars)
        ? envVars
        : typeof envVars === 'string'
        ? envVars.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
    );

    const updatedModule = await prisma.module.update({
      where: { id: module.id },
      data: {
        frontendCommand: frontendCommand !== undefined ? frontendCommand : module.frontendCommand,
        backendCommand: backendCommand !== undefined ? backendCommand : module.backendCommand,
        frontendPort: frontendPort !== undefined ? Number(frontendPort) : module.frontendPort,
        backendPort: backendPort !== undefined ? Number(backendPort) : module.backendPort,
        frontendUrl: frontendUrl !== undefined ? frontendUrl : module.frontendUrl,
        backendUrl: backendUrl !== undefined ? backendUrl : module.backendUrl,
        workingDir: workingDir !== undefined ? workingDir : module.workingDir,
        envVars: envVarsJson,
      },
      include: { category: true },
    });

    res.json({
      success: true,
      message: 'Runtime configuration updated successfully',
      module: formatModuleOutput(updatedModule),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
