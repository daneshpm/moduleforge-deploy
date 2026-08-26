import { Router } from 'express';
import { prisma } from '../prisma';
import { localModuleRunner } from '../services/localModuleRunner';

export const runnerRouter = Router();

// GET /api/runner/status - Get all active running module processes
runnerRouter.get('/status', (req, res) => {
  res.json({
    activeCount: localModuleRunner.getAllStatuses().length,
    processes: localModuleRunner.getAllStatuses(),
  });
});

// POST /api/runner/start-module - Start individual module locally
runnerRouter.post('/start-module', async (req, res) => {
  try {
    const { projectId, pmId, openBrowser = true } = req.body;

    if (!projectId || !pmId) {
      return res.status(400).json({ error: 'projectId and pmId are required' });
    }

    const state = await localModuleRunner.startModule({
      projectId,
      pmId,
      openBrowserAfter: openBrowser,
    });

    res.json({
      success: true,
      message: `Module "${state.moduleName}" launched locally at ${state.frontendUrl}`,
      state,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/runner/stop-module - Stop individual module process
runnerRouter.post('/stop-module', async (req, res) => {
  try {
    const { pmId } = req.body;

    if (!pmId) {
      return res.status(400).json({ error: 'pmId is required' });
    }

    const state = await localModuleRunner.stopModule(pmId);

    res.json({
      success: true,
      message: 'Module process stopped',
      state,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/runner/start-project - Run entire project (start all modules)
runnerRouter.post('/start-project', async (req, res) => {
  try {
    const { projectId } = req.body;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { modules: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const states = [];
    for (const pm of project.modules) {
      try {
        const state = await localModuleRunner.startModule({
          projectId,
          pmId: pm.id,
          openBrowserAfter: false,
        });
        states.push(state);
      } catch (e) {
        // continue
      }
    }

    res.json({
      success: true,
      message: `Started ${states.length} modules for project "${project.name}"`,
      states,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/runner/stop-project - Stop all running modules in project
runnerRouter.post('/stop-project', async (req, res) => {
  try {
    const { projectId } = req.body;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { modules: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    for (const pm of project.modules) {
      await localModuleRunner.stopModule(pm.id);
    }

    res.json({ success: true, message: 'All project modules stopped' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/runner/module-status/:pmId - Get single module process state
runnerRouter.get('/module-status/:pmId', (req, res) => {
  const { pmId } = req.params;
  const state = localModuleRunner.getStatus(pmId);
  res.json(state);
});

// GET /api/runner/logs/:pmId - Get module stdout/stderr logs
runnerRouter.get('/logs/:pmId', (req, res) => {
  const { pmId } = req.params;
  const logs = localModuleRunner.getLogs(pmId);
  res.json(logs);
});
