import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { gitService } from '../services/gitService';

const router = Router();

// Helper to resolve ProjectModule and ensure repo
async function resolveProjectModuleRepo(projectId: string, pmId: string) {
  const pm = await prisma.projectModule.findFirst({
    where: { id: pmId, projectId },
    include: { module: true, project: true },
  });

  if (!pm) {
    throw new Error('Project module not found.');
  }

  const repoDir = await gitService.ensureRepo(pm.moduleId, pm.module.name);
  return { pm, repoDir };
}

// 1. GET STATUS
router.get('/projects/:projectId/modules/:pmId/status', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);

    const status = await gitService.getStatus(repoDir);

    // Sync status to database
    await prisma.projectModule.update({
      where: { id: pm.id },
      data: {
        gitStatus: status.gitStatus,
        currentBranch: status.branch,
        currentCommitSha: status.latestCommit?.sha || pm.currentCommitSha,
      },
    });

    res.json({
      success: true,
      module: {
        id: pm.module.id,
        name: pm.module.name,
        category: pm.module.categoryName,
        repositoryType: pm.repositoryType || pm.module.repositoryType || 'moduleforge',
        ownerName: pm.ownerName || 'Shalya',
        frontendPort: pm.module.frontendPort,
        backendPort: pm.module.backendPort,
      },
      status,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. COMMIT
router.post('/projects/:projectId/modules/:pmId/commit', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { message, author } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Commit message is required.' });
    }

    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);

    const commitAuthor = author || pm.ownerName || 'Developer';
    const commitRecord = await gitService.commit(repoDir, message, commitAuthor);

    // Record in DB ModuleCommit
    await prisma.moduleCommit.create({
      data: {
        moduleId: pm.moduleId,
        projectModuleId: pm.id,
        commitSha: commitRecord.sha,
        message: commitRecord.message,
        author: commitRecord.author,
        branch: commitRecord.branch,
      },
    });

    // Update ProjectModule
    await prisma.projectModule.update({
      where: { id: pm.id },
      data: {
        currentCommitSha: commitRecord.sha,
        currentBranch: commitRecord.branch,
        gitStatus: 'up_to_date',
        lastSyncedAt: new Date(),
      },
    });

    // Log Activity
    await prisma.projectActivity.create({
      data: {
        projectId,
        moduleName: pm.module.name,
        action: 'committed',
        actorName: commitAuthor,
        description: `Committed "${commitRecord.message}" (${commitRecord.shortSha})`,
        commitSha: commitRecord.sha,
        status: 'synced',
      },
    });

    res.json({
      success: true,
      commit: commitRecord,
      message: 'Changes committed successfully.',
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 3. PUSH
router.post('/projects/:projectId/modules/:pmId/push', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { branch } = req.body;
    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);

    const pushResult = await gitService.push(repoDir, branch);

    // Update status
    await prisma.projectModule.update({
      where: { id: pm.id },
      data: {
        gitStatus: 'up_to_date',
        lastSyncedAt: new Date(),
      },
    });

    // Log Activity
    await prisma.projectActivity.create({
      data: {
        projectId,
        moduleName: pm.module.name,
        action: 'pushed',
        actorName: pm.ownerName || 'Developer',
        description: `Pushed changes to branch "${pushResult.branch}"`,
        commitSha: pushResult.commitSha,
        status: 'synced',
      },
    });

    res.json({
      success: true,
      message: pushResult.message,
      commitSha: pushResult.commitSha,
      branch: pushResult.branch,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. PULL
router.post('/projects/:projectId/modules/:pmId/pull', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { branch } = req.body;
    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);

    const pullResult = await gitService.pull(repoDir, branch);

    // Log Activity
    await prisma.projectActivity.create({
      data: {
        projectId,
        moduleName: pm.module.name,
        action: 'pulled',
        actorName: pm.ownerName || 'Developer',
        description: `Pulled latest changes: ${pullResult.message}`,
        status: 'synced',
      },
    });

    res.json({
      success: true,
      message: pullResult.message,
      updated: pullResult.updated,
    });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// 5. BRANCHES (List, Create, Checkout)
router.get('/projects/:projectId/modules/:pmId/branches', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { repoDir } = await resolveProjectModuleRepo(projectId, pmId);
    const branchInfo = await gitService.getBranches(repoDir);
    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/projects/:projectId/modules/:pmId/branches', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { branchName } = req.body;
    if (!branchName || !branchName.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name is required.' });
    }

    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);
    const branchInfo = await gitService.createBranch(repoDir, branchName);

    await prisma.projectModule.update({
      where: { id: pm.id },
      data: { currentBranch: branchInfo.current },
    });

    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/projects/:projectId/modules/:pmId/checkout', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { branchName } = req.body;
    if (!branchName || !branchName.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name is required.' });
    }

    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);
    const branchInfo = await gitService.switchBranch(repoDir, branchName);

    await prisma.projectModule.update({
      where: { id: pm.id },
      data: { currentBranch: branchInfo.current },
    });

    res.json({ success: true, ...branchInfo });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 6. COMMIT HISTORY
router.get('/projects/:projectId/modules/:pmId/history', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const limit = Number(req.query.limit) || 30;
    const { repoDir } = await resolveProjectModuleRepo(projectId, pmId);

    const history = await gitService.getHistory(repoDir, limit);
    res.json({ success: true, history });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 7. FILE TREE & FILE EDITOR
router.get('/projects/:projectId/modules/:pmId/files', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { repoDir } = await resolveProjectModuleRepo(projectId, pmId);

    const files = gitService.getFileTree(repoDir);
    res.json({ success: true, files });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/projects/:projectId/modules/:pmId/file', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Query param path is required.' });
    }

    const { repoDir } = await resolveProjectModuleRepo(projectId, pmId);
    const content = gitService.readFile(repoDir, filePath);

    res.json({ success: true, path: filePath, content });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/projects/:projectId/modules/:pmId/file', async (req: Request, res: Response) => {
  try {
    const { projectId, pmId } = req.params;
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Path and content are required.' });
    }

    const { pm, repoDir } = await resolveProjectModuleRepo(projectId, pmId);
    gitService.saveFile(repoDir, filePath, content);

    // Re-check status to update gitStatus
    const status = await gitService.getStatus(repoDir);
    await prisma.projectModule.update({
      where: { id: pm.id },
      data: { gitStatus: status.gitStatus },
    });

    res.json({ success: true, message: 'File saved successfully.', gitStatus: status.gitStatus });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
