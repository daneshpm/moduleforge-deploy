import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import JSZip from 'jszip';
import axios from 'axios';
import { prisma } from '../prisma';
import { realtimeEventManager } from '../services/realtimeEvents';
import { emailService } from '../services/emailService';

export const projectsRouter = Router();

// GET /api/projects - List user projects
projectsRouter.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects - Create project
projectsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      projectType = 'individual',
      visibility = 'private',
      gitRepositoryUrl,
      gitOwner,
      gitRepo,
      gitBranch = 'main',
      teamRepos = [],
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    let parsedOwner = gitOwner;
    let parsedRepo = gitRepo;
    if (gitRepositoryUrl && (!parsedOwner || !parsedRepo)) {
      const match = gitRepositoryUrl.replace(/\.git$/, '').match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        parsedOwner = match[1];
        parsedRepo = match[2];
      }
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || '',
        projectType: projectType === 'team' ? 'team' : 'individual',
        visibility: visibility === 'public' ? 'public' : 'private',
        canvasConfig: JSON.stringify({ zoom: 1, pan: { x: 0, y: 0 } }),
        gitRepositoryUrl: gitRepositoryUrl ? gitRepositoryUrl.trim() : null,
        gitOwner: parsedOwner ? parsedOwner.trim() : null,
        gitRepo: parsedRepo ? parsedRepo.trim() : null,
        gitBranch: gitBranch ? gitBranch.trim() : 'main',
        syncStatus: 'synced',
      },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
        members: true,
      },
    });

    // If team project & teamRepos array provided, auto-create & link team modules!
    if (Array.isArray(teamRepos) && teamRepos.length > 0) {
      let xPos = 100;
      let yPos = 100;

      for (const repoItem of teamRepos) {
        if (!repoItem.name || !repoItem.githubRepository) continue;

        const modName = repoItem.name.trim();
        const repoUrl = repoItem.githubRepository.trim().toLowerCase();
        const branch = repoItem.branch || 'main';
        const categoryName = repoItem.category || 'CRM';
        const slug = modName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // Ensure category exists
        await prisma.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName, slug: categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-') },
        });

        // Find or create Module
        let mod = await prisma.module.findFirst({
          where: { OR: [{ slug }, { name: modName }] },
        });

        if (!mod) {
          const parts = repoUrl.split('/');
          const owner = parts[0] || 'company';
          const repo = parts[1] || slug;

          mod = await prisma.module.create({
            data: {
              slug: `${slug}-${Date.now().toString().slice(-4)}`,
              name: modName,
              description: `${modName} software module from ${repoUrl}`,
              author: owner,
              categoryName,
              version: '1.0.0',
              sourceType: 'github',
              githubUrl: `https://github.com/${repoUrl}`,
              githubOwner: owner,
              githubRepo: repo,
              githubBranch: branch,
              githubSyncStatus: 'synced',
              frontendCommand: 'npm run dev',
              frontendPort: 5173,
            },
          });
        }

        // Create ProjectModule entry pre-connected to team repo
        await prisma.projectModule.create({
          data: {
            projectId: project.id,
            moduleId: mod.id,
            moduleVersion: mod.version || '1.0.0',
            xPosition: xPos,
            yPosition: yPos,
            githubRepository: repoUrl,
            githubBranch: branch,
            deploymentStatus: 'synced',
          },
        });

        xPos += 240;
      }

      await prisma.projectActivity.create({
        data: {
          projectId: project.id,
          action: 'project_created',
          actorName: 'Owner',
          description: `Initialized Team Project with ${teamRepos.length} connected repositories`,
        },
      });
    }

    // Refetch project with modules included
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
        members: true,
      },
    });

    res.status(201).json(fullProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id - Get project detail
projectsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/projects/:id - Update project & modules canvas configuration
projectsRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, canvasConfig, modules: updatedModules } = req.body;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 1. Update basic info
    await prisma.project.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        canvasConfig: typeof canvasConfig === 'string' ? canvasConfig : JSON.stringify(canvasConfig || {}),
      },
    });

    // 2. If updatedModules array provided, sync project modules
    if (Array.isArray(updatedModules)) {
      // Remove current items
      await prisma.projectModule.deleteMany({ where: { projectId: id } });

      // Re-create items with updated positions and versions
      for (const item of updatedModules) {
        await prisma.projectModule.create({
          data: {
            projectId: id,
            moduleId: item.moduleId || item.module?.id,
            moduleVersion: item.moduleVersion || item.module?.version || '1.0.0',
            xPosition: item.xPosition ?? 0,
            yPosition: item.yPosition ?? 0,
            configuration: item.configuration ? JSON.stringify(item.configuration) : null,
          },
        });
      }
    }

    const result = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id - Delete project
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.project.delete({ where: { id } });
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/modules - Add module to project
projectsRouter.post('/:id/modules', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { moduleId, moduleVersion, xPosition = 100, yPosition = 100 } = req.body;

    const module = await prisma.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const versionToUse = moduleVersion || module.version;

    // Check if already in project
    const existing = await prisma.projectModule.findFirst({
      where: { projectId, moduleId },
    });

    if (existing) {
      return res.json({ message: 'Module already added to project', item: existing });
    }

    const created = await prisma.projectModule.create({
      data: {
        projectId,
        moduleId,
        moduleVersion: versionToUse,
        xPosition,
        yPosition,
      },
      include: {
        module: true,
      },
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id/modules/:moduleId - Remove module from project
projectsRouter.delete('/:id/modules/:moduleId', async (req, res) => {
  try {
    const { id: projectId, moduleId } = req.params;

    await prisma.projectModule.deleteMany({
      where: { projectId, moduleId },
    });

    res.json({ success: true, message: 'Module removed from project' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to safely extract ZIP entries into a module folder
async function extractZipToModFolder(zipBuffer: Buffer, modFolder: JSZip) {
  const modZip = await JSZip.loadAsync(zipBuffer);
  const fileEntries: { relPath: string; entry: JSZip.JSZipObject }[] = [];

  modZip.forEach((relPath, zipEntry) => {
    if (!zipEntry.dir) {
      fileEntries.push({ relPath, entry: zipEntry });
    }
  });

  if (fileEntries.length === 0) {
    return;
  }

  // Check if ALL entries share a single common top-level directory wrapper
  const firstPath = fileEntries[0].relPath;
  const firstFolderPrefix = firstPath.includes('/') ? firstPath.split('/')[0] + '/' : null;

  const hasCommonSingleRoot =
    firstFolderPrefix !== null &&
    fileEntries.every((item) => item.relPath.startsWith(firstFolderPrefix));

  for (const item of fileEntries) {
    const content = await item.entry.async('nodebuffer');
    let targetPath = item.relPath;
    if (hasCommonSingleRoot && firstFolderPrefix) {
      targetPath = item.relPath.slice(firstFolderPrefix.length);
    }
    if (targetPath) {
      modFolder.file(targetPath, content);
    }
  }
}

// POST /api/projects/:id/export - Generate & Download ZIP
projectsRouter.post('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const rootZip = new JSZip();

    // 1. Build PROJECT.json
    const projectJsonData = {
      projectName: project.name,
      createdWith: 'ModuleForge',
      modules: project.modules.map((pm) => ({
        name: pm.module.name,
        version: pm.moduleVersion || pm.module.version || '1.0.0',
        description: pm.module.description,
        category: pm.module.categoryName,
      })),
    };

    rootZip.file('PROJECT.json', JSON.stringify(projectJsonData, null, 2));

    // 2. Build deterministic module-runtime.json with non-overlapping ports (3000, 3001, 3002...)
    let portCounter = 3000;
    const moduleRuntimeData = {
      projectName: project.name,
      platformHost: {
        port: 4567,
        url: 'http://localhost:4567',
      },
      modules: project.modules.map((pm, idx) => {
        let envVarsList: string[] = [];
        if (pm.module.envVars) {
          try {
            envVarsList = JSON.parse(pm.module.envVars);
          } catch (e) {
            if (typeof pm.module.envVars === 'string') {
              envVarsList = pm.module.envVars.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
        }

        const assignedPort = pm.module.frontendPort && pm.module.frontendPort !== 5173
          ? pm.module.frontendPort
          : (portCounter++);

        const folderName = pm.module.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const defaultCmd = `npx vite --host 0.0.0.0 --port ${assignedPort} --strictPort`;

        return {
          name: pm.module.name,
          category: pm.module.categoryName,
          version: pm.moduleVersion || pm.module.version || '1.0.0',
          path: `./modules/${folderName}`,
          frontend: {
            command: pm.module.frontendCommand || defaultCmd,
            port: assignedPort,
            url: `http://localhost:${assignedPort}`,
          },
          backend: pm.module.backendCommand
            ? {
                command: pm.module.backendCommand,
                port: pm.module.backendPort || (portCounter++),
                url: pm.module.backendUrl || `http://localhost:${pm.module.backendPort || (portCounter - 1)}`,
              }
            : null,
          env: envVarsList,
        };
      }),
    };

    rootZip.file('module-runtime.json', JSON.stringify(moduleRuntimeData, null, 2));

    // 3. Build ANTIGRAVITY_PROMPT.md
    const moduleRuntimeSpecs = moduleRuntimeData.modules
      .map((m, idx) => `  - **Module ${idx + 1}** (\`${m.name}\`): Port \`${m.frontend.port}\` via \`${m.frontend.command}\``)
      .join('\n');

    const antigravityPromptContent = `TASK: Unified Multi-Module Application Shell & Process Orchestrator
Create a single, unified Application Shell platform (\`/shell\`) and a background local process runner (\`/launcher\`) to run all software modules located in \`/modules\` seamlessly under ONE platform interface.

---

### ⚠️ STRICT COMPLIANCE RULES:
1. **DO NOT MODIFY MODULE CODE**: Do not rebuild, redesign, or edit any files, CSS, endpoints, database schemas, or logic inside \`/modules\`. All original modules must remain 100% intact and untouched.
2. **SINGLE UNIFIED PLATFORM**: The user must only ever need to access ONE URL (e.g. \`http://localhost:4567\`). All modules must run embedded inside this platform without spawning separate browser popups or requiring manual port navigation.

---

### 🛠️ ARCHITECTURE SPECIFICATIONS:

#### 1. Deterministic Port & Runtime Configuration (\`module-runtime.json\`)
- Assign distinct, non-overlapping ports and strict launch commands to prevent port bumping or collision:
${moduleRuntimeSpecs || '  - No modules configured.'}
  - **Platform Host**: Port \`4567\`.

#### 2. Local Process Launcher (\`/launcher/launcher.js\`)
- An Express server running on port \`4567\` that:
  - Serves the \`/shell\` directory as static files on the root (\`http://localhost:4567\`).
  - Automatically spawns child processes for all configured modules in their respective working directories with cross-platform shell support.
  - Handles clean process termination on Windows (\`taskkill /F /T /PID\`) and POSIX (\`proc.kill()\`).
  - Does NOT automatically pop open separate browser tabs for individual ports.
  - Provides REST endpoints: \`GET /status\`, \`GET /modules\`, \`POST /start-module\`, and \`POST /stop-module\`.

#### 3. High-Speed Shell UI (\`/shell/index.html\`)
- **Aesthetic**: Premium dark glassmorphic design (\`#080c14\` background, translucent panels, glowing active status badges).
- **Sidebar**: Dashboard home view + dedicated buttons for each integrated module with real-time status dots.
- **On-Demand Lazy Loading**:
  - Do NOT load all iframes simultaneously on initial page load (prevents browser lag and high RAM/CPU usage).
  - Use \`data-src\` and inject \`iframe.src\` only when the user selects that module tab for the first time.
  - Keep active iframes loaded in memory for 0ms instant tab switching.
- **Full Hardware & API Permissions**:
  - Grant complete browser API capabilities to the embedded views:
    \`allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share"\`
    \`allowfullscreen\`
- **Utility Header**:
  - Module title badge, port indicator, 🔄 Reload Frame button, and ↗ Popout Tab shortcut for optional full-screen viewing.

---

### ✅ EXECUTION & VERIFICATION:
1. Run \`npm install\` across all sub-projects (\`/launcher\` and each directory in \`/modules\`).
2. Verify all local ports are free and initialize any required databases cleanly.
3. Start the launcher daemon: \`node launcher/launcher.js\`.
4. Verify HTTP 200 responses across all module ports and launch \`http://localhost:4567\`.
`;

    rootZip.file('PROMPT.md', antigravityPromptContent);
    rootZip.file('ANTIGRAVITY_PROMPT.md', antigravityPromptContent);

    // 4. Build README.md
    const readmeContent = `# ${project.name} — Unified Multi-Module Application Platform

This project composition was generated with **ModuleForge**.

## AI Agent Prompt (Included in PROMPT.md)
\`\`\`markdown
${antigravityPromptContent}
\`\`\`

## Quick Start
1. Open terminal in this root directory.
2. Run \`npm install\` in \`launcher/\` and in each sub-directory under \`modules/\`.
3. Start the application orchestrator:
   \`\`\`bash
   cd launcher && npm start
   \`\`\`
4. Open **http://localhost:4567** in your browser. All modules run embedded under one unified platform!
`;

    rootZip.file('README.md', readmeContent);

    // 5. Build Shell Package inside `shell/`
    const shellFolder = rootZip.folder('shell');
    const shellIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} — Unified Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #080c14;
      color: #f8fafc;
      font-family: 'Inter', system-ui, sans-serif;
      height: 100vh;
      display: flex;
      overflow: hidden;
    }
    aside {
      width: 280px;
      background: #0d131f;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      shrink-0;
      z-index: 20;
    }
    .brand {
      padding: 20px;
      border-bottom: 1px solid #1e293b;
    }
    .brand h1 { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
    .brand span { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6366f1; }
    nav {
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      overflow-y: auto;
    }
    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      background: transparent;
      color: #94a3b8;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
    }
    .nav-btn:hover { background: #162033; color: #f8fafc; }
    .nav-btn.active {
      background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    main {
      flex: 1;
      background: #080c14;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    header {
      height: 56px;
      border-bottom: 1px solid #1e293b;
      background: #0d131f;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 10;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .module-badge {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding: 3px 8px;
      border-radius: 6px;
      background: #1e1b4b;
      color: #a5b4fc;
      border: 1px solid #3730a3;
    }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .btn-action {
      background: #162033;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-action:hover { background: #1e293b; color: #fff; }
    .iframe-container {
      flex: 1;
      position: relative;
      background: #080c14;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: none;
    }
    iframe.active { display: block; }
    #view-dashboard {
      padding: 40px;
      overflow-y: auto;
      height: 100%;
      display: block;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 24px; }
    .card {
      background: #0d131f;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 24px;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: #4f46e5; }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <aside>
    <div>
      <div class="brand">
        <h1>${project.name}</h1>
        <span>UNIFIED PLATFORM HOST</span>
      </div>

      <nav>
        <button onclick="showModule('dashboard', '')" id="btn-dashboard" class="nav-btn active">
          <span>📊 Dashboard</span>
        </button>
        ${moduleRuntimeData.modules
          .map((m) => {
            const modKey = m.name.replace(/[^a-zA-Z0-9]/g, '');
            return `<button onclick="showModule('${modKey}', '${m.frontend.url}')" id="btn-${modKey}" class="nav-btn">
          <span>📦 ${m.name}</span>
          <span class="status-dot"></span>
        </button>`;
          })
          .join('\n        ')}
      </nav>
    </div>

    <div style="padding: 16px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; font-family: 'JetBrains Mono', monospace;">
      Preserving Original Modules ✓
    </div>
  </aside>

  <!-- Main Viewer -->
  <main>
    <header id="top-header">
      <div class="header-left">
        <h2 id="active-title" style="font-size: 15px; font-weight: 700; color: #fff;">Dashboard Overview</h2>
        <span id="active-port-badge" class="module-badge">Platform Root</span>
      </div>
      <div class="header-right">
        <button onclick="reloadActiveFrame()" class="btn-action" title="Reload Frame">🔄 Reload</button>
        <button onclick="popoutActiveFrame()" class="btn-action" title="Open Fullscreen Tab">↗ Popout</button>
      </div>
    </header>

    <div class="iframe-container">
      <!-- Dashboard Tab -->
      <div id="view-dashboard">
        <h2 style="font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 8px;">Welcome to ${project.name}</h2>
        <p style="color: #94a3b8; font-size: 14px;">All software modules run locally under this single unified platform interface at <code>http://localhost:4567</code>.</p>
        
        <div class="grid">
          ${moduleRuntimeData.modules
            .map((m) => {
              const modKey = m.name.replace(/[^a-zA-Z0-9]/g, '');
              return `<div class="card">
            <span style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6366f1; text-transform: uppercase;">${m.category} • Port ${m.frontend.port}</span>
            <h3 style="font-size: 18px; font-weight: 700; color: #fff; margin: 8px 0;">${m.name}</h3>
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 20px; line-height: 1.5;">${m.frontend.command}</p>
            <button onclick="showModule('${modKey}', '${m.frontend.url}')" class="btn-action" style="background: #4f46e5; color: #fff; border: none; font-weight: 600;">Launch Module</button>
          </div>`;
            })
            .join('\n          ')}
        </div>
      </div>

      <!-- On-Demand Lazy Loaded Module Iframes with Full Hardware & API Permissions -->
      ${moduleRuntimeData.modules
        .map((m) => {
          const modKey = m.name.replace(/[^a-zA-Z0-9]/g, '');
          return `<iframe
        id="frame-${modKey}"
        data-src="${m.frontend.url}"
        allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share"
        allowfullscreen
      ></iframe>`;
        })
        .join('\n      ')}
    </div>
  </main>

  <script>
    let activeKey = 'dashboard';
    let activeUrl = '';

    function showModule(key, url) {
      activeKey = key;
      activeUrl = url;

      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('btn-' + key);
      if (btn) btn.classList.add('active');

      const dash = document.getElementById('view-dashboard');
      const headerTitle = document.getElementById('active-title');
      const headerPort = document.getElementById('active-port-badge');

      document.querySelectorAll('iframe').forEach(f => f.classList.remove('active'));

      if (key === 'dashboard') {
        dash.style.display = 'block';
        headerTitle.innerText = 'Dashboard Overview';
        headerPort.innerText = 'Platform Root';
      } else {
        dash.style.display = 'none';
        headerTitle.innerText = key;
        headerPort.innerText = url;

        const frame = document.getElementById('frame-' + key);
        if (frame) {
          if (!frame.src || frame.src === 'about:blank' || frame.src === window.location.href) {
            frame.src = frame.getAttribute('data-src');
          }
          frame.classList.add('active');
        }
      }
    }

    function reloadActiveFrame() {
      if (activeKey !== 'dashboard') {
        const frame = document.getElementById('frame-' + activeKey);
        if (frame) frame.src = frame.getAttribute('data-src');
      }
    }

    function popoutActiveFrame() {
      if (activeUrl) {
        window.open(activeUrl, '_blank');
      }
    }
  </script>
</body>
</html>`;

    shellFolder?.file('index.html', shellIndexHtml);
    shellFolder?.file('README.md', `# Application Shell for ${project.name}\n\nOpen index.html to navigate between your configured modules.`);

    // 6. Build Standalone Local Runner inside `launcher/`
    const launcherFolder = rootZip.folder('launcher');

    const launcherPkgJson = {
      name: `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-launcher`,
      version: '1.0.0',
      description: `Local Module Runner for ${project.name}`,
      main: 'launcher.js',
      scripts: {
        start: 'node launcher.js',
      },
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5',
      },
    };

    const launcherJs = `const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4567;

app.use(cors());
app.use(express.json());

// Serve static /shell directory at platform root
const shellDir = path.join(__dirname, '..', 'shell');
app.use(express.static(shellDir));

const activeProcs = new Map();
const runtimePath = path.join(__dirname, '..', 'module-runtime.json');

function getRuntimeConfig() {
  if (!fs.existsSync(runtimePath)) return { modules: [] };
  return JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
}

function terminateProcess(proc, pid) {
  if (!proc && !pid) return;
  const isWin = process.platform === 'win32';
  if (isWin && pid) {
    exec('taskkill /F /T /PID ' + pid, (err) => {});
  } else if (proc) {
    proc.kill('SIGTERM');
  }
}

// Auto-spawn all configured modules on launcher start
function startAllModules() {
  const config = getRuntimeConfig();
  console.log('🚀 Starting process orchestrator for ' + (config.modules ? config.modules.length : 0) + ' modules...');

  if (Array.isArray(config.modules)) {
    for (const mod of config.modules) {
      const modDir = path.resolve(__dirname, '..', mod.path || ('./modules/' + mod.name));
      const fCmd = mod.frontend && mod.frontend.command ? mod.frontend.command : 'npm run dev';
      const fParts = fCmd.trim().split(/\\s+/);

      console.log('  -> Spawning module "' + mod.name + '" on port ' + mod.frontend.port + ' in ' + modDir);

      try {
        const proc = spawn(fParts[0], fParts.slice(1), {
          cwd: modDir,
          shell: true,
          env: { ...process.env, PORT: String(mod.frontend.port || 3000), VITE_PORT: String(mod.frontend.port || 3000) }
        });

        activeProcs.set(mod.name, { proc, pid: proc.pid, port: mod.frontend.port });
      } catch (e) {
        console.error('Failed to spawn ' + mod.name + ':', e.message);
      }
    }
  }
}

app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'http://localhost:' + PORT,
    activeModules: Array.from(activeProcs.keys()),
  });
});

app.get('/modules', (req, res) => {
  const config = getRuntimeConfig();
  res.json(config.modules || []);
});

app.post('/start-module', (req, res) => {
  const { moduleName } = req.body;
  const config = getRuntimeConfig();
  const mod = config.modules.find(m => m.name === moduleName);

  if (!mod) return res.status(404).json({ error: 'Module not found' });

  if (activeProcs.has(moduleName)) {
    return res.json({ success: true, message: 'Already running', port: mod.frontend.port });
  }

  const modDir = path.resolve(__dirname, '..', mod.path || ('./modules/' + moduleName));
  const fCmd = mod.frontend.command || 'npm run dev';
  const fParts = fCmd.trim().split(/\\s+/);

  const proc = spawn(fParts[0], fParts.slice(1), {
    cwd: modDir,
    shell: true,
    env: { ...process.env, PORT: String(mod.frontend.port || 3000) }
  });

  activeProcs.set(moduleName, { proc, pid: proc.pid, port: mod.frontend.port });
  res.json({ success: true, message: 'Started ' + moduleName, port: mod.frontend.port });
});

app.post('/stop-module', (req, res) => {
  const { moduleName } = req.body;
  const entry = activeProcs.get(moduleName);
  if (entry) {
    terminateProcess(entry.proc, entry.pid);
    activeProcs.delete(moduleName);
  }
  res.json({ success: true, message: 'Stopped ' + moduleName });
});

// Clean shutdown on exit
process.on('SIGINT', () => {
  console.log('\\nStopping all module processes...');
  for (const [name, entry] of activeProcs.entries()) {
    terminateProcess(entry.proc, entry.pid);
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log('\\n======================================================');
  console.log('🚀 UNIFIED APPLICATION PLATFORM READY!');
  console.log('👉 Open http://localhost:' + PORT + ' in your browser');
  console.log('======================================================\\n');
  startAllModules();
});
`;

    const launcherReadme = `# Standalone Local Runner for ${project.name}

## How to Start Unified Multi-Module Application

1. Open a terminal in this \`launcher/\` directory.
2. Run \`npm install\` to install launcher dependencies.
3. Run \`npm start\` to launch the unified platform server on **http://localhost:4567**.
4. Open **http://localhost:4567** in your browser to run all modules under ONE single interface!
`;

    launcherFolder?.file('package.json', JSON.stringify(launcherPkgJson, null, 2));
    launcherFolder?.file('launcher.js', launcherJs);
    launcherFolder?.file('README.md', launcherReadme);

    // 7. Attach original module files inside `modules/<ModuleName>/`
    const modulesFolder = rootZip.folder('modules');

    for (const pm of project.modules) {
      const mod = pm.module;
      const folderName = mod.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const modFolder = modulesFolder?.folder(folderName);

      if (modFolder) {
        if (mod.zipStoragePath && fs.existsSync(mod.zipStoragePath)) {
          const modZipBuffer = fs.readFileSync(mod.zipStoragePath);
          await extractZipToModFolder(modZipBuffer, modFolder);
        } else if (mod.sourceType === 'github' && mod.githubOwner && mod.githubRepo) {
          try {
            const zipUrl = `https://codeload.github.com/${mod.githubOwner}/${mod.githubRepo}/zip/refs/heads/${mod.githubBranch || 'main'}`;
            const zipRes = await axios.get(zipUrl, {
              responseType: 'arraybuffer',
              timeout: 15000,
            });
            await extractZipToModFolder(Buffer.from(zipRes.data), modFolder);
          } catch (e: any) {
            console.error(`Failed to fetch zip for GitHub module ${mod.name}:`, e.message);
            modFolder.file('README.md', `# ${mod.name}\n\n${mod.description}`);
          }
        } else {
          modFolder.file('README.md', `# ${mod.name}\n\n${mod.description}`);
        }
      }
    }

    // Generate export ZIP buffer
    const exportBuffer = await rootZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const safeProjectSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const zipFileName = `${safeProjectSlug || 'my-project'}-export.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    return res.send(exportBuffer);
  } catch (error: any) {
    console.error('Export ZIP error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/open-antigravity - Direct Redirection to Antigravity IDE
projectsRouter.post('/:id/open-antigravity', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            module: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 1. Prepare Workspace on Disk
    const workspaceRoot = path.join(__dirname, '..', '..', 'uploads', 'extracted', 'projects', project.id);
    fs.mkdirSync(workspaceRoot, { recursive: true });

    // 2. Build deterministic module-runtime.json
    let portCounter = 3000;
    const moduleRuntimeData = {
      projectName: project.name,
      platformHost: {
        port: 4567,
        url: 'http://localhost:4567',
      },
      modules: project.modules.map((pm, idx) => {
        let envVarsList: string[] = [];
        if (pm.module.envVars) {
          try {
            envVarsList = JSON.parse(pm.module.envVars);
          } catch (e) {
            envVarsList = [];
          }
        }
        const assignedPort = pm.module.frontendPort && pm.module.frontendPort !== 5173
          ? pm.module.frontendPort
          : (portCounter++);
        const folderName = pm.module.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const defaultCmd = `npx vite --host 0.0.0.0 --port ${assignedPort} --strictPort`;

        return {
          name: pm.module.name,
          category: pm.module.categoryName,
          version: pm.moduleVersion || pm.module.version || '1.0.0',
          path: `./modules/${folderName}`,
          frontend: {
            command: pm.module.frontendCommand || defaultCmd,
            port: assignedPort,
            url: `http://localhost:${assignedPort}`,
          },
          backend: pm.module.backendCommand
            ? {
                command: pm.module.backendCommand,
                port: pm.module.backendPort || (portCounter++),
                url: pm.module.backendUrl || `http://localhost:${pm.module.backendPort || (portCounter - 1)}`,
              }
            : null,
          env: envVarsList,
        };
      }),
    };

    const moduleRuntimeSpecs = moduleRuntimeData.modules
      .map((m, idx) => `  - **Module ${idx + 1}** (\`${m.name}\`): Port \`${m.frontend.port}\` via \`${m.frontend.command}\``)
      .join('\n');

    const antigravityPromptContent = `TASK: Unified Multi-Module Application Shell & Process Orchestrator
Create a single, unified Application Shell platform (\`/shell\`) and a background local process runner (\`/launcher\`) to run all software modules located in \`/modules\` seamlessly under ONE platform interface.

---

### ⚠️ STRICT COMPLIANCE RULES:
1. **DO NOT MODIFY MODULE CODE**: Do not rebuild, redesign, or edit any files, CSS, endpoints, database schemas, or logic inside \`/modules\`. All original modules must remain 100% intact and untouched.
2. **SINGLE UNIFIED PLATFORM**: The user must only ever need to access ONE URL (e.g. \`http://localhost:4567\`). All modules must run embedded inside this platform without spawning separate browser popups or requiring manual port navigation.

---

### 🛠️ ARCHITECTURE SPECIFICATIONS:

#### 1. Deterministic Port & Runtime Configuration (\`module-runtime.json\`)
- Assign distinct, non-overlapping ports and strict launch commands to prevent port bumping or collision:
${moduleRuntimeSpecs || '  - No modules configured.'}
  - **Platform Host**: Port \`4567\`.

#### 2. Local Process Launcher (\`/launcher/launcher.js\`)
- An Express server running on port \`4567\` that:
  - Serves the \`/shell\` directory as static files on the root (\`http://localhost:4567\`).
  - Automatically spawns child processes for all configured modules in their respective working directories with cross-platform shell support.
  - Handles clean process termination on Windows (\`taskkill /F /T /PID\`) and POSIX (\`proc.kill()\`).
  - Does NOT automatically pop open separate browser tabs for individual ports.
  - Provides REST endpoints: \`GET /status\`, \`GET /modules\`, \`POST /start-module\`, and \`POST /stop-module\`.

#### 3. High-Speed Shell UI (\`/shell/index.html\`)
- **Aesthetic**: Premium dark glassmorphic design (\`#080c14\` background, translucent panels, glowing active status badges).
- **Sidebar**: Dashboard home view + dedicated buttons for each integrated module with real-time status dots.
- **On-Demand Lazy Loading**:
  - Do NOT load all iframes simultaneously on initial page load (prevents browser lag and high RAM/CPU usage).
  - Use \`data-src\` and inject \`iframe.src\` only when the user selects that module tab for the first time.
  - Keep active iframes loaded in memory for 0ms instant tab switching.
- **Full Hardware & API Permissions**:
  - Grant complete browser API capabilities to the embedded views:
    \`allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share"\`
    \`allowfullscreen\`
- **Utility Header**:
  - Module title badge, port indicator, 🔄 Reload Frame button, and ↗ Popout Tab shortcut for optional full-screen viewing.

---

### ✅ EXECUTION & VERIFICATION:
1. Run \`npm install\` across all sub-projects (\`/launcher\` and each directory in \`/modules\`).
2. Verify all local ports are free and initialize any required databases cleanly.
3. Start the launcher daemon: \`node launcher/launcher.js\`.
4. Verify HTTP 200 responses across all module ports and launch \`http://localhost:4567\`.
`;

    fs.writeFileSync(path.join(workspaceRoot, 'ANTIGRAVITY_PROMPT.md'), antigravityPromptContent);
    fs.writeFileSync(path.join(workspaceRoot, 'module-runtime.json'), JSON.stringify(moduleRuntimeData, null, 2));
    fs.writeFileSync(
      path.join(workspaceRoot, 'PROJECT.json'),
      JSON.stringify(
        {
          projectName: project.name,
          createdWith: 'ModuleForge',
          modules: project.modules.map((pm) => ({
            name: pm.module.name,
            version: pm.moduleVersion || pm.module.version || '1.0.0',
            description: pm.module.description,
            category: pm.module.categoryName,
          })),
        },
        null,
        2
      )
    );

    // 3. Extract module source trees into /modules/<folderName>
    const modulesDir = path.join(workspaceRoot, 'modules');
    fs.mkdirSync(modulesDir, { recursive: true });

    for (const pm of project.modules) {
      const mod = pm.module;
      const folderName = mod.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetModDir = path.join(modulesDir, folderName);
      fs.mkdirSync(targetModDir, { recursive: true });

      if (mod.zipStoragePath && fs.existsSync(mod.zipStoragePath)) {
        try {
          const zipBuf = fs.readFileSync(mod.zipStoragePath);
          const zip = await JSZip.loadAsync(zipBuf);
          for (const rel of Object.keys(zip.files)) {
            const entry = zip.files[rel];
            const outPath = path.join(targetModDir, rel);
            if (entry.dir) {
              fs.mkdirSync(outPath, { recursive: true });
            } else {
              fs.mkdirSync(path.dirname(outPath), { recursive: true });
              const content = await entry.async('nodebuffer');
              fs.writeFileSync(outPath, content);
            }
          }
        } catch (e: any) {
          console.error(`Error extracting module ${mod.name}:`, e.message);
        }
      }
    }

    // 4. Trigger Direct Launch / Redirection on Host OS
    const normalizedPath = workspaceRoot.replace(/\\/g, '/');
    const antigravityDeepLink = `antigravity://file/${normalizedPath}`;
    const vscodeDeepLink = `vscode://file/${normalizedPath}`;

    const platform = process.platform;
    const { spawn: spawnProc } = require('child_process');

    if (platform === 'win32') {
      // Launch Antigravity IDE / protocol / Explorer
      spawnProc('cmd', ['/c', 'start', '', `antigravity "${workspaceRoot}"`], { detached: true, stdio: 'ignore' }).unref();
      spawnProc('cmd', ['/c', 'start', '', antigravityDeepLink], { detached: true, stdio: 'ignore' }).unref();
      spawnProc('cmd', ['/c', 'start', '', workspaceRoot], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawnProc('open', [antigravityDeepLink], { detached: true, stdio: 'ignore' }).unref();
      spawnProc('open', [workspaceRoot], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawnProc('xdg-open', [workspaceRoot], { detached: true, stdio: 'ignore' }).unref();
    }

    res.json({
      success: true,
      folderPath: workspaceRoot,
      antigravityUrl: antigravityDeepLink,
      vscodeUrl: vscodeDeepLink,
      prompt: antigravityPromptContent,
      message: 'Workspace created and opened in Antigravity!',
    });
  } catch (error: any) {
    console.error('Open Antigravity error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id/members - List Team Members
projectsRouter.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/members - Invite Team Member with Email and Join Link
projectsRouter.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role = 'developer', inviterName = 'Project Owner' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existing = await prisma.projectMember.findFirst({
      where: { projectId: id, email: email.toLowerCase() },
    });

    if (existing && existing.status === 'accepted') {
      return res.status(400).json({ error: 'Team member has already joined this project' });
    }

    const memberUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const inviteToken = crypto.randomBytes(24).toString('hex');

    let member;
    if (existing) {
      member = await prisma.projectMember.update({
        where: { id: existing.id },
        data: {
          role,
          inviteToken,
          status: 'pending',
          invitedAt: new Date(),
        },
        include: { user: true },
      });
    } else {
      member = await prisma.projectMember.create({
        data: {
          projectId: id,
          email: email.toLowerCase(),
          role,
          status: 'pending',
          inviteToken,
          userId: memberUser?.id || null,
        },
        include: { user: true },
      });
    }

    // Send Email to invitee
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`.replace(':5000', ':5173');
    const emailRes = await emailService.sendProjectInvitation({
      to: email.toLowerCase(),
      projectName: project.name,
      inviterName,
      role,
      inviteToken,
      appUrl,
    });

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        action: 'member_invited',
        actorName: inviterName,
        description: `Sent email invitation to ${email} (${role})`,
      },
    });

    const inviteLink = `${appUrl}/join-project?token=${inviteToken}`;

    res.json({
      success: true,
      member,
      inviteToken,
      inviteLink,
      gmailComposeUrl: emailRes.gmailComposeUrl,
      mailtoUrl: emailRes.mailtoUrl,
      emailSent: emailRes.success,
      previewUrl: emailRes.previewUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/invites/validate - Validate an Invitation Token
projectsRouter.get('/invites/validate', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invite token is required' });
    }

    const member = await prisma.projectMember.findUnique({
      where: { inviteToken: token },
      include: {
        project: {
          include: {
            user: true,
            modules: { include: { module: true } },
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Invalid or expired invitation link' });
    }

    res.json({
      valid: true,
      member: {
        id: member.id,
        email: member.email,
        role: member.role,
        status: member.status,
      },
      project: {
        id: member.project.id,
        name: member.project.name,
        description: member.project.description,
        ownerName: member.project.user?.name || 'Project Owner',
        modulesCount: member.project.modules.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/invites/accept - Accept Invitation and Join Project
projectsRouter.post('/invites/accept', async (req, res) => {
  try {
    const { token, userName } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Invite token is required' });
    }

    const member = await prisma.projectMember.findUnique({
      where: { inviteToken: token },
      include: { project: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Invalid or expired invitation link' });
    }

    // Update member status to accepted
    const updatedMember = await prisma.projectMember.update({
      where: { id: member.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
      include: { project: true },
    });

    const displayName = userName || member.email.split('@')[0];

    // Log Activity
    await prisma.projectActivity.create({
      data: {
        projectId: member.projectId,
        action: 'member_joined',
        actorName: displayName,
        description: `${displayName} accepted invitation and joined as ${member.role}`,
      },
    });

    // Broadcast realtime event
    realtimeEventManager.broadcastToProject(member.projectId, {
      type: 'MEMBER_JOINED',
      author: displayName,
      message: `${displayName} joined the team!`,
      status: 'synced',
    });

    res.json({
      success: true,
      projectId: member.projectId,
      project: updatedMember.project,
      member: updatedMember,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id/members/:memberId - Remove Team Member
projectsRouter.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    await prisma.projectMember.delete({ where: { id: memberId } });
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/modules/:pmId/connect-repo - Connect/Update GitHub Repo to Module
projectsRouter.post('/:id/modules/:pmId/connect-repo', async (req, res) => {
  try {
    const { id, pmId } = req.params;
    const { githubRepository, githubBranch = 'main' } = req.body;

    if (!githubRepository || !githubRepository.includes('/')) {
      return res.status(400).json({ error: 'Valid repository format required (e.g. company/crm)' });
    }

    const cleanRepo = githubRepository.trim().toLowerCase();
    const cleanBranch = githubBranch.trim() || 'main';

    const pm = await prisma.projectModule.update({
      where: { id: pmId },
      data: {
        githubRepository: cleanRepo,
        githubBranch: cleanBranch,
        deploymentStatus: 'synced',
        lastSyncedAt: new Date(),
      },
      include: { module: true },
    });

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        moduleName: pm.module.name,
        action: 'repo_connected',
        actorName: 'Developer',
        description: `Connected GitHub repository ${cleanRepo} (${cleanBranch})`,
      },
    });

    res.json({ success: true, projectModule: pm });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/modules/:pmId/sync - Manual Sync & Build Trigger
projectsRouter.post('/:id/modules/:pmId/sync', async (req, res) => {
  try {
    const { id, pmId } = req.params;

    const pm = await prisma.projectModule.findUnique({
      where: { id: pmId },
      include: { module: true, project: true },
    });

    if (!pm) {
      return res.status(404).json({ error: 'Project module not found' });
    }

    const newCommitSha = `${Date.now().toString(16).slice(-7)}`;
    const { deploymentProvider } = require('../services/deploymentProvider');

    await prisma.projectModule.update({
      where: { id: pmId },
      data: { deploymentStatus: 'updating' },
    });

    const deployRes = await deploymentProvider.deploy({
      moduleName: pm.module.name,
      commitSha: newCommitSha,
      port: pm.module.frontendPort || 5173,
    });

    const updatedPm = await prisma.projectModule.update({
      where: { id: pmId },
      data: {
        currentCommitSha: newCommitSha,
        deploymentUrl: deployRes.deploymentUrl,
        deploymentStatus: 'synced',
        lastSyncedAt: new Date(),
      },
      include: { module: true },
    });

    await prisma.moduleDeployment.create({
      data: {
        projectModuleId: pmId,
        commitSha: newCommitSha,
        commitMessage: 'Manual sync & build trigger',
        author: 'Developer',
        deploymentUrl: deployRes.deploymentUrl,
        status: 'success',
        buildLogs: deployRes.buildLogs,
      },
    });

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        moduleName: pm.module.name,
        action: 'synced',
        actorName: 'Developer',
        description: `Manual sync completed (${newCommitSha})`,
        commitSha: newCommitSha,
        status: 'synced',
      },
    });

    res.json({ success: true, projectModule: updatedPm, deploymentUrl: deployRes.deploymentUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/modules/:pmId/redeploy - Trigger Manual Redeploy
projectsRouter.post('/:id/modules/:pmId/redeploy', async (req, res) => {
  try {
    const { id, pmId } = req.params;

    const pm = await prisma.projectModule.findUnique({
      where: { id: pmId },
      include: { module: true },
    });

    if (!pm) {
      return res.status(404).json({ error: 'Project module not found' });
    }

    const commitSha = pm.currentCommitSha || `${Date.now().toString(16).slice(-7)}`;
    const { deploymentProvider } = require('../services/deploymentProvider');

    const deployRes = await deploymentProvider.deploy({
      moduleName: pm.module.name,
      commitSha,
      port: pm.module.frontendPort || 5173,
    });

    const updatedPm = await prisma.projectModule.update({
      where: { id: pmId },
      data: {
        deploymentUrl: deployRes.deploymentUrl,
        deploymentStatus: 'synced',
        lastSyncedAt: new Date(),
      },
      include: { module: true },
    });

    await prisma.moduleDeployment.create({
      data: {
        projectModuleId: pmId,
        commitSha,
        commitMessage: 'Manual redeploy trigger',
        author: 'Developer',
        deploymentUrl: deployRes.deploymentUrl,
        status: 'success',
        buildLogs: deployRes.buildLogs,
      },
    });

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        moduleName: pm.module.name,
        action: 'deployed',
        actorName: 'Developer',
        description: `Redeployed module ${pm.module.name}`,
        commitSha,
        status: 'synced',
      },
    });

    res.json({ success: true, projectModule: updatedPm });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id/events - Realtime SSE Event Stream for Team Collaboration
projectsRouter.get('/:id/events', async (req, res) => {
  const { id } = req.params;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send initial ping connection event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', projectId: id, message: 'Connected to ModuleForge Realtime Event Stream', timestamp: new Date().toISOString() })}\n\n`);

  // Register client
  const unregister = realtimeEventManager.registerClient(id, res);

  // Keep connection alive with heartbeat every 25 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregister();
  });
});

// POST /api/projects/:id/sync - Sync entire project / connected GitHub modules
projectsRouter.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: { module: true },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Trigger activity and broadcast update
    await prisma.projectActivity.create({
      data: {
        projectId: id,
        moduleName: project.name,
        action: 'synced',
        actorName: 'Developer',
        description: 'Manual project sync check completed',
        status: 'synced',
      },
    });

    realtimeEventManager.broadcastToProject(id, {
      type: 'PROJECT_SYNCED',
      message: `Project "${project.name}" synchronized`,
      status: 'synced',
    });

    res.json({ success: true, project });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/modules/:pmId/sync - Manually Trigger Sync for Single Module
projectsRouter.post('/:id/modules/:pmId/sync', async (req, res) => {
  try {
    const { id, pmId } = req.params;
    const pm = await prisma.projectModule.findUnique({
      where: { id: pmId },
      include: { module: true },
    });

    if (!pm) {
      return res.status(404).json({ error: 'Project module not found' });
    }

    const now = new Date();
    const updatedPm = await prisma.projectModule.update({
      where: { id: pmId },
      data: {
        deploymentStatus: 'synced',
        lastSyncedAt: now,
      },
      include: { module: true },
    });

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        moduleName: pm.module.name,
        action: 'synced',
        actorName: pm.ownerName || 'Developer',
        description: `Manual sync verified for ${pm.module.name}`,
        commitSha: pm.currentCommitSha || 'latest',
        status: 'synced',
      },
    });

    realtimeEventManager.broadcastToProject(id, {
      type: 'MODULE_UPDATED',
      moduleId: pm.moduleId,
      moduleName: pm.module.name,
      commitSha: pm.currentCommitSha || 'latest',
      author: pm.ownerName || 'Developer',
      message: `Synchronized ${pm.module.name}`,
      status: 'synced',
    });

    res.json({ success: true, projectModule: updatedPm });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/modules/:pmId/rollback - Rollback to Previous Deployment
projectsRouter.post('/:id/modules/:pmId/rollback', async (req, res) => {
  try {
    const { id, pmId } = req.params;
    const { previousCommitSha } = req.body;

    if (!previousCommitSha) {
      return res.status(400).json({ error: 'previousCommitSha is required' });
    }

    const { deploymentProvider } = require('../services/deploymentProvider');
    const rollbackRes = await deploymentProvider.rollback(pmId, previousCommitSha);

    const pm = await prisma.projectModule.findUnique({
      where: { id: pmId },
      include: { module: true },
    });

    const updatedPm = await prisma.projectModule.update({
      where: { id: pmId },
      data: {
        currentCommitSha: previousCommitSha,
        deploymentStatus: 'synced',
        lastSyncedAt: new Date(),
      },
      include: { module: true },
    });

    await prisma.projectActivity.create({
      data: {
        projectId: id,
        moduleName: pm?.module.name,
        action: 'rollback',
        actorName: pm?.ownerName || 'Developer',
        description: `Rolled back to commit ${previousCommitSha.slice(0, 7)}`,
        commitSha: previousCommitSha,
        status: 'synced',
      },
    });

    realtimeEventManager.broadcastToProject(id, {
      type: 'ROLLBACK_COMPLETED',
      moduleId: pm?.moduleId,
      moduleName: pm?.module.name,
      commitSha: previousCommitSha,
      author: pm?.ownerName || 'Developer',
      message: `Rolled back to commit ${previousCommitSha.slice(0, 7)}`,
      status: 'synced',
    });

    res.json({ success: true, projectModule: updatedPm, deploymentUrl: rollbackRes.deploymentUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id/modules/:pmId/logs - Fetch Build & Deployment Logs
projectsRouter.get('/:id/modules/:pmId/logs', async (req, res) => {
  try {
    const { pmId } = req.params;
    const deployments = await prisma.moduleDeployment.findMany({
      where: { projectModuleId: pmId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(deployments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id/activity - Fetch Project Activity Timeline
projectsRouter.get('/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const activities = await prisma.projectActivity.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


