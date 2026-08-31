import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  Folder,
  FolderOpen,
  Save,
  GitCommit,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileJson,
  X,
  Sparkles,
  GitBranch,
  Layers,
} from 'lucide-react';
import { useProjectRepoStore } from '../../store/useProjectRepoStore';
import { Project, FileTreeItem } from '../../types';

interface ProjectCodeEditorProps {
  project: Project;
}

export const ProjectCodeEditor: React.FC<ProjectCodeEditorProps> = ({ project }) => {
  const {
    fileTree,
    activeFilePath,
    activeFileContent,
    isDirty,
    isLoading,
    isSavingFile,
    isCommitting,
    status,
    errorMessage,
    successMessage,
    fetchFileTree,
    loadFile,
    saveFile,
    commitChanges,
    setActiveFileContent,
    clearMessages,
  } = useProjectRepoStore();

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    modules: true,
  });
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitAuthor, setCommitAuthor] = useState('Developer');

  useEffect(() => {
    if (project.id) {
      fetchFileTree(project.id);
    }
  }, [project.id, fetchFileTree]);

  // If no file loaded yet, auto-load README.md or moduleforge.json if available
  useEffect(() => {
    if (!activeFilePath && fileTree.length > 0 && project.id) {
      const readme = fileTree.find((f) => f.path === 'README.md');
      const manifest = fileTree.find((f) => f.path === 'moduleforge.json');
      if (manifest) {
        loadFile(project.id, manifest.path);
      } else if (readme) {
        loadFile(project.id, readme.path);
      }
    }
  }, [fileTree, activeFilePath, project.id, loadFile]);

  const toggleFolder = (pathStr: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [pathStr]: !prev[pathStr],
    }));
  };

  const handleSave = async () => {
    if (!activeFilePath || !project.id) return;
    await saveFile(project.id, activeFilePath, activeFileContent);
  };

  const handleCommitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || !project.id) return;
    const ok = await commitChanges(project.id, commitMessage.trim(), commitAuthor.trim());
    if (ok) {
      setCommitMessage('');
      setIsCommitModalOpen(false);
    }
  };

  // Helper for file icon based on file extension
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    if (fileName.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-[#1F5E4B] shrink-0" />;
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
      return <FileCode2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    }
    return <FileCode2 className="w-3.5 h-3.5 text-[#6B7471] shrink-0" />;
  };

  // Render recursive file tree
  const renderTree = (items: FileTreeItem[], depth: number = 0) => {
    return items.map((item) => {
      if (item.type === 'dir') {
        const isExpanded = expandedFolders[item.path] !== false;
        return (
          <div key={item.path} className="select-none">
            <button
              onClick={() => toggleFolder(item.path)}
              className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-[#EAF3EF] text-[#202524] text-xs font-mono text-left transition group"
              style={{ paddingLeft: `${depth * 14 + 8}px` }}
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
              <span className="truncate font-semibold">{item.name}</span>
            </button>
            {isExpanded && item.children && renderTree(item.children, depth + 1)}
          </div>
        );
      } else {
        const isActive = activeFilePath === item.path;
        return (
          <button
            key={item.path}
            onClick={() => project.id && loadFile(project.id, item.path)}
            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-mono text-left transition ${
              isActive
                ? 'bg-[#EAF3EF] text-[#1F5E4B] font-bold shadow-xs border border-[#1F5E4B]/20'
                : 'hover:bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524]'
            }`}
            style={{ paddingLeft: `${depth * 14 + 22}px` }}
          >
            {getFileIcon(item.name)}
            <span className="truncate">{item.name}</span>
          </button>
        );
      }
    });
  };

  const changedCount = status?.changesCount || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8F7] overflow-hidden select-none">
      {/* Editor Sub-Header Toolbar */}
      <div className="h-12 bg-white border-b border-[#E2E6E4] px-5 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#202524]">
            <FileCode2 className="w-4 h-4 text-[#1F5E4B]" />
            <span className="truncate">{activeFilePath || 'Select a file'}</span>
            {isDirty && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Status badge */}
          {changedCount > 0 ? (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>{changedCount} modified</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/20 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Clean</span>
            </span>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSavingFile || !activeFilePath}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
              isDirty
                ? 'bg-[#1F5E4B] hover:bg-[#174739] text-white shadow-md shadow-[#1F5E4B]/20'
                : 'bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] border border-[#E2E6E4]'
            } disabled:opacity-50`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingFile ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Commit Button */}
          <button
            onClick={() => setIsCommitModalOpen(true)}
            className="px-4 py-1.5 rounded-xl bg-[#2E7D5B] hover:bg-[#246549] text-white font-bold text-xs shadow-md shadow-[#2E7D5B]/20 flex items-center gap-1.5 transition active:scale-95"
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Commit</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Editor Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Explorer Sidebar */}
        <aside className="w-64 bg-white border-r border-[#E2E6E4] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#E2E6E4] flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B7471] flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#1F5E4B]" />
              <span>Project Repository</span>
            </span>

            <button
              onClick={() => project.id && fetchFileTree(project.id)}
              className="p-1 rounded-lg hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] transition"
              title="Refresh File Tree"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {fileTree.length > 0 ? (
              renderTree(fileTree)
            ) : (
              <div className="p-6 text-center text-xs text-[#6B7471] font-mono space-y-2">
                <p>No files loaded.</p>
                <button
                  onClick={() => project.id && fetchFileTree(project.id)}
                  className="text-[#1F5E4B] underline font-bold"
                >
                  Reload Tree
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Center Code Editor Area */}
        <main className="flex-1 flex flex-col bg-white min-w-0">
          {activeFilePath ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="flex-1 p-4 overflow-hidden">
                <textarea
                  value={activeFileContent}
                  onChange={(e) => setActiveFileContent(e.target.value)}
                  placeholder="File content..."
                  className="w-full h-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-2xl p-4 font-mono text-xs text-[#202524] leading-relaxed resize-none focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                  spellCheck={false}
                />
              </div>

              {/* Status bar */}
              <div className="h-7 bg-[#F7F8F7] border-t border-[#E2E6E4] px-4 flex items-center justify-between text-[11px] font-mono text-[#6B7471]">
                <span>{activeFilePath}</span>
                <span>{activeFileContent.split('\n').length} lines</span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6B7471] space-y-3">
              <FileCode2 className="w-12 h-12 text-[#6B7471]/30" />
              <div>
                <h3 className="text-sm font-bold text-[#202524]">No File Selected</h3>
                <p className="text-xs text-[#6B7471] mt-1 max-w-sm">
                  Select any file from the project repository tree on the left to edit and commit changes.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Commit Changes Modal */}
      {isCommitModalOpen && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
              <h3 className="text-base font-bold text-[#202524] flex items-center gap-2">
                <GitCommit className="w-5 h-5 text-[#1F5E4B]" />
                <span>Commit Changes</span>
              </h3>
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCommitSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Commit Message *</label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="e.g. Update authentication flow & module configuration"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] h-24"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] text-xs">
                <span className="text-[#6B7471]">Files Modified:</span>
                <span className="font-mono font-bold text-[#1F5E4B]">{changedCount || 1}</span>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCommitModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCommitting}
                  className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition disabled:opacity-50"
                >
                  {isCommitting ? 'Committing...' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
