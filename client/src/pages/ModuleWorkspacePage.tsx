import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  GitBranch,
  GitCommit,
  UploadCloud,
  DownloadCloud,
  Play,
  FileCode2,
  Folder,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Plus,
  Save,
  RefreshCw,
  User,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useGitStore } from '../store/useGitStore';
import { useProjectStore } from '../store/useProjectStore';
import { FileTreeItem } from '../types';

export const ModuleWorkspacePage: React.FC = () => {
  const { projectId, pmId } = useParams<{ projectId: string; pmId: string }>();
  const navigate = useNavigate();

  const {
    moduleMeta,
    status,
    branches,
    currentBranch,
    history,
    fileTree,
    activeFilePath,
    activeFileContent,
    isSavingFile,
    isCommitting,
    isPushing,
    isPulling,
    errorMessage,
    successMessage,
    fetchWorkspaceStatus,
    commit,
    push,
    pull,
    fetchBranches,
    createBranch,
    switchBranch,
    fetchHistory,
    fetchFileTree,
    loadFile,
    saveFile,
    setActiveFileContent,
  } = useGitStore();

  const { startLocalModule } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'changes' | 'history' | 'branches'>('changes');
  const [commitMessage, setCommitMessage] = useState('');
  const [commitAuthor, setCommitAuthor] = useState('Developer');
  const [newBranchName, setNewBranchName] = useState('');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isRunningLocal, setIsRunningLocal] = useState(false);
  const [pullWarning, setPullWarning] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && pmId) {
      fetchWorkspaceStatus(projectId, pmId);
      fetchBranches(projectId, pmId);
      fetchHistory(projectId, pmId);
      fetchFileTree(projectId, pmId);
    }
  }, [projectId, pmId, fetchWorkspaceStatus, fetchBranches, fetchHistory, fetchFileTree]);

  // Handle local run
  const handleRunLocal = async () => {
    if (!projectId || !pmId) return;
    setIsRunningLocal(true);
    try {
      const res = await startLocalModule(projectId, pmId);
      if (res.success && res.state?.frontendUrl) {
        window.open(res.state.frontendUrl, '_blank');
      }
    } finally {
      setIsRunningLocal(false);
    }
  };

  // Commit handler
  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !pmId || !commitMessage.trim()) return;

    const ok = await commit(projectId, pmId, commitMessage.trim(), commitAuthor.trim());
    if (ok) {
      setCommitMessage('');
      setPullWarning(null);
    }
  };

  // Push handler
  const handlePush = async () => {
    if (!projectId || !pmId) return;
    await push(projectId, pmId, currentBranch);
  };

  // Pull handler with uncommitted check
  const handlePull = async () => {
    if (!projectId || !pmId) return;
    if (status && !status.isClean) {
      setPullWarning('Local uncommitted changes detected. Please commit your changes before pulling.');
      setActiveTab('changes');
      return;
    }
    setPullWarning(null);
    await pull(projectId, pmId, currentBranch);
  };

  // Create branch handler
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !pmId || !newBranchName.trim()) return;
    const ok = await createBranch(projectId, pmId, newBranchName.trim());
    if (ok) {
      setNewBranchName('');
      setIsBranchModalOpen(false);
    }
  };

  // Switch branch handler
  const handleSwitchBranch = async (branchName: string) => {
    if (!projectId || !pmId || branchName === currentBranch) return;
    await switchBranch(projectId, pmId, branchName);
  };

  // Save active file
  const handleSaveActiveFile = async () => {
    if (!projectId || !pmId || !activeFilePath) return;
    await saveFile(projectId, pmId, activeFilePath, activeFileContent);
  };

  // Toggle folder in tree
  const toggleFolder = (pathStr: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [pathStr]: !prev[pathStr],
    }));
  };

  // Render File Tree recursive
  const renderTree = (items: FileTreeItem[], depth: number = 0) => {
    return items.map((item) => {
      if (item.type === 'dir') {
        const isExpanded = expandedFolders[item.path] !== false;
        return (
          <div key={item.path} className="select-none">
            <button
              onClick={() => toggleFolder(item.path)}
              className="w-full flex items-center gap-1.5 py-1 px-2 rounded hover:bg-[#EAF3EF] text-[#202524] text-xs font-mono text-left transition"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#6B7471] shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#6B7471] shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#1F5E4B] shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-[#1F5E4B] shrink-0" />
              )}
              <span className="truncate">{item.name}</span>
            </button>
            {isExpanded && item.children && renderTree(item.children, depth + 1)}
          </div>
        );
      } else {
        const isActive = activeFilePath === item.path;
        return (
          <button
            key={item.path}
            onClick={() => projectId && pmId && loadFile(projectId, pmId, item.path)}
            className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-xs font-mono text-left transition ${
              isActive
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold'
                : 'hover:bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524]'
            }`}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
          >
            <FileCode2 className="w-3.5 h-3.5 text-[#1F5E4B] shrink-0" />
            <span className="truncate">{item.name}</span>
          </button>
        );
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F7F8F7] text-[#202524] overflow-hidden">
      {/* 1. TOP NAVIGATION HEADER */}
      <header className="h-14 bg-white border-b border-[#E2E6E4] px-5 flex items-center justify-between shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(projectId ? `/builder/${projectId}` : '/projects')}
            className="p-1.5 rounded-lg bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] transition border border-[#E2E6E4]"
            title="Back to Project Builder"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-[#202524] tracking-tight">
                  {moduleMeta?.name || 'Module'} Workspace
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
                  {moduleMeta?.repositoryType === 'github' ? 'GitHub' : 'ModuleForge Git'}
                </span>
              </div>
              <span className="text-[11px] text-[#6B7471]">
                Assigned to <strong className="text-[#202524]">{moduleMeta?.ownerName || 'Developer'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Branch Switcher Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-2.5 py-1">
            <GitBranch className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <select
              value={currentBranch}
              onChange={(e) => handleSwitchBranch(e.target.value)}
              className="bg-transparent text-xs text-[#202524] font-mono focus:outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b} value={b} className="bg-white text-[#202524]">
                  {b}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="p-1 rounded hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] text-[10px]"
              title="Create new branch"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Local Module Runner View */}
          <button
            onClick={handleRunLocal}
            disabled={isRunningLocal}
            className="px-3.5 py-1.5 rounded-xl bg-[#2E7D5B] hover:bg-[#246549] text-white font-bold text-xs shadow-md shadow-[#2E7D5B]/20 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningLocal ? 'animate-spin' : ''}`} />
            <span>{isRunningLocal ? 'Starting...' : 'View (Run Local)'}</span>
          </button>
        </div>
      </header>

      {/* 2. GIT STATUS RIBBON */}
      <div className="bg-[#F7F8F7] border-b border-[#E2E6E4] px-5 py-2 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          {status?.gitStatus === 'up_to_date' && (
            <span className="flex items-center gap-1.5 text-[#2E7D5B] font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
              🟢 Up to date
            </span>
          )}
          {status?.gitStatus === 'local_changes' && (
            <span className="flex items-center gap-1.5 text-amber-700 font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              🟡 {status.changesCount} local change{status.changesCount !== 1 ? 's' : ''} uncommitted
            </span>
          )}
          {status?.gitStatus === 'changes_available' && (
            <span className="flex items-center gap-1.5 text-[#1F5E4B] font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-[#1F5E4B] animate-pulse" />
              🔵 Remote updates available
            </span>
          )}
          {status?.gitStatus === 'conflict' && (
            <span className="flex items-center gap-1.5 text-[#C94A4A] font-bold font-mono animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              🔴 Merge conflict detected ({status.conflictFiles.join(', ')})
            </span>
          )}

          {status?.latestCommit && (
            <span className="text-[#6B7471] font-mono text-[11px] border-l border-[#E2E6E4] pl-3">
              Commit <code className="text-[#1F5E4B] font-bold">{status.latestCommit.sha.substring(0, 7)}</code>: "
              {status.latestCommit.message}" ({status.latestCommit.date})
            </span>
          )}
        </div>

        {/* Global Alert messages */}
        <div className="flex items-center gap-2">
          {pullWarning && (
            <div className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs flex items-center gap-1.5 animate-fade-in font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{pullWarning}</span>
            </div>
          )}

          {successMessage && (
            <div className="px-2.5 py-1 rounded-lg bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/20 text-xs flex items-center gap-1.5 animate-fade-in font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="px-2.5 py-1 rounded-lg bg-[#FDF3F3] text-[#C94A4A] border border-[#C94A4A]/20 text-xs flex items-center gap-1.5 animate-fade-in font-bold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. MAIN WORKSPACE 3-COLUMN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUMN A: FILE EXPLORER */}
        <aside className="w-64 bg-white border-r border-[#E2E6E4] flex flex-col shrink-0 shadow-xs">
          <div className="p-3 border-b border-[#E2E6E4] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7471] font-mono flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#1F5E4B]" />
              <span>Files</span>
            </span>
            <button
              onClick={() => projectId && pmId && fetchFileTree(projectId, pmId)}
              className="p-1 rounded hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] transition"
              title="Refresh Files"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {fileTree.length > 0 ? (
              renderTree(fileTree)
            ) : (
              <div className="p-4 text-center text-xs text-[#6B7471] font-mono">
                No files found in repository.
              </div>
            )}
          </div>
        </aside>

        {/* COLUMN B: CODE / TEXT EDITOR */}
        <main className="flex-1 flex flex-col bg-white min-w-0 border-r border-[#E2E6E4]">
          {/* Editor Tab Bar */}
          <div className="h-10 bg-[#F7F8F7] border-b border-[#E2E6E4] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-3.5 h-3.5 text-[#1F5E4B]" />
              <span className="text-xs font-mono text-[#202524] truncate font-semibold">
                {activeFilePath || 'Select a file to view/edit'}
              </span>
            </div>

            {activeFilePath && (
              <button
                onClick={handleSaveActiveFile}
                disabled={isSavingFile}
                className="px-3 py-1 rounded-lg bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingFile ? 'Saving...' : 'Save File'}</span>
              </button>
            )}
          </div>

          {/* Editor Content Area */}
          <div className="flex-1 overflow-hidden p-4">
            {activeFilePath ? (
              <textarea
                value={activeFileContent}
                onChange={(e) => setActiveFileContent(e.target.value)}
                placeholder="File content..."
                className="w-full h-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-2xl p-4 font-mono text-xs text-[#202524] leading-relaxed resize-none focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                spellCheck={false}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6B7471] space-y-3">
                <FileCode2 className="w-10 h-10 text-[#6B7471]/40" />
                <div>
                  <h3 className="text-sm font-bold text-[#202524]">No File Selected</h3>
                  <p className="text-xs text-[#6B7471] mt-1 max-w-sm">
                    Select any file from the repository tree on the left to inspect, modify, and commit changes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* COLUMN C: GIT OPERATIONS & COMMIT PANEL */}
        <aside className="w-80 bg-white flex flex-col shrink-0 shadow-xs">
          {/* Panel Tabs */}
          <div className="grid grid-cols-3 bg-[#F7F8F7] border-b border-[#E2E6E4] text-xs font-semibold">
            <button
              onClick={() => setActiveTab('changes')}
              className={`py-3 text-center transition flex items-center justify-center gap-1.5 ${
                activeTab === 'changes'
                  ? 'border-b-2 border-[#1F5E4B] text-[#1F5E4B] font-bold bg-white'
                  : 'text-[#6B7471] hover:text-[#202524]'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>Changes</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                projectId && pmId && fetchHistory(projectId, pmId);
              }}
              className={`py-3 text-center transition flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-b-2 border-[#1F5E4B] text-[#1F5E4B] font-bold bg-white'
                  : 'text-[#6B7471] hover:text-[#202524]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('branches');
                projectId && pmId && fetchBranches(projectId, pmId);
              }}
              className={`py-3 text-center transition flex items-center justify-center gap-1.5 ${
                activeTab === 'branches'
                  ? 'border-b-2 border-[#1F5E4B] text-[#1F5E4B] font-bold bg-white'
                  : 'text-[#6B7471] hover:text-[#202524]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branches</span>
            </button>
          </div>

          {/* TAB 1: CHANGES & COMMIT */}
          {activeTab === 'changes' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Push & Pull Actions Bar */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePush}
                  disabled={isPushing}
                  className="py-2 px-3 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] border border-[#E2E6E4] text-[#202524] text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  title="Push committed changes to repository"
                >
                  <UploadCloud className={`w-3.5 h-3.5 text-[#1F5E4B] ${isPushing ? 'animate-bounce' : ''}`} />
                  <span>{isPushing ? 'Pushing...' : 'Push'}</span>
                </button>

                <button
                  onClick={handlePull}
                  disabled={isPulling}
                  className="py-2 px-3 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] border border-[#E2E6E4] text-[#202524] text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  title="Pull latest repository changes"
                >
                  <DownloadCloud className={`w-3.5 h-3.5 text-[#2E7D5B] ${isPulling ? 'animate-bounce' : ''}`} />
                  <span>{isPulling ? 'Pulling...' : 'Pull'}</span>
                </button>
              </div>

              {/* Changed Files List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#6B7471]">
                  <span className="font-bold uppercase tracking-wider font-mono">
                    Changed Files ({status?.files.length || 0})
                  </span>
                  <button
                    onClick={() => projectId && pmId && fetchWorkspaceStatus(projectId, pmId)}
                    className="p-1 rounded hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524]"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-1.5 max-h-48 overflow-y-auto">
                  {status && status.files.length > 0 ? (
                    status.files.map((file) => (
                      <div
                        key={file.path}
                        onClick={() => projectId && pmId && loadFile(projectId, pmId, file.path)}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-white cursor-pointer text-xs font-mono transition"
                      >
                        <span className="text-[#202524] truncate max-w-[180px]">{file.path}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            file.status === 'modified'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : file.status === 'added' || file.status === 'untracked'
                              ? 'bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/20'
                              : file.status === 'deleted'
                              ? 'bg-[#FDF3F3] text-[#C94A4A] border border-[#C94A4A]/20'
                              : 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                          }`}
                        >
                          {file.status === 'modified' ? 'M' : file.status === 'deleted' ? 'D' : 'A'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-[#6B7471] font-mono flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
                      <span>Working tree clean</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Commit Form */}
              <form onSubmit={handleCommit} className="space-y-3 pt-2 border-t border-[#E2E6E4]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Commit Message *</label>
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="e.g. Added customer search functionality"
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl p-3 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] h-20"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Author</label>
                  <input
                    type="text"
                    value={commitAuthor}
                    onChange={(e) => setCommitAuthor(e.target.value)}
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCommitting || !commitMessage.trim()}
                  className="w-full py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>{isCommitting ? 'Committing...' : 'Commit Changes'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: COMMIT HISTORY */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7471] font-mono block">
                Commit Log ({history.length})
              </span>

              <div className="space-y-2.5">
                {history.length > 0 ? (
                  history.map((c) => (
                    <div
                      key={c.sha}
                      className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-1.5 hover:border-[#1F5E4B]/30 transition"
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono font-bold text-[#1F5E4B]">{c.shortSha}</code>
                        <span className="text-[10px] text-[#6B7471] font-mono">{c.date}</span>
                      </div>
                      <p className="text-xs text-[#202524] font-medium leading-snug">{c.message}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6B7471]">
                        <User className="w-3 h-3 text-[#6B7471]" />
                        <span>{c.author}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-[#6B7471] font-mono">
                    No commit history yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BRANCHES */}
          {activeTab === 'branches' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7471] font-mono">
                  Branches ({branches.length})
                </span>
                <button
                  onClick={() => setIsBranchModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Branch</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {branches.map((b) => {
                  const isCurrent = b === currentBranch;
                  return (
                    <div
                      key={b}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                        isCurrent
                          ? 'bg-[#EAF3EF] border-[#1F5E4B]/30 text-[#1F5E4B] font-bold'
                          : 'bg-[#F7F8F7] border-[#E2E6E4] text-[#202524] hover:border-[#1F5E4B]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-[#1F5E4B]" />
                        <span className="text-xs font-mono">{b}</span>
                      </div>

                      {isCurrent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1F5E4B] text-white">
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSwitchBranch(b)}
                          className="text-xs text-[#1F5E4B] hover:text-[#174739] font-bold"
                        >
                          Checkout
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* NEW BRANCH MODAL */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-[#202524] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#1F5E4B]" />
              <span>Create New Branch</span>
            </h3>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Branch Name</label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. feature/customer-search"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] font-mono placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E6E4]">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F7F8F7] text-[#6B7471] text-xs font-semibold hover:bg-[#EAF3EF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20"
                >
                  Create & Checkout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
