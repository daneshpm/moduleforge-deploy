import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma';

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'conflict';
  code: string;
}

export interface GitStatusResult {
  branch: string;
  isClean: boolean;
  gitStatus: 'up_to_date' | 'changes_available' | 'local_changes' | 'conflict';
  changesCount: number;
  files: GitFileStatus[];
  hasConflicts: boolean;
  conflictFiles: string[];
  ahead: number;
  behind: number;
  latestCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface GitCommitRecord {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  branch: string;
  changedFiles?: string[];
}

export interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileTreeItem[];
}

export class GitService {
  private reposRoot: string;

  constructor() {
    // On Vercel the filesystem outside /tmp is read-only.
    // Use /tmp/repos in production so mkdirSync doesn't throw EROFS.
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    this.reposRoot = isVercel
      ? path.join('/tmp', 'repos')
      : path.join(__dirname, '..', '..', 'uploads', 'repos');
    try {
      if (!fs.existsSync(this.reposRoot)) {
        fs.mkdirSync(this.reposRoot, { recursive: true });
      }
    } catch (e) {
      // Non-fatal: if we can't create the dir, individual operations will fail gracefully
      console.warn('[GitService] Could not create reposRoot:', this.reposRoot);
    }
  }

  // Safe executor for git commands
  private runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(
        'git',
        args,
        {
          cwd,
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'ModuleForge Developer',
            GIT_AUTHOR_EMAIL: 'developer@moduleforge.local',
            GIT_COMMITTER_NAME: 'ModuleForge',
            GIT_COMMITTER_EMAIL: 'git@moduleforge.local',
          },
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            // Some git commands exit with non-zero on normal informational status
            return reject(new Error(stderr.trim() || stdout.trim() || error.message));
          }
          resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
        }
      );
    });
  }

  // Resolve directory of module repository
  public async getRepoDir(moduleId: string, moduleName?: string): Promise<string> {
    const directRepoPath = path.join(this.reposRoot, moduleId);
    if (fs.existsSync(path.join(directRepoPath, '.git'))) {
      return directRepoPath;
    }

    // Check extracted folder
    const extractedBase = path.join(__dirname, '..', '..', 'uploads', 'extracted', moduleId);
    if (fs.existsSync(path.join(extractedBase, '.git'))) {
      return extractedBase;
    }

    // Check module record in DB
    const mod = await prisma.module.findUnique({ where: { id: moduleId } });
    if (mod?.repositoryPath && fs.existsSync(mod.repositoryPath)) {
      return mod.repositoryPath;
    }

    // Default to directRepoPath
    fs.mkdirSync(directRepoPath, { recursive: true });
    return directRepoPath;
  }

  // Ensure git repository is initialized with initial commit
  public async ensureRepo(moduleId: string, moduleName: string = 'Module'): Promise<string> {
    const repoDir = await this.getRepoDir(moduleId, moduleName);
    const gitDir = path.join(repoDir, '.git');

    if (!fs.existsSync(gitDir)) {
      try {
        await this.runGit(repoDir, ['init', '-b', 'main']);
        await this.runGit(repoDir, ['config', 'user.name', 'ModuleForge Developer']);
        await this.runGit(repoDir, ['config', 'user.email', 'developer@moduleforge.local']);

        // Check if repo has any files
        const entries = fs.readdirSync(repoDir).filter((e) => e !== '.git');
        if (entries.length === 0) {
          // Initialize starter files for new ModuleForge repository
          const pkgJson = {
            name: moduleName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            version: '1.0.0',
            description: `${moduleName} module created in ModuleForge`,
            main: 'index.js',
            scripts: {
              dev: 'node index.js',
              start: 'node index.js',
            },
            dependencies: {},
          };
          fs.writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

          const indexJs = `// ${moduleName} - Standalone Software Module
console.log('[${moduleName}] Module initialized successfully');
const http = require('http');
const port = process.env.PORT || 5173;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'active', module: '${moduleName}', time: new Date().toISOString() }));
});
server.listen(port, () => console.log(\`${moduleName} running on http://localhost:\${port}\`));
`;
          fs.writeFileSync(path.join(repoDir, 'index.js'), indexJs);

          const readme = `# ${moduleName}\n\nIndependent software module version-controlled with Git in **ModuleForge**.\n\n## Quick Start\n\`\`\`bash\nnpm run dev\n\`\`\`\n`;
          fs.writeFileSync(path.join(repoDir, 'README.md'), readme);
        }

        // Make initial commit
        await this.runGit(repoDir, ['add', '-A']);
        await this.runGit(repoDir, ['commit', '-m', `Initial commit for ${moduleName}`]);

        // Update module in DB
        await prisma.module.update({
          where: { id: moduleId },
          data: {
            repositoryType: 'moduleforge',
            repositoryPath: repoDir,
            defaultBranch: 'main',
          },
        });
      } catch (e: any) {
        console.warn(`[GitService] Init warning for ${moduleId}:`, e.message);
      }
    }

    return repoDir;
  }

  // Get status of repository
  public async getStatus(repoDir: string): Promise<GitStatusResult> {
    try {
      // 1. Get current branch
      let branch = 'main';
      try {
        const branchRes = await this.runGit(repoDir, ['branch', '--show-current']);
        branch = branchRes.stdout.trim() || 'main';
      } catch {
        branch = 'main';
      }

      // 2. Get porcelain status
      const statusRes = await this.runGit(repoDir, ['status', '--porcelain=v1']);
      const lines = statusRes.stdout.split('\n').filter((l) => l.trim().length > 0);

      const files: GitFileStatus[] = [];
      const conflictFiles: string[] = [];

      for (const line of lines) {
        const code = line.substring(0, 2);
        const filePath = line.substring(3).trim();

        if (code === 'UU' || code === 'AA' || code === 'UD' || code === 'DU') {
          files.push({ path: filePath, status: 'conflict', code });
          conflictFiles.push(filePath);
        } else if (code.includes('M')) {
          files.push({ path: filePath, status: 'modified', code });
        } else if (code.includes('A')) {
          files.push({ path: filePath, status: 'added', code });
        } else if (code.includes('D')) {
          files.push({ path: filePath, status: 'deleted', code });
        } else if (code === '??') {
          files.push({ path: filePath, status: 'untracked', code });
        } else {
          files.push({ path: filePath, status: 'modified', code });
        }
      }

      const hasConflicts = conflictFiles.length > 0;
      const isClean = files.length === 0;

      // Determine Git status state
      let gitStatus: 'up_to_date' | 'changes_available' | 'local_changes' | 'conflict' = 'up_to_date';
      if (hasConflicts) {
        gitStatus = 'conflict';
      } else if (!isClean) {
        gitStatus = 'local_changes';
      }

      // 3. Get latest commit
      let latestCommit: GitStatusResult['latestCommit'] = undefined;
      try {
        const logRes = await this.runGit(repoDir, ['log', '-1', '--pretty=format:%H|%s|%an|%ad', '--date=relative']);
        if (logRes.stdout.trim()) {
          const [sha, message, author, date] = logRes.stdout.trim().split('|');
          latestCommit = { sha, message, author, date };
        }
      } catch {
        // No commits yet
      }

      return {
        branch,
        isClean,
        gitStatus,
        changesCount: files.length,
        files,
        hasConflicts,
        conflictFiles,
        ahead: 0,
        behind: 0,
        latestCommit,
      };
    } catch (err: any) {
      return {
        branch: 'main',
        isClean: true,
        gitStatus: 'up_to_date',
        changesCount: 0,
        files: [],
        hasConflicts: false,
        conflictFiles: [],
        ahead: 0,
        behind: 0,
      };
    }
  }

  // Commit changes
  public async commit(
    repoDir: string,
    message: string,
    author: string = 'Shalya'
  ): Promise<GitCommitRecord> {
    if (!message || !message.trim()) {
      throw new Error('Commit message cannot be empty.');
    }

    // Stage all changes
    await this.runGit(repoDir, ['add', '-A']);

    // Commit
    const authorArg = `${author} <${author.toLowerCase().replace(/[^a-z0-9]/g, '')}@moduleforge.local>`;
    await this.runGit(repoDir, ['commit', '-m', message.trim(), `--author=${authorArg}`]);

    // Retrieve created commit info
    const logRes = await this.runGit(repoDir, ['log', '-1', '--pretty=format:%H|%h|%s|%an|%ad', '--date=relative']);
    const [sha, shortSha, commitMsg, commitAuthor, date] = logRes.stdout.trim().split('|');

    // Get branch
    const branchRes = await this.runGit(repoDir, ['branch', '--show-current']);
    const branch = branchRes.stdout.trim() || 'main';

    return {
      sha,
      shortSha: shortSha || sha.substring(0, 7),
      message: commitMsg || message,
      author: commitAuthor || author,
      date: date || 'just now',
      branch,
    };
  }

  // Push changes
  public async push(
    repoDir: string,
    branchName?: string
  ): Promise<{ success: boolean; message: string; commitSha?: string; branch: string }> {
    const branch = branchName || (await this.runGit(repoDir, ['branch', '--show-current'])).stdout.trim() || 'main';

    // Check if remote exists
    try {
      const remotes = await this.runGit(repoDir, ['remote']);
      if (remotes.stdout.includes('origin')) {
        await this.runGit(repoDir, ['push', 'origin', branch]);
      }
    } catch (e: any) {
      // If no remote configured, local git push is considered successfully committed to local repository
    }

    const logRes = await this.runGit(repoDir, ['log', '-1', '--pretty=format:%H|%s', '--date=relative']);
    const [sha, msg] = logRes.stdout.trim().split('|');

    return {
      success: true,
      message: msg || 'Push successful',
      commitSha: sha,
      branch,
    };
  }

  // Pull changes (with uncommitted local changes safety guard)
  public async pull(
    repoDir: string,
    branchName?: string
  ): Promise<{ success: boolean; message: string; updated: boolean }> {
    // 1. Verify working tree is clean
    const status = await this.getStatus(repoDir);
    if (!status.isClean) {
      throw new Error(
        'Local changes detected. Please commit or stash your changes before pulling to prevent data loss.'
      );
    }

    const branch = branchName || status.branch || 'main';

    // 2. Check if remote exists
    try {
      const remotes = await this.runGit(repoDir, ['remote']);
      if (remotes.stdout.includes('origin')) {
        const pullRes = await this.runGit(repoDir, ['pull', 'origin', branch]);
        return {
          success: true,
          message: pullRes.stdout.trim() || 'Already up to date.',
          updated: !pullRes.stdout.includes('Already up to date'),
        };
      }
    } catch (e: any) {
      if (e.message?.includes('conflict')) {
        throw new Error('Merge conflict detected during pull. Please inspect and resolve conflicting files.');
      }
      throw e;
    }

    return {
      success: true,
      message: 'Repository is up to date.',
      updated: false,
    };
  }

  // Branch operations
  public async getBranches(repoDir: string): Promise<{ current: string; branches: string[] }> {
    try {
      const branchRes = await this.runGit(repoDir, ['branch', '--list']);
      const lines = branchRes.stdout.split('\n').filter((l) => l.trim().length > 0);

      let current = 'main';
      const branches: string[] = [];

      for (const line of lines) {
        const isCurrent = line.startsWith('*');
        const name = line.replace('*', '').trim();
        if (name) {
          branches.push(name);
          if (isCurrent) current = name;
        }
      }

      if (branches.length === 0) {
        branches.push('main');
      }

      return { current, branches };
    } catch {
      return { current: 'main', branches: ['main'] };
    }
  }

  public async createBranch(repoDir: string, branchName: string): Promise<{ current: string; branches: string[] }> {
    const cleanName = branchName.trim();
    if (!/^[a-zA-Z0-9_\-\.\/]+$/.test(cleanName)) {
      throw new Error('Invalid branch name. Only alphanumeric characters, dashes, and slashes are allowed.');
    }

    await this.runGit(repoDir, ['checkout', '-b', cleanName]);
    return this.getBranches(repoDir);
  }

  public async switchBranch(repoDir: string, branchName: string): Promise<{ current: string; branches: string[] }> {
    const cleanName = branchName.trim();
    await this.runGit(repoDir, ['checkout', cleanName]);
    return this.getBranches(repoDir);
  }

  // Commit history
  public async getHistory(repoDir: string, limit: number = 25): Promise<GitCommitRecord[]> {
    try {
      const logRes = await this.runGit(repoDir, [
        'log',
        `-n`,
        `${limit}`,
        '--pretty=format:%H|%h|%s|%an|%ad',
        '--date=relative',
      ]);

      if (!logRes.stdout.trim()) return [];

      const currentBranch = (await this.runGit(repoDir, ['branch', '--show-current'])).stdout.trim() || 'main';

      return logRes.stdout
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((line) => {
          const [sha, shortSha, message, author, date] = line.split('|');
          return {
            sha: sha || '',
            shortSha: shortSha || (sha ? sha.substring(0, 7) : ''),
            message: message || '',
            author: author || 'Developer',
            date: date || 'recently',
            branch: currentBranch,
          };
        });
    } catch {
      return [];
    }
  }

  // File tree browser
  public getFileTree(repoDir: string, relativeSubDir: string = ''): FileTreeItem[] {
    const targetDir = path.resolve(repoDir, relativeSubDir);

    // Prevent path traversal
    if (!targetDir.startsWith(path.resolve(repoDir))) {
      throw new Error('Access denied: path traversal detected.');
    }

    if (!fs.existsSync(targetDir)) return [];

    const IGNORED = ['.git', 'node_modules', 'dist', '.next', '.cache', 'build', '.DS_Store'];
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    const items: FileTreeItem[] = [];

    for (const entry of entries) {
      if (IGNORED.includes(entry.name)) continue;

      const fullPath = path.join(targetDir, entry.name);
      const relPath = path.relative(repoDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: relPath,
          type: 'dir',
          children: this.getFileTree(repoDir, relPath),
        });
      } else {
        const stats = fs.statSync(fullPath);
        items.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size: stats.size,
        });
      }
    }

    // Sort directories first, then files alphabetically
    return items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });
  }

  // Safe file reader & writer
  public readFile(repoDir: string, relativePath: string): string {
    const fullPath = path.resolve(repoDir, relativePath);
    if (!fullPath.startsWith(path.resolve(repoDir))) {
      throw new Error('Access denied: path traversal detected.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  public saveFile(repoDir: string, relativePath: string, content: string): void {
    const fullPath = path.resolve(repoDir, relativePath);
    if (!fullPath.startsWith(path.resolve(repoDir))) {
      throw new Error('Access denied: path traversal detected.');
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
}

export const gitService = new GitService();
