import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GitBranch,
  Github,
  RefreshCw,
  Terminal,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Shield,
  Activity,
  Zap,
  Play,
  Download,
} from 'lucide-react';
import { Project, ProjectModule, ProjectMember, ModuleDeployment, ProjectActivity } from '../types';
import { useProjectStore } from '../store/useProjectStore';
import { ExportProjectModal } from './ExportProjectModal';

interface TeamProjectDashboardProps {
  project: Project;
}

export const TeamProjectDashboard: React.FC<TeamProjectDashboardProps> = ({ project }) => {
  const navigate = useNavigate();
  const {
    isRealtimeConnected,
    subscribeToProjectEvents,
    syncEntireProject,
    syncModuleNow,
    rollbackModule,
    fetchMembers,
    inviteMember,
    removeMember,
    connectModuleRepo,
    syncProjectModule,
    redeployProjectModule,
    rollbackProjectModule,
    fetchModuleLogs,
    fetchProjectActivities,
    startLocalModule,
    stopLocalModule,
    startLocalProject,
    fetchLocalRunnerStatus,
    fetchLocalModuleLogs,
    exportProjectZip,
  } = useProjectStore();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activeLogsModule, setActiveLogsModule] = useState<ProjectModule | null>(null);
  const [logsList, setLogsList] = useState<ModuleDeployment[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Rollback Modal state
  const [rollbackPm, setRollbackPm] = useState<ProjectModule | null>(null);
  const [rollbackLogs, setRollbackLogs] = useState<ModuleDeployment[]>([]);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Invite Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'viewer'>('developer');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [sentInviteInfo, setSentInviteInfo] = useState<{
    email: string;
    inviteLink: string;
    gmailComposeUrl?: string;
    mailtoUrl?: string;
    previewUrl?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Connect Repo Modal state
  const [connectPm, setConnectPm] = useState<ProjectModule | null>(null);
  const [repoInput, setRepoInput] = useState('');
  const [branchInput, setBranchInput] = useState('main');
  const [isConnecting, setIsConnecting] = useState(false);

  // Syncing & Runner state tracker
  const [syncingPmId, setSyncingPmId] = useState<string | null>(null);
  const [isSyncingProject, setIsSyncingProject] = useState(false);
  const [runnerStates, setRunnerStates] = useState<Record<string, any>>({});
  const [startingPmId, setStartingPmId] = useState<string | null>(null);

  const loadData = async () => {
    const mems = await fetchMembers(project.id);
    setMembers(mems);
    const acts = await fetchProjectActivities(project.id);
    setActivities(acts);
    const rStatuses = await fetchLocalRunnerStatus();
    const stateMap: Record<string, any> = {};
    for (const st of rStatuses) {
      if (st.pmId) stateMap[st.pmId] = st;
    }
    setRunnerStates(stateMap);
  };

  // Subscribe to Realtime SSE Event Stream
  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToProjectEvents(project.id);
    const interval = setInterval(loadData, 4000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [project.id, subscribeToProjectEvents]);

  const handleStartModule = async (pmId: string) => {
    setStartingPmId(pmId);
    await startLocalModule(project.id, pmId);
    setStartingPmId(null);
    loadData();
  };

  const handleStopModule = async (pmId: string) => {
    await stopLocalModule(pmId);
    loadData();
  };

  const handleRunProject = async () => {
    setStartingPmId('ALL');
    await startLocalProject(project.id);
    setStartingPmId(null);
    loadData();
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteError(null);

    const res = await inviteMember(project.id, inviteEmail.trim(), inviteRole);
    setIsInviting(false);
    if (res.success) {
      const link = res.inviteLink || `${window.location.origin}/join-project?token=${res.inviteToken || res.member?.inviteToken}`;
      setSentInviteInfo({
        email: inviteEmail.trim(),
        inviteLink: link,
        gmailComposeUrl: res.gmailComposeUrl,
        mailtoUrl: res.mailtoUrl,
        previewUrl: res.previewUrl,
      });
      setInviteEmail('');
      loadData();
    } else {
      setInviteError(res.error || 'Failed to invite member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    await removeMember(project.id, memberId);
    loadData();
  };

  const handleConnectRepoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectPm || !repoInput.trim()) return;
    setIsConnecting(true);

    const res = await connectModuleRepo(project.id, connectPm.id, repoInput.trim(), branchInput.trim());
    setIsConnecting(false);
    if (res.success) {
      setConnectPm(null);
      setRepoInput('');
      loadData();
    } else {
      alert(res.error || 'Failed to connect repository');
    }
  };

  const handleSyncNow = async (pmId: string) => {
    setSyncingPmId(pmId);
    await syncProjectModule(project.id, pmId);
    setSyncingPmId(null);
    loadData();
  };

  const handleRedeploy = async (pmId: string) => {
    setSyncingPmId(pmId);
    await redeployProjectModule(project.id, pmId);
    setSyncingPmId(null);
    loadData();
  };

  const handleOpenLogs = async (pm: ProjectModule) => {
    setActiveLogsModule(pm);
    const logs = await fetchModuleLogs(project.id, pm.id);
    setLogsList(logs);
  };

  const handleRollback = async (pmId: string, previousCommitSha: string) => {
    if (!confirm(`Rollback to commit ${previousCommitSha.slice(0, 7)}?`)) return;
    setSyncingPmId(pmId);
    await rollbackProjectModule(project.id, pmId, previousCommitSha);
    setSyncingPmId(null);
    if (activeLogsModule) {
      const logs = await fetchModuleLogs(project.id, activeLogsModule.id);
      setLogsList(logs);
    }
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Team Project Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">{project.name}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 capitalize">
              <Users className="w-3.5 h-3.5" />
              <span>{project.projectType || 'team'} Project</span>
            </span>

            {/* Realtime Live Sync Status Badge */}
            {isRealtimeConnected ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>🟢 Live Sync Active</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>⚪ Realtime Connecting...</span>
              </span>
            )}

            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 capitalize ${
              project.visibility === 'public'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              <span>{project.visibility === 'public' ? '🌐 Public' : '🔒 Private'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Single shared project state • Realtime GitHub push webhooks • Isolated localhost module runners.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              setIsSyncingProject(true);
              await syncEntireProject(project.id);
              setIsSyncingProject(false);
              loadData();
            }}
            disabled={isSyncingProject}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            title="Sync all Git/GitHub modules now"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncingProject ? 'animate-spin' : ''}`} />
            <span>{isSyncingProject ? 'Syncing...' : 'Sync Project'}</span>
          </button>

          <button
            onClick={handleRunProject}
            disabled={startingPmId === 'ALL'}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${startingPmId === 'ALL' ? 'animate-spin' : ''}`} />
            <span>{startingPmId === 'ALL' ? 'Starting Project...' : 'Run Project (All Modules)'}</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Export & Run Prompt</span>
          </button>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Export & Run Prompt Modal */}
      {isExportModalOpen && (
        <ExportProjectModal
          project={project}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* Team Members List */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Team Members ({members.length + 1})</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">GitHub is Source of Truth</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Owner Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
              S
            </div>
            <div>
              <span className="font-bold text-white block leading-tight">Shalya</span>
              <span className="text-[10px] text-indigo-400 font-mono">Owner</span>
            </div>
          </div>

          {/* Members Badges */}
          {members.map((m) => {
            const isPending = m.status === 'pending';
            return (
              <div
                key={m.id}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs group transition ${
                  isPending ? 'bg-slate-950/70 border-amber-500/30' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full text-white font-bold flex items-center justify-center text-[10px] ${
                  isPending ? 'bg-amber-600' : 'bg-purple-600'
                }`}>
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200 block leading-tight truncate max-w-[120px]">{m.email}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      isPending ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {isPending ? 'Pending' : 'Joined'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono capitalize">{m.role}</span>
                </div>

                {isPending && m.inviteToken && (
                  <button
                    onClick={async () => {
                      const link = `${window.location.origin}/join-project?token=${m.inviteToken}`;
                      await navigator.clipboard.writeText(link);
                      alert(`Copied direct invite link for ${m.email}:\n${link}`);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition ml-1"
                    title="Copy direct join link"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                <button
                  onClick={() => handleRemoveMember(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition ml-1"
                  title="Remove Member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected GitHub Modules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <span>Connected Project Modules</span>
          </h3>
          <span className="text-xs text-slate-400">Pushes trigger selective builds without disturbing other modules.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.modules.map((pm) => {
            const status = pm.deploymentStatus || 'synced';
            const repo = pm.githubRepository || pm.module.githubRepo ? `${pm.module.githubOwner || 'company'}/${pm.module.githubRepo || pm.module.name.toLowerCase()}` : null;
            const branch = pm.githubBranch || pm.module.githubBranch || 'main';
            const commitSha = pm.currentCommitSha || pm.module.githubCurrentCommit || 'a82f91c';
            const isSyncing = syncingPmId === pm.id || status === 'updating';

            const localState = runnerStates[pm.id];
            const isRunningLocally = localState?.status === 'running';
            const isStartingLocally = startingPmId === pm.id || localState?.status === 'starting';

            return (
              <div key={pm.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition">
                {/* Module Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">{pm.module.categoryName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Owner: {pm.ownerName || 'Developer'}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      <span>{pm.module.name}</span>
                    </h4>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-col items-end gap-1">
                    {/* Local Runner Status */}
                    {isRunningLocally ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>🟢 Running</span>
                      </span>
                    ) : isStartingLocally ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>🟡 Starting...</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                        <span>⚪ Stopped</span>
                      </span>
                    )}

                    {/* Git / Sync Status */}
                    {status === 'updating' ? (
                      <span className="text-[10px] font-mono text-amber-400">🟡 GitHub Updating</span>
                    ) : status === 'failed' ? (
                      <span className="text-[10px] font-mono text-rose-400">🔴 Build Failed</span>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400">🟢 Up to date</span>
                    )}
                  </div>
                </div>

                {/* Repository & Runtime details */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Github className="w-3.5 h-3.5 text-slate-300" />
                      <span>Repository:</span>
                    </span>
                    <span className="text-white font-bold">{repo || 'Not connected'}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Branch:</span>
                    </span>
                    <span className="text-indigo-300 font-bold">{branch}</span>
                  </div>

                  {/* Latest Synced Commit Details */}
                  <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Latest Commit:</span>
                      <span className="text-amber-300 font-bold">{commitSha ? commitSha.slice(0, 7) : 'Initial'}</span>
                    </div>
                    {pm.lastCommitMessage && (
                      <div className="text-[11px] text-slate-300 italic truncate" title={pm.lastCommitMessage}>
                        "{pm.lastCommitMessage}"
                      </div>
                    )}
                    {pm.lastCommitAuthor && (
                      <div className="text-[10px] text-indigo-400">
                        Author: {pm.lastCommitAuthor}
                      </div>
                    )}
                  </div>

                  {(localState?.frontendUrl || pm.deploymentUrl) && (
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-slate-400">
                      <span>Localhost URL:</span>
                      <a
                        href={localState?.frontendUrl || pm.deploymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>{localState?.frontendUrl || pm.deploymentUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Module Action Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Primary View / Launch Button */}
                  <button
                    onClick={() => handleStartModule(pm.id)}
                    disabled={isStartingLocally}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                      isRunningLocally
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isStartingLocally ? 'Starting...' : isRunningLocally ? 'Open Browser' : 'View (Run)'}</span>
                  </button>

                  {/* Sync Now Button */}
                  <button
                    onClick={async () => {
                      setSyncingPmId(pm.id);
                      await syncModuleNow(project.id, pm.id);
                      setSyncingPmId(null);
                      loadData();
                    }}
                    disabled={isSyncing}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Check GitHub & synchronize latest commit"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  {/* Open GitHub Link */}
                  {repo && (
                    <a
                      href={pm.module.githubUrl || `https://github.com/${repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>GitHub</span>
                    </a>
                  )}

                  {/* Rollback Button */}
                  <button
                    onClick={async () => {
                      setRollbackPm(pm);
                      const logs = await fetchModuleLogs(project.id, pm.id);
                      setRollbackLogs(logs);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Rollback to previous working version"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rollback</span>
                  </button>

                  {/* Stop Button */}
                  {isRunningLocally && (
                    <button
                      onClick={() => handleStopModule(pm.id)}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <span>Stop</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setConnectPm(pm);
                      setRepoInput(repo || '');
                      setBranchInput(branch);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition"
                    title="Edit Connected Repo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenLogs(pm)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition ml-auto"
                  >
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    <span>Logs</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Activity Timeline */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Project Activity Timeline</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">Live Webhook Feed</span>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-mono">
            No project activity recorded yet. Connect a repository or send a GitHub push webhook.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <span className="mt-0.5">
                  {act.status === 'failed' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : act.status === 'updating' ? (
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </span>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      {act.moduleName ? `Module: ${act.moduleName}` : 'Project Update'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300">{act.description}</p>
                  {act.actorName && <span className="text-[10px] text-indigo-400 block">Author: {act.actorName}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Invite Team Member</span>
              </h3>
              <button
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setSentInviteInfo(null);
                }}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {sentInviteInfo ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Invitation Link Generated!</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Project invite created for <strong className="text-white">{sentInviteInfo.email}</strong>. You can send it directly via Gmail with 1 click below or copy the join link.
                  </p>
                </div>

                {/* 1-Click Gmail Action Button */}
                {sentInviteInfo.gmailComposeUrl && (
                  <div className="space-y-2">
                    <a
                      href={sentInviteInfo.gmailComposeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition"
                    >
                      <span>📧 Open in Gmail & Send Invitation (1-Click)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Direct Join Link Box */}
                <div className="space-y-1.5 font-mono text-xs">
                  <label className="text-slate-400 font-sans text-xs block font-semibold">Direct Join Link:</label>
                  <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="text"
                      readOnly
                      value={sentInviteInfo.inviteLink}
                      className="bg-transparent text-[11px] text-slate-300 w-full focus:outline-none select-all"
                    />
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(sentInviteInfo.inviteLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shrink-0 transition flex items-center gap-1"
                    >
                      {copiedLink ? 'Copied! ✓' : 'Copy Link'}
                    </button>
                  </div>
                </div>

                {sentInviteInfo.previewUrl && (
                  <div className="text-[11px] font-mono text-slate-400">
                    <span>Ethereal Email Preview: </span>
                    <a
                      href={sentInviteInfo.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      View Sent Email →
                    </a>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono space-y-1">
                  <div className="text-indigo-400 font-bold">💡 Automatic Background Gmail:</div>
                  <p className="text-slate-400 font-sans text-[11px]">
                    To send directly in background without opening Gmail web compose, add <code className="text-white bg-slate-900 px-1 py-0.5 rounded">GMAIL_USER</code> and <code className="text-white bg-slate-900 px-1 py-0.5 rounded">GMAIL_APP_PASSWORD</code> to your <code className="text-white bg-slate-900 px-1 py-0.5 rounded">server/.env</code> file.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSentInviteInfo(null);
                      setInviteEmail('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Invite Another
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setSentInviteInfo(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Email Address (Gmail / Corporate)</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="developer@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="developer">Developer (Can connect repos & deploy)</option>
                    <option value="viewer">Viewer (Read-only access)</option>
                  </select>
                </div>

                {inviteError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
                    {inviteError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                  >
                    {isInviting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Email...</span>
                      </>
                    ) : (
                      <span>Send Email Invitation</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Connect Repo Modal */}
      {connectPm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Github className="w-5 h-5 text-indigo-400" />
              <span>Connect Repository to {connectPm.module.name}</span>
            </h3>

            <form onSubmit={handleConnectRepoSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">GitHub Repository (owner/repo)</label>
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="company/crm"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Branch</label>
                <input
                  type="text"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  placeholder="main"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectPm(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Build & Deployment Logs Modal */}
      {activeLogsModule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-400" />
                <span>Build & Deployment Logs — {activeLogsModule.module.name}</span>
              </h3>
              <button
                onClick={() => setActiveLogsModule(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {logsList.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 text-slate-500 text-xs font-mono text-center">
                  No build deployment logs recorded yet.
                </div>
              ) : (
                logsList.map((log) => (
                  <div key={log.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-bold text-indigo-300">Commit {log.commitSha.slice(0, 7)} ({log.author || 'Developer'})</span>
                      <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>

                    <p className="text-slate-300">{log.commitMessage || 'No commit message'}</p>

                    <pre className="p-3 rounded-lg bg-black text-slate-300 text-[11px] whitespace-pre-wrap font-mono border border-slate-800/80 max-h-48 overflow-y-auto">
                      {log.buildLogs || 'Build output OK.'}
                    </pre>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[11px] font-bold ${log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Status: {log.status.toUpperCase()}
                      </span>
                      {log.commitSha !== activeLogsModule.currentCommitSha && (
                        <button
                          onClick={() => handleRollback(activeLogsModule.id, log.commitSha)}
                          className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback to this version</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveLogsModule(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Rollback Modal */}
      {rollbackPm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <span>Rollback Module: {rollbackPm.module.name}</span>
              </h3>
              <button
                onClick={() => setRollbackPm(null)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select a previously verified commit to restore as the active running version for <strong className="text-white">{rollbackPm.module.name}</strong> without destroying Git history.
            </p>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {rollbackLogs.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 text-slate-500 text-xs font-mono text-center">
                  No prior deployment versions available for rollback.
                </div>
              ) : (
                rollbackLogs.map((log) => {
                  const isCurrent = log.commitSha === rollbackPm.currentCommitSha;
                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border font-mono text-xs flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-indigo-950/20 border-indigo-500/40 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-300">Commit {log.commitSha.slice(0, 7)}</span>
                          <span className="text-[10px] text-indigo-300 font-sans">by {log.author || 'Developer'}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-600 text-white font-bold">
                              Current Active
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 font-sans text-xs line-clamp-1">{log.commitMessage || 'Automated Sync'}</p>
                        <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={async () => {
                            setIsRollingBack(true);
                            await handleRollback(rollbackPm.id, log.commitSha);
                            setIsRollingBack(false);
                            setRollbackPm(null);
                          }}
                          disabled={isRollingBack}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0 shadow-md shadow-amber-600/20 transition"
                        >
                          {isRollingBack ? 'Restoring...' : 'Restore'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRollbackPm(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
