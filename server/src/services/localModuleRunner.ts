import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import axios from 'axios';
import { prisma } from '../prisma';

export interface ModuleProcessState {
  pmId: string;
  moduleName: string;
  status: 'stopped' | 'starting' | 'running' | 'error';
  frontendPort: number;
  backendPort?: number;
  frontendUrl: string;
  backendUrl?: string;
  frontendPid?: number;
  backendPid?: number;
  logs: string[];
  dbRequired?: string;
  dbNotice?: string;
}

export interface ProcessEntry {
  state: ModuleProcessState;
  frontendProc?: ChildProcess;
  backendProc?: ChildProcess;
}

export class LocalModuleRunner {
  private activeProcesses = new Map<string, ProcessEntry>();

  // Check if a port is available; if in use, find next available port
  async findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    while (port < startPort + 100) {
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) return port;
      port++;
    }
    return startPort;
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
  }

  // Open browser at localhost URL
  async openBrowser(url: string): Promise<void> {
    try {
      const platform = process.platform;
      if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
      } else if (platform === 'darwin') {
        spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
      }
    } catch (e: any) {
      console.warn('Could not auto-open browser:', e.message);
    }
  }

  // Ensure module files are extracted and locate directory with package.json
  private async ensureModuleDirectory(mod: any, logFn: (msg: string) => void): Promise<string> {
    const rootUploads = path.join(__dirname, '..', '..', 'uploads');
    const extractedBase = path.join(rootUploads, 'extracted', mod.id);

    // 1. Check workspace modules directory first (e.g. ./modules/CRM)
    const workspaceModDir = path.resolve(process.cwd(), 'modules', mod.name);
    if (fs.existsSync(path.join(workspaceModDir, 'package.json'))) {
      logFn(`[Dir] Using workspace module directory: ${workspaceModDir}`);
      return workspaceModDir;
    }

    // 2. Check if already extracted
    const existingPkgDir = this.findPackageJsonDir(extractedBase);
    if (existingPkgDir) {
      logFn(`[Dir] Found existing extracted module at: ${existingPkgDir}`);
      return existingPkgDir;
    }

    fs.mkdirSync(extractedBase, { recursive: true });

    // 3. Extract from mod.zipStoragePath if available
    if (mod.zipStoragePath && fs.existsSync(mod.zipStoragePath)) {
      logFn(`[Extract] Extracting local archive "${path.basename(mod.zipStoragePath)}"...`);
      try {
        const zipBuf = fs.readFileSync(mod.zipStoragePath);
        await this.extractZipBufferToDisk(zipBuf, extractedBase);
      } catch (e: any) {
        logFn(`[Extract ERR] ${e.message}`);
      }
    } else if (mod.githubOwner && mod.githubRepo) {
      // 4. Download from GitHub if missing
      logFn(`[GitHub] Fetching repository ${mod.githubOwner}/${mod.githubRepo}...`);
      try {
        const zipUrl = `https://codeload.github.com/${mod.githubOwner}/${mod.githubRepo}/zip/refs/heads/${mod.githubBranch || 'main'}`;
        const zipRes = await axios.get(zipUrl, { responseType: 'arraybuffer', timeout: 20000 });
        if (zipRes.data) {
          await this.extractZipBufferToDisk(Buffer.from(zipRes.data), extractedBase);
        }
      } catch (e: any) {
        logFn(`[GitHub ERR] ${e.message}`);
      }
    }

    // 5. Locate package.json in extracted directory
    const foundPkgDir = this.findPackageJsonDir(extractedBase);
    if (foundPkgDir) {
      logFn(`[Dir] Located module source at: ${foundPkgDir}`);
      return foundPkgDir;
    }

    // 6. Fallback: Create lightweight runnable static app structure
    logFn(`[Fallback] Initializing static application server in ${extractedBase}...`);
    const pkgJsonPath = path.join(extractedBase, 'package.json');
    const indexHtmlPath = path.join(extractedBase, 'index.html');

    const pkgJsonContent = {
      name: mod.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      version: '1.0.0',
      description: mod.description || '',
      scripts: {
        dev: 'npx -y serve -s . -p 5173',
        start: 'npx -y serve -s . -p 5173',
      },
    };

    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${mod.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; padding: 40px; }
    h1 { color: #3b82f6; }
    .card { background: #1e293b; padding: 24px; border-radius: 16px; max-width: 600px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📦 ${mod.name} (Original Module)</h1>
    <p>${mod.description}</p>
    <p><strong>Category:</strong> ${mod.categoryName}</p>
    <p><strong>Author:</strong> ${mod.author}</p>
    <p style="color: #10b981; font-weight: bold;">🟢 Running on localhost</p>
  </div>
</body>
</html>`;

    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJsonContent, null, 2));
    fs.writeFileSync(indexHtmlPath, indexHtmlContent);

    return extractedBase;
  }

  // Recursive search for folder containing package.json
  private findPackageJsonDir(basePath: string): string | null {
    if (!fs.existsSync(basePath)) return null;

    if (fs.existsSync(path.join(basePath, 'package.json'))) {
      return basePath;
    }

    const items = fs.readdirSync(basePath, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith('.')) {
        const subPath = path.join(basePath, item.name);
        if (fs.existsSync(path.join(subPath, 'package.json'))) {
          return subPath;
        }
      }
    }

    return null;
  }

  // Unzip archive buffer directly to target directory
  private async extractZipBufferToDisk(zipBuffer: Buffer, targetDir: string): Promise<void> {
    const zip = await JSZip.loadAsync(zipBuffer);
    for (const relativePath of Object.keys(zip.files)) {
      const zipEntry = zip.files[relativePath];
      const outPath = path.join(targetDir, relativePath);
      if (zipEntry.dir) {
        fs.mkdirSync(outPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const content = await zipEntry.async('nodebuffer');
        fs.writeFileSync(outPath, content);
      }
    }
  }

  async startModule(params: {
    projectId: string;
    pmId: string;
    openBrowserAfter?: boolean;
  }): Promise<ModuleProcessState> {
    const { pmId, openBrowserAfter = true } = params;

    // Check if already running
    const existing = this.activeProcesses.get(pmId);
    if (existing && existing.state.status === 'running') {
      if (openBrowserAfter && existing.state.frontendUrl) {
        await this.openBrowser(existing.state.frontendUrl);
      }
      return existing.state;
    }

    const pm = await prisma.projectModule.findUnique({
      where: { id: pmId },
      include: { module: true },
    });

    if (!pm) {
      throw new Error('Project module not found');
    }

    const mod = pm.module;
    const moduleName = mod.name;

    // 1. Allocate Available Ports
    const preferredFrontendPort = mod.frontendPort || 5173;
    const preferredBackendPort = mod.backendPort || 5000;

    const frontendPort = await this.findAvailablePort(preferredFrontendPort);
    const backendPort = mod.backendCommand ? await this.findAvailablePort(preferredBackendPort) : undefined;

    const frontendUrl = `http://localhost:${frontendPort}`;
    const backendUrl = backendPort ? `http://localhost:${backendPort}` : undefined;

    const state: ModuleProcessState = {
      pmId,
      moduleName,
      status: 'starting',
      frontendPort,
      backendPort,
      frontendUrl,
      backendUrl,
      logs: [`[${new Date().toLocaleTimeString()}] 🚀 Launching module "${moduleName}"...`],
    };

    const processEntry: ProcessEntry = { state };
    this.activeProcesses.set(pmId, processEntry);

    const appendLog = (prefix: string, data: any) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        state.logs.push(`[${prefix}] ${line}`);
        if (state.logs.length > 500) state.logs.shift();
      }
    };

    // 2. Resolve Module Source Working Directory
    const workingDir = await this.ensureModuleDirectory(mod, (msg) => state.logs.push(msg));

    // 3. Start Backend Process (if configured)
    if (mod.backendCommand && mod.backendCommand.trim()) {
      try {
        const backendParts = mod.backendCommand.trim().split(/\s+/);
        const cmd = backendParts[0];
        const args = backendParts.slice(1);

        state.logs.push(`[Backend] Executing "${mod.backendCommand}" in ${workingDir} (Port ${backendPort})`);

        const bProc = spawn(cmd, args, {
          cwd: workingDir,
          shell: true,
          env: { ...process.env, PORT: String(backendPort) },
        });

        processEntry.backendProc = bProc;
        state.backendPid = bProc.pid;

        bProc.stdout?.on('data', (data) => appendLog('Backend', data));
        bProc.stderr?.on('data', (data) => appendLog('Backend ERR', data));

        bProc.on('error', (err) => {
          appendLog('Backend ERR', err.message);
        });
      } catch (e: any) {
        appendLog('Backend ERR', e.message);
      }
    }

    // 4. Start Frontend Process
    try {
      const frontendCmdStr = mod.frontendCommand || 'npm run dev';
      const frontendParts = frontendCmdStr.trim().split(/\s+/);
      const cmd = frontendParts[0];
      const args = frontendParts.slice(1);

      state.logs.push(`[Frontend] Executing "${frontendCmdStr}" in ${workingDir} (Port ${frontendPort})`);

      const fProc = spawn(cmd, args, {
        cwd: workingDir,
        shell: true,
        env: { ...process.env, PORT: String(frontendPort), VITE_PORT: String(frontendPort) },
      });

      processEntry.frontendProc = fProc;
      state.frontendPid = fProc.pid;

      fProc.stdout?.on('data', (data) => appendLog('Frontend', data));
      fProc.stderr?.on('data', (data) => appendLog('Frontend ERR', data));

      fProc.on('error', (err) => {
        appendLog('Frontend ERR', err.message);
        state.status = 'error';
      });
    } catch (e: any) {
      appendLog('Frontend ERR', e.message);
      state.status = 'error';
    }

    // Set to running & update DB
    state.status = 'running';
    state.logs.push(`[${new Date().toLocaleTimeString()}] 🟢 Module "${moduleName}" is running at ${frontendUrl}`);

    await prisma.projectModule.update({
      where: { id: pmId },
      data: {
        deploymentUrl: frontendUrl,
        deploymentStatus: 'synced',
        lastSyncedAt: new Date(),
      },
    });

    if (openBrowserAfter) {
      setTimeout(() => {
        this.openBrowser(frontendUrl);
      }, 1500);
    }

    return state;
  }

  async stopModule(pmId: string): Promise<ModuleProcessState> {
    const entry = this.activeProcesses.get(pmId);
    if (entry) {
      if (entry.frontendProc) {
        try {
          entry.frontendProc.kill('SIGTERM');
        } catch (e) {}
      }
      if (entry.backendProc) {
        try {
          entry.backendProc.kill('SIGTERM');
        } catch (e) {}
      }
      entry.state.status = 'stopped';
      entry.state.logs.push(`[${new Date().toLocaleTimeString()}] ⚪ Module process stopped.`);
      this.activeProcesses.delete(pmId);
      return entry.state;
    }

    return {
      pmId,
      moduleName: 'Module',
      status: 'stopped',
      frontendPort: 5173,
      frontendUrl: '',
      logs: ['Module is not running.'],
    };
  }

  getStatus(pmId: string): ModuleProcessState {
    const entry = this.activeProcesses.get(pmId);
    if (entry) {
      return entry.state;
    }
    return {
      pmId,
      moduleName: 'Module',
      status: 'stopped',
      frontendPort: 5173,
      frontendUrl: '',
      logs: [],
    };
  }

  getAllStatuses(): ModuleProcessState[] {
    return Array.from(this.activeProcesses.values()).map((e) => e.state);
  }

  getLogs(pmId: string): string[] {
    const entry = this.activeProcesses.get(pmId);
    return entry ? entry.state.logs : ['No running logs available.'];
  }
}

export const localModuleRunner = new LocalModuleRunner();
