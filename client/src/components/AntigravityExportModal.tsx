import React, { useState } from 'react';
import { Sparkles, Download, Copy, Check, X, Terminal, ExternalLink } from 'lucide-react';
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
- **Aesthetic**: Clean executive design (\`#F7F8F7\` background, \`#1F5E4B\` deep green accents, \`#FFFFFF\` panels, active status dots).
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
    <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white border border-[#E2E6E4] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 relative my-6">
        {/* Header Accent Bar */}
        <div className="bg-[#1F5E4B] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Direct Launch to Google Antigravity</h2>
              <p className="text-xs text-white/80 mt-0.5">
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
            className="w-full py-4 px-6 rounded-2xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-black text-sm shadow-xl shadow-[#1F5E4B]/25 flex items-center justify-center gap-3 transition transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
            <span>{isOpeningAntigravity ? 'Opening Antigravity...' : '🚀 Open Directly in Google Antigravity'}</span>
            <ExternalLink className="w-4 h-4 text-white/80" />
          </button>

          {antigravitySuccessMsg && (
            <div className="p-3.5 rounded-xl bg-[#F0F9F5] border border-[#2E7D5B]/30 text-[#2E7D5B] text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span>{antigravitySuccessMsg}</span>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              className="py-3 px-4 rounded-xl bg-[#EAF3EF] hover:bg-[#D1E6DC] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-[#1F5E4B]" />
              <span>{hasDownloaded ? 'Re-download ZIP' : 'Download Project ZIP'}</span>
            </button>

            <button
              onClick={handleCopyPrompt}
              className="py-3 px-4 rounded-xl bg-[#F0F9F5] hover:bg-[#E0F3EA] text-[#2E7D5B] border border-[#2E7D5B]/20 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              {isCopied ? <Check className="w-4 h-4 text-[#2E7D5B]" /> : <Copy className="w-4 h-4 text-[#2E7D5B]" />}
              <span>{isCopied ? 'Copied Prompt ✓' : 'Copy Antigravity Prompt'}</span>
            </button>
          </div>

          {/* Prompt Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#6B7471]">
              <span className="flex items-center gap-1.5 text-[#1F5E4B] font-bold">
                <Terminal className="w-3.5 h-3.5" />
                <span>AI Agent Prompt (ANTIGRAVITY_PROMPT.md)</span>
              </span>
              <button
                onClick={handleCopyPrompt}
                className="text-[#1F5E4B] hover:text-[#174739] font-bold"
              >
                {isCopied ? 'Copied ✓' : 'Copy Full Prompt'}
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] text-[11px] font-mono text-[#202524] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
              {antigravityPrompt}
            </pre>
          </div>

          {/* 3-Step Walkthrough Guide */}
          <div className="p-4 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 space-y-2 text-xs">
            <h4 className="font-bold text-[#1F5E4B] font-mono flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#1F5E4B]" />
              <span>When you extract the ZIP, use this prompt:</span>
            </h4>
            <ol className="space-y-1.5 text-[#202524] text-[11px] list-decimal list-inside leading-relaxed font-sans">
              <li>
                Download and extract <code className="text-[#1F5E4B] font-mono font-bold">{project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-export.zip</code>.
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
        <div className="p-4 bg-[#F7F8F7] border-t border-[#E2E6E4] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-[#EAF3EF] text-[#202524] border border-[#E2E6E4] font-semibold text-xs transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
