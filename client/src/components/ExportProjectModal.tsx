import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  X,
  Terminal,
  FileCode,
  Package,
  Github,
  Lock,
  Globe,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '../types';
import { useProjectStore } from '../store/useProjectStore';

interface ExportProjectModalProps {
  project: Project;
  onClose: () => void;
}

export const ExportProjectModal: React.FC<ExportProjectModalProps> = ({ project, onClose }) => {
  const { exportProjectZip, createGitHubRepo } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'github' | 'zip' | 'prompt'>('github');

  // ZIP State
  const [isCopied, setIsCopied] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  // GitHub Creation State
  const defaultRepoName = (project.name || 'my-project')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [repoDesc, setRepoDesc] = useState(project.description || `Assembled from ModuleForge Platform - ${project.name}`);
  const [isPrivate, setIsPrivate] = useState(true);
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('moduleforge_github_token') || '');
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [repoResult, setRepoResult] = useState<{
    success: boolean;
    repoUrl?: string;
    cloneUrl?: string;
    repoName?: string;
    error?: string;
  } | null>(null);

  let portCounter = 3000;
  const moduleRuntimeSpecs = project.modules && project.modules.length > 0
    ? project.modules
        .map((pm, idx) => {
          const modName = pm.module?.name || `Module ${idx + 1}`;
          const assignedPort = pm.module?.frontendPort && pm.module.frontendPort !== 5173
            ? pm.module.frontendPort
            : (portCounter++);
          const defaultCmd = pm.module?.frontendCommand || `npx vite --host 0.0.0.0 --port ${assignedPort} --strictPort`;
          return `  - **Module ${idx + 1}** (\`${modName}\`): Port \`${assignedPort}\` via \`${defaultCmd}\``;
        })
        .join('\n')
    : '  - No modules selected.';

  const promptText = `TASK: Unified Multi-Module Application Shell & Process Orchestrator
Create a single, unified Application Shell platform (\`/shell\`) and a background local process runner (\`/launcher\`) to run all software modules located in \`/modules\` seamlessly under ONE platform interface.

---

### ⚠️ STRICT COMPLIANCE RULES:
1. **DO NOT MODIFY MODULE CODE**: Do not rebuild, redesign, or edit any files, CSS, endpoints, database schemas, or logic inside \`/modules\`. All original modules must remain 100% intact and untouched.
2. **SINGLE UNIFIED PLATFORM**: The user must only ever need to access ONE URL (e.g. \`http://localhost:4567\`). All modules must run embedded inside this platform without spawning separate browser popups or requiring manual port navigation.

---

### 🛠️ ARCHITECTURE SPECIFICATIONS:

#### 1. Deterministic Port & Runtime Configuration (\`module-runtime.json\`)
- Assign distinct, non-overlapping ports and strict launch commands to prevent port bumping or collision:
${moduleRuntimeSpecs}
  - **Platform Host**: Port \`4567\`.

#### 2. Local Process Launcher (\`/launcher/launcher.js\`)
- An Express server running on port \`4567\` that:
  - Serves the \`/shell\` directory as static files on the root (\`http://localhost:4567\`).
  - Automatically spawns child processes for all configured modules in their respective working directories with cross-platform shell support.
  - Handles clean process termination on Windows (\`taskkill /F /T /PID\`) and POSIX (\`proc.kill()\`).
  - Does NOT automatically pop open separate browser tabs for individual ports.
  - Provides REST endpoints: \`GET /status\`, \`GET /modules\`, \`POST /start-module\`, and \`POST /stop-module\`.

#### 3. High-Speed Shell UI (\`/shell/index.html\`)
- **Aesthetic**: Premium design (soft background \`#F7F8F7\`, emerald \`#1F5E4B\` header and accents, crisp \`#FFFFFF\` cards, glowing active status badges).
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
4. Verify HTTP 200 responses across all module ports and launch \`http://localhost:4567\`.`;

  const handleDownload = () => {
    exportProjectZip(project.id);
    setHasDownloaded(true);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleCreateGitHubRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) return;

    setIsCreatingRepo(true);
    setRepoResult(null);

    if (githubToken.trim()) {
      localStorage.setItem('moduleforge_github_token', githubToken.trim());
    }

    const res = await createGitHubRepo(project.id, {
      repoName: repoName.trim(),
      description: repoDesc.trim(),
      isPrivate,
      githubToken: githubToken.trim() || undefined,
    });

    setIsCreatingRepo(false);
    setRepoResult(res);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="bg-white border border-[#E2E6E4] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 relative my-6 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-white p-5 border-b border-[#E2E6E4] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202524]">Publish & Export Project</h2>
              <p className="text-xs text-[#6B7471]">
                Export unified multi-frontend architecture for <strong className="text-[#202524]">{project.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition border border-transparent hover:border-[#E2E6E4]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3 border-b border-[#E2E6E4] bg-[#FAFBFA] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('github')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'github'
                ? 'border-[#1F5E4B] text-[#1F5E4B] bg-white'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>Create GitHub Repo</span>
            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-mono bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
              New
            </span>
          </button>

          <button
            onClick={() => setActiveTab('zip')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'zip'
                ? 'border-[#1F5E4B] text-[#1F5E4B] bg-white'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download ZIP Package</span>
          </button>

          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'prompt'
                ? 'border-[#1F5E4B] text-[#1F5E4B] bg-white'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>AI Orchestrator Prompt</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-white">
          {/* TAB 1: GITHUB REPO CREATION */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-xs text-[#202524] space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#1F5E4B]">
                  <Sparkles className="w-4 h-4" />
                  <span>Automatic Frontend Fusion & Repo Creation</span>
                </div>
                <p className="text-[11px] text-[#6B7471] leading-relaxed">
                  ModuleForge will automatically synthesize a <strong>Master Vite + React Frontend Portal</strong> linking all {project.modules?.length || 0} module frontends, assemble the microservice orchestrator, and push everything to a new GitHub repository on your account.
                </p>
              </div>

              {repoResult?.success ? (
                <div className="p-6 rounded-3xl bg-[#F0F9F5] border border-[#2E7D5B]/30 space-y-4 text-center animate-fade-in">
                  <div className="w-12 h-12 rounded-2xl bg-[#2E7D5B] text-white flex items-center justify-center mx-auto shadow-md shadow-[#2E7D5B]/20">
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#202524]">GitHub Repository Live!</h3>
                    <p className="text-xs text-[#6B7471] mt-1">
                      Your unified multi-frontend application has been pushed to GitHub.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#E2E6E4] text-left space-y-3 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#6B7471]">Repository URL:</span>
                      <a
                        href={repoResult.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1F5E4B] hover:underline font-bold font-mono inline-flex items-center gap-1"
                      >
                        <span>{repoResult.repoUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-[#6B7471] block">Clone Command:</span>
                      <div className="p-2.5 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] font-mono text-xs text-[#202524] flex items-center justify-between">
                        <code>git clone {repoResult.cloneUrl}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`git clone ${repoResult.cloneUrl}`);
                            alert('Copied git clone command!');
                          }}
                          className="p-1 rounded-lg text-[#6B7471] hover:text-[#1F5E4B] hover:bg-white transition"
                          title="Copy clone command"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <a
                    href={repoResult.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition"
                  >
                    <span>Open on GitHub</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <form onSubmit={handleCreateGitHubRepo} className="space-y-4">
                  {repoResult?.error && (
                    <div className="p-3.5 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-medium">
                      {repoResult.error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524] block">
                      Repository Name *
                    </label>
                    <input
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="e.g. enterprise-crm-portal"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] font-mono focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524] block">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={repoDesc}
                      onChange={(e) => setRepoDesc(e.target.value)}
                      placeholder="Unified Multi-Module Application"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                    />
                  </div>

                  {/* Visibility & PAT Token */}
                  <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#202524]">
                        <input
                          type="checkbox"
                          checked={isPrivate}
                          onChange={(e) => setIsPrivate(e.target.checked)}
                          className="w-4 h-4 rounded text-[#1F5E4B] focus:ring-[#1F5E4B]"
                        />
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-[#1F5E4B]" />
                          <span>Private Repository</span>
                        </div>
                      </label>

                      {localStorage.getItem('moduleforge_github_token') && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#2E7D5B] bg-[#EAF3EF] px-2 py-0.5 rounded-md border border-[#2E7D5B]/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Token saved in Settings</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-[#6B7471] block">
                        GitHub Personal Access Token (PAT)
                      </label>
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_..."
                        className="w-full bg-white border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] placeholder-[#6B7471] font-mono focus:outline-none focus:border-[#1F5E4B]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingRepo || !repoName.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
                  >
                    {isCreatingRepo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating GitHub Repository & Pushing Files...</span>
                      </>
                    ) : (
                      <>
                        <Github className="w-4 h-4" />
                        <span>Create & Push to GitHub</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ZIP ARCHIVE */}
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] text-xs text-[#202524] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#1F5E4B]">
                  <Layers className="w-4 h-4" />
                  <span>Includes Merged Master Frontend + All Modules</span>
                </div>
                <p className="text-[11px] text-[#6B7471] leading-relaxed">
                  Exporting the ZIP generates the complete project folder containing <code>/frontend</code> (Vite + React Master Shell), <code>/launcher</code>, <code>/modules</code>, <code>docker-compose.yml</code>, and <code>.env.example</code>.
                </p>
              </div>

              <button
                onClick={handleDownload}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>{hasDownloaded ? 'Re-download ZIP Package' : 'Download Complete Project (.ZIP)'}</span>
              </button>
            </div>
          )}

          {/* TAB 3: PROMPT */}
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-[#6B7471]">
                <span className="flex items-center gap-1.5 text-[#1F5E4B] font-bold">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>AI Orchestrator Prompt (Also included in export as PROMPT.md)</span>
                </span>
                <button
                  onClick={handleCopyPrompt}
                  className="text-[#1F5E4B] hover:text-[#174739] font-bold text-xs"
                >
                  {isCopied ? 'Copied ✓' : 'Copy Full Prompt'}
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] text-[11px] font-mono text-[#202524] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap select-all">
                {promptText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F7F8F7] border-t border-[#E2E6E4] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-[#EAF3EF] text-[#202524] border border-[#E2E6E4] font-semibold text-xs transition shadow-xs"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
