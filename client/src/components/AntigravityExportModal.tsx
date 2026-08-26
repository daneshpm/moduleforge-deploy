import React, { useState } from 'react';
import { Sparkles, Download, Copy, Check, X, Terminal, ArrowRight, Layers, ExternalLink } from 'lucide-react';
import { Project } from '../types';
import { useProjectStore } from '../store/useProjectStore';

interface AntigravityExportModalProps {
  project: Project;
  onClose: () => void;
}

export const AntigravityExportModal: React.FC<AntigravityExportModalProps> = ({ project, onClose }) => {
  const { exportProjectZip, openProjectInAntigravity } = useProjectStore();
  const [isCopied, setIsCopied] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [isOpeningAntigravity, setIsOpeningAntigravity] = useState(false);
  const [antigravitySuccessMsg, setAntigravitySuccessMsg] = useState<string | null>(null);

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

  const antigravityPrompt = `TASK: Unified Multi-Module Application Shell & Process Orchestrator
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
4. Verify HTTP 200 responses across all module ports and launch \`http://localhost:4567\`.`;

  const handleDownload = () => {
    exportProjectZip(project.id);
    setHasDownloaded(true);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(antigravityPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleDirectLaunchAntigravity = async () => {
    setIsOpeningAntigravity(true);
    setAntigravitySuccessMsg(null);
    try {
      const result = await openProjectInAntigravity(project.id);
      if (result.success) {
        setIsCopied(true);
        setAntigravitySuccessMsg('🚀 Workspace opened in Antigravity! Original prompt copied to clipboard.');
      } else {
        setAntigravitySuccessMsg(result.error || 'Could not redirect automatically.');
      }
    } catch (e: any) {
      setAntigravitySuccessMsg(e.message);
    } finally {
      setIsOpeningAntigravity(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 relative my-6">
        {/* Header Accent Bar */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Direct Redirection to Antigravity</h2>
              <p className="text-xs text-indigo-100 mt-0.5">
                Unified Multi-Module Platform Orchestrator for <strong className="text-white">{project.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Main 1-Click Launch Button */}
          <button
            onClick={handleDirectLaunchAntigravity}
            disabled={isOpeningAntigravity}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white font-extrabold text-sm shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-3 transition transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span>{isOpeningAntigravity ? 'Opening Antigravity...' : '🚀 Open Directly in Google Antigravity'}</span>
            <ExternalLink className="w-4 h-4 text-white/80" />
          </button>

          {antigravitySuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{antigravitySuccessMsg}</span>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="py-3 px-4 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>{hasDownloaded ? 'Re-download ZIP' : 'Download Project ZIP'}</span>
            </button>

            <button
              onClick={handleCopyPrompt}
              className="py-3 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-purple-400" />}
              <span>{isCopied ? 'Copied Prompt ✓' : 'Copy Antigravity Prompt'}</span>
            </button>
          </div>

          {/* Prompt Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                <span>AI Agent Prompt (ANTIGRAVITY_PROMPT.md)</span>
              </span>
              <button
                onClick={handleCopyPrompt}
                className="text-purple-400 hover:text-purple-300 font-semibold"
              >
                {isCopied ? 'Copied ✓' : 'Copy Full Prompt'}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
              {antigravityPrompt}
            </pre>
          </div>

          {/* 3-Step Walkthrough Guide */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-slate-200 font-mono flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>When you extract the ZIP, use this prompt:</span>
            </h4>
            <ol className="space-y-1.5 text-slate-400 text-[11px] list-decimal list-inside leading-relaxed">
              <li>
                Download and extract <code className="text-indigo-300 font-mono">{project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-export.zip</code>.
              </li>
              <li>
                Open the extracted folder in <strong>Google Antigravity</strong> (or Cursor / Claude Code).
              </li>
              <li>
                Paste the prompt into chat to generate the unified shell and background process orchestrator!
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
