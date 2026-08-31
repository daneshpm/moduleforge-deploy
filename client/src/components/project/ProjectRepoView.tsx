import React, { useEffect, useState } from 'react';
import {
  Github,
  GitBranch,
  GitCommit,
  Clock,
  FolderGit2,
  RefreshCw,
  ExternalLink,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertCircle,
  Boxes,
  FileCode2,
  Settings,
  Trash2,
  Code2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useProjectRepoStore } from '../../store/useProjectRepoStore';
import { Project } from '../../types';

interface ProjectRepoViewProps {
  project: Project;
  onOpenCodeEditor?: () => void;
  onOpenArchitecture?: () => void;
}

export const ProjectRepoView: React.FC<ProjectRepoViewProps> = ({
  project,
  onOpenCodeEditor,
  onOpenArchitecture,
}) => {
  const {
    hasRepository,
    repository,
    status,
    stats,
    manifest,
    branches,
    currentBranch,
    history,
    isLoading,
    isCommitting,
    isPushing,
    isPulling,
    errorMessage,
    successMessage,
    fetchRepoOverview,
    fetchBranches,
    fetchHistory,
    createBranch,
    switchBranch,
    push,
    pull,
    disconnectRepo,
    createOrConnectRepo,
    clearMessages,
  } = useProjectRepoStore();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'commits' | 'branches' | 'manifest' | 'settings'>('overview');
  const [newBranchName, setNewBranchName] = useState('');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  // Connect / Init modal state for backward compatibility
  const [showInitModal, setShowInitModal] = useState(false);
  const [initOption, setInitOption] = useState<'create_new' | 'connect_existing'>('create_new');
  const [initRepoName, setInitRepoName] = useState(project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
  const [initGitUrl, setInitGitUrl] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    if (project.id) {
      fetchRepoOverview(project.id);
      fetchBranches(project.id);
      fetchHistory(project.id);
    }
  }, [project.id, fetchRepoOverview, fetchBranches, fetchHistory]);

  const handleRefresh = async () => {
    await fetchRepoOverview(project.id);
    await fetchBranches(project.id);
    await fetchHistory(project.id);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    const ok = await createBranch(project.id, newBranchName.trim());
    if (ok) {
      setNewBranchName('');
      setIsBranchModalOpen(false);
    }
  };

  const handleInitRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitializing(true);
    const payload = {
      option: initOption,
      repositoryName: initRepoName,
      gitUrl: initGitUrl,
    };
    const ok = await createOrConnectRepo(project.id, payload);
    setIsInitializing(false);
    if (ok) {
      setShowInitModal(false);
    }
  };

  // Backward compatibility: If no repository exists
  if (!hasRepository && !repository && !isLoading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto space-y-6 animate-fade-in select-none">
        <div className="bg-white rounded-3xl p-10 border border-[#E2E6E4] shadow-card text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B] mx-auto shadow-sm">
            <Github className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-[#202524]">This project doesn't have a repository yet</h3>
            <p className="text-xs text-[#6B7471] leading-relaxed">
              Initialize an overall Git repository to version-control the entire composition, connect modules, and enable code commits.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setInitOption('create_new');
                setShowInitModal(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Repository</span>
            </button>

            <button
              onClick={() => {
                setInitOption('connect_existing');
                setShowInitModal(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] border border-[#E2E6E4] text-xs font-semibold flex items-center gap-2 transition"
            >
              <Github className="w-4 h-4" />
              <span>Connect Existing Repository</span>
            </button>
          </div>
        </div>

        {/* Init Modal */}
        {showInitModal && (
          <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
              <h3 className="text-base font-bold text-[#202524] flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-[#1F5E4B]" />
                <span>
                  {initOption === 'create_new' ? 'Create Project Repository' : 'Connect Existing Repository'}
                </span>
              </h3>

              <form onSubmit={handleInitRepo} className="space-y-4">
                {initOption === 'create_new' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#202524]">Repository Name</label>
                    <input
                      type="text"
                      value={initRepoName}
                      onChange={(e) => setInitRepoName(e.target.value)}
                      placeholder="e.g. my-app-repository"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#202524]">GitHub Repository URL</label>
                    <input
                      type="url"
                      value={initGitUrl}
                      onChange={(e) => setInitGitUrl(e.target.value)}
                      placeholder="https://github.com/owner/repository"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                      required
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInitModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4] text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInitializing}
                    className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition disabled:opacity-50"
                  >
                    {isInitializing ? 'Configuring...' : 'Confirm & Initialize'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const ghUrl = repository?.url || project.gitRepositoryUrl || (repository?.owner && repository?.name ? `https://github.com/${repository.owner}/${repository.name}` : null);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 w-full space-y-6 animate-fade-in select-none">
      {/* Alert Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-[#F0F9F5] border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={clearMessages} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={clearMessages} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Repository Banner Header */}
      <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/20 shrink-0">
            <FolderGit2 className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-[#202524] tracking-tight">
                {repository?.name || project.name}
              </h2>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 flex items-center gap-1">
                <Github className="w-3 h-3" />
                <span>GitHub</span>
              </span>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4] flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-[#1F5E4B]" />
                <span>{currentBranch}</span>
              </span>
            </div>

            <p className="text-xs text-[#6B7471] font-mono mt-1">
              Overall source repository for <strong className="text-[#202524]">{project.name}</strong>
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {ghUrl && (
            <a
              href={ghUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] hover:text-[#1F5E4B] text-xs font-bold border border-[#E2E6E4] flex items-center gap-1.5 transition shadow-xs"
            >
              <Github className="w-4 h-4" />
              <span>Open GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] text-xs font-semibold border border-[#E2E6E4] flex items-center gap-1.5 transition"
            title="Refresh repository status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#1F5E4B]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => pull(project.id, currentBranch)}
            disabled={isPulling}
            className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] text-xs font-semibold border border-[#E2E6E4] flex items-center gap-1.5 transition disabled:opacity-50"
            title="Pull latest remote commits"
          >
            <ArrowDownToLine className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin text-[#1F5E4B]' : ''}`} />
            <span>Pull</span>
          </button>

          <button
            onClick={() => push(project.id, currentBranch)}
            disabled={isPushing}
            className="px-3.5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-1.5 transition disabled:opacity-50"
            title="Push to GitHub remote"
          >
            <ArrowUpFromLine className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
            <span>Push</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Commit */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E6E4] shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B7471]">
            <span className="font-semibold flex items-center gap-1.5">
              <GitCommit className="w-4 h-4 text-[#1F5E4B]" />
              <span>Latest Commit</span>
            </span>
            <span className="font-mono text-[10px] text-[#1F5E4B] font-bold">
              {stats?.latestCommit?.sha ? stats.latestCommit.sha.substring(0, 7) : 'init'}
            </span>
          </div>
          <p className="text-sm font-bold text-[#202524] truncate">
            {stats?.latestCommit?.message || 'Initial commit'}
          </p>
          <span className="text-[11px] text-[#6B7471] font-mono block">
            {stats?.latestCommit?.author || 'Developer'} • {stats?.latestCommit?.date || 'recently'}
          </span>
        </div>

        {/* Active Branch */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E6E4] shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B7471]">
            <span className="font-semibold flex items-center gap-1.5">
              <GitBranch className="w-4 h-4 text-[#1F5E4B]" />
              <span>Active Branch</span>
            </span>
            <span className="font-mono text-[10px] text-[#2E7D5B] font-bold">● Live</span>
          </div>
          <p className="text-lg font-mono font-bold text-[#202524] truncate">
            {currentBranch}
          </p>
          <span className="text-[11px] text-[#6B7471] font-mono block">
            {branches.length} branch{branches.length !== 1 ? 'es' : ''} available
          </span>
        </div>

        {/* Files Count */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E6E4] shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B7471]">
            <span className="font-semibold flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 text-[#1F5E4B]" />
              <span>Repository Files</span>
            </span>
          </div>
          <p className="text-2xl font-black text-[#202524]">{stats?.totalFiles || 0}</p>
          {onOpenCodeEditor && (
            <button
              onClick={onOpenCodeEditor}
              className="text-[11px] font-bold text-[#1F5E4B] hover:underline flex items-center gap-1"
            >
              <span>Inspect in Code Editor</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Modules Count */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E6E4] shadow-card space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B7471]">
            <span className="font-semibold flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-[#1F5E4B]" />
              <span>Integrated Modules</span>
            </span>
          </div>
          <p className="text-2xl font-black text-[#202524]">{stats?.modulesCount || 0}</p>
          {onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              className="text-[11px] font-bold text-[#1F5E4B] hover:underline flex items-center gap-1"
            >
              <span>View Canvas Topology</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E6E4] pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 rounded-xl transition ${
            activeSubTab === 'overview'
              ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
              : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
          }`}
        >
          Overview & Structure
        </button>

        <button
          onClick={() => setActiveSubTab('commits')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
            activeSubTab === 'commits'
              ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
              : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>Commits ({history.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('branches')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
            activeSubTab === 'branches'
              ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
              : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Branches ({branches.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('manifest')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
            activeSubTab === 'manifest'
              ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
              : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>moduleforge.json</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
            activeSubTab === 'settings'
              ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
              : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* SUBTAB 1: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manifest Modules List */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#1F5E4B]" />
                <span>Integrated Modules in Repository</span>
              </h3>
              <span className="text-xs font-mono text-[#6B7471]">
                {manifest?.modules?.length || 0} module{(manifest?.modules?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>

            {manifest?.modules && manifest.modules.length > 0 ? (
              <div className="space-y-2.5">
                {manifest.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-between hover:border-[#1F5E4B]/40 transition"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#202524]">{mod.name}</div>
                      <div className="font-mono text-[11px] text-[#6B7471] mt-0.5">
                        📂 <span className="text-[#1F5E4B] font-semibold">{mod.path}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
                      v{mod.version}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-[#F7F8F7] rounded-2xl border border-dashed border-[#E2E6E4] space-y-2">
                <Boxes className="w-8 h-8 text-[#6B7471]/40 mx-auto" />
                <p className="text-xs text-[#6B7471]">No modules imported yet.</p>
                <p className="text-[11px] text-[#6B7471]">
                  Add modules via ZIP upload, GitHub import, or Marketplace from the canvas.
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions & Repository Specs */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-4">
            <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#1F5E4B]" />
              <span>Repository Topology</span>
            </h3>

            <div className="bg-[#F7F8F7] p-4 rounded-2xl font-mono text-xs text-[#202524] space-y-1.5 border border-[#E2E6E4]">
              <div>📦 <strong>{manifest?.name || project.name}</strong> (v{manifest?.version || '1.0.0'})</div>
              <div className="text-[#6B7471] pl-4">├── 📁 modules/ <span className="text-[#1F5E4B]"># Software modules</span></div>
              {manifest?.modules?.map((m) => (
                <div key={m.id} className="text-[#202524] pl-8">
                  └── 📁 {m.path.replace(/^modules\//, '')} <span className="text-[#6B7471]">(v{m.version})</span>
                </div>
              ))}
              <div className="text-[#6B7471] pl-4">├── 📄 moduleforge.json <span className="text-[#1F5E4B]"># Platform manifest</span></div>
              <div className="text-[#6B7471] pl-4">├── 📄 package.json</div>
              <div className="text-[#6B7471] pl-4">├── 📄 .gitignore</div>
              <div className="text-[#6B7471] pl-4">└── 📄 README.md</div>
            </div>

            {onOpenCodeEditor && (
              <button
                onClick={onOpenCodeEditor}
                className="w-full py-2.5 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white font-bold text-xs border border-[#1F5E4B]/20 flex items-center justify-center gap-2 transition shadow-xs"
              >
                <FileCode2 className="w-4 h-4" />
                <span>Open Project in Monaco Code Editor</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: COMMITS */}
      {activeSubTab === 'commits' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-[#1F5E4B]" />
              <span>Project Repository Commit History</span>
            </h3>
            <span className="text-xs font-mono text-[#6B7471]">
              Branch: <strong>{currentBranch}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {history.length > 0 ? (
              history.map((c) => (
                <div
                  key={c.sha}
                  className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#1F5E4B]/40 transition"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-xs text-[#202524] flex items-center gap-2">
                      <GitCommit className="w-3.5 h-3.5 text-[#1F5E4B]" />
                      <span>{c.message}</span>
                    </div>
                    <div className="text-[11px] text-[#6B7471] font-mono">
                      authored by <strong className="text-[#202524]">{c.author}</strong> • {c.date}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E6E4] font-mono text-xs font-bold text-[#1F5E4B] shadow-xs">
                      {c.shortSha}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-[#6B7471] font-mono">
                No commits found in branch.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: BRANCHES */}
      {activeSubTab === 'branches' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#1F5E4B]" />
              <span>Branches</span>
            </h3>
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Branch</span>
            </button>
          </div>

          <div className="space-y-2">
            {branches.map((b) => {
              const isCurrent = b === currentBranch;
              return (
                <div
                  key={b}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                    isCurrent
                      ? 'bg-[#EAF3EF] border-[#1F5E4B] text-[#1F5E4B]'
                      : 'bg-[#F7F8F7] border-[#E2E6E4] text-[#202524]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <GitBranch className="w-4 h-4" />
                    <span>{b}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#1F5E4B] text-white font-semibold">
                        Current Branch
                      </span>
                    )}
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => switchBranch(project.id, b)}
                      className="px-3 py-1 rounded-lg bg-white hover:bg-[#EAF3EF] text-[#202524] hover:text-[#1F5E4B] border border-[#E2E6E4] text-xs font-semibold transition"
                    >
                      Checkout
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* New Branch Modal */}
          {isBranchModalOpen && (
            <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                <h3 className="text-sm font-bold text-[#202524] flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[#1F5E4B]" />
                  <span>Create New Branch</span>
                </h3>

                <form onSubmit={handleCreateBranch} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#202524]">Branch Name</label>
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="e.g. feature/payment-mesh"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsBranchModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20"
                    >
                      Create & Checkout
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: MANIFEST */}
      {activeSubTab === 'manifest' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#1F5E4B]" />
              <span>moduleforge.json Manifest</span>
            </h3>
            <span className="text-xs font-mono text-[#6B7471]">
              Synchronized automatically on module changes
            </span>
          </div>

          <pre className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] font-mono text-xs text-[#202524] overflow-x-auto leading-relaxed">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        </div>
      )}

      {/* SUBTAB 5: SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-6">
          <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#1F5E4B]" />
            <span>Repository Settings</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-2">
              <div className="text-[#6B7471]">Remote Origin URL:</div>
              <div className="font-bold text-[#202524] break-all">{ghUrl || 'None configured'}</div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-2">
              <div className="text-[#6B7471]">Default Branch:</div>
              <div className="font-bold text-[#202524]">{repository?.defaultBranch || 'main'}</div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E6E4] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#C94A4A]">Disconnect Repository</div>
              <div className="text-[11px] text-[#6B7471]">
                Unlink this repository from ModuleForge. Source files will remain saved on disk/GitHub.
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm('Are you sure you want to disconnect this repository from the project?')) {
                  disconnectRepo(project.id);
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#FDF3F3] hover:bg-[#C94A4A] text-[#C94A4A] hover:text-white border border-[#C94A4A]/20 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
