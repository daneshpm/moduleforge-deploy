import React, { useEffect, useState } from 'react';
import {
  Github,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  History,
  GitCommit,
  User,
  Zap,
  ZapOff,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Module, ModuleSyncLog } from '../types';
import { useModuleStore } from '../store/useModuleStore';

interface GitHubSyncCardProps {
  module: Module;
  onModuleUpdated?: (mod: Module) => void;
}

interface WebhookStatus {
  registered: boolean;
  webhookId?: string;
  webhookUrl?: string;
  active?: boolean;
  tokenMissing?: boolean;
  error?: string;
}

export const GitHubSyncCard: React.FC<GitHubSyncCardProps> = ({ module, onModuleUpdated }) => {
  const {
    syncModule,
    checkModuleSync,
    fetchModuleSyncHistory,
    fetchWebhookStatus,
    registerWebhook,
    deleteWebhook,
  } = useModuleStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [syncHistory, setSyncHistory] = useState<ModuleSyncLog[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Webhook state
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);

  const repoName =
    module.githubOwner && module.githubRepo
      ? `${module.githubOwner}/${module.githubRepo}`
      : 'Connected Repository';
  const repoUrl = module.githubUrl || `https://github.com/${repoName}`;
  const status = module.githubSyncStatus || (module.sourceType === 'github' ? 'synced' : 'not_connected');

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadHistory = async () => {
    if (module.sourceType === 'github') {
      const logs = await fetchModuleSyncHistory(module.id);
      setSyncHistory(logs);
    }
  };

  const loadWebhookStatus = async () => {
    if (module.sourceType !== 'github') return;
    setIsLoadingWebhook(true);
    const result = await fetchWebhookStatus(module.id);
    setWebhookStatus(result);
    setIsLoadingWebhook(false);
  };

  useEffect(() => {
    loadHistory();
    loadWebhookStatus();
  }, [module.id]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCheckSync = async () => {
    setIsChecking(true);
    const result = await checkModuleSync(module.id);
    setIsChecking(false);
    if (result.success) {
      showMessage(result.hasUpdate ? '🔔 New changes found on GitHub!' : '✓ Already up to date', result.hasUpdate ? 'info' : 'success');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncModule(module.id);
    setIsSyncing(false);
    if (result.success && result.module) {
      showMessage('✓ Module synchronized successfully!', 'success');
      if (onModuleUpdated) onModuleUpdated(result.module);
      loadHistory();
    } else {
      showMessage(`Sync failed: ${result.error || 'Unknown error'}`, 'error');
    }
  };

  const handleRegisterWebhook = async () => {
    setIsRegisteringWebhook(true);
    const result = await registerWebhook(module.id);
    setIsRegisteringWebhook(false);
    if (result.success) {
      showMessage(
        result.alreadyRegistered
          ? '✓ Webhook was already registered'
          : '✅ Webhook registered — GitHub will now push live updates!',
        'success'
      );
      await loadWebhookStatus();
    } else {
      showMessage(`Failed to register webhook: ${result.error || 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteWebhook = async () => {
    setIsDeletingWebhook(true);
    const result = await deleteWebhook(module.id);
    setIsDeletingWebhook(false);
    if (result.success) {
      showMessage('Webhook removed from GitHub', 'info');
      setWebhookStatus((prev) => (prev ? { ...prev, registered: false, webhookId: undefined } : null));
    } else {
      showMessage(`Failed to remove webhook: ${result.error || 'Unknown error'}`, 'error');
    }
  };

  // ── Early return: not a GitHub module ─────────────────────────────────────

  if (module.sourceType !== 'github') {
    return (
      <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-3 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#6B7471] font-bold text-sm">
            <Github className="w-4 h-4" />
            <span>GitHub Sync</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4]">
            ⚪ Not connected to GitHub
          </span>
        </div>
        <p className="text-xs text-[#6B7471] leading-relaxed">
          This module was uploaded directly as a ZIP package. To enable continuous team
          synchronization via GitHub webhooks, import from GitHub instead.
        </p>
      </div>
    );
  }

  const formattedDate = module.githubLastSyncedAt
    ? new Date(module.githubLastSyncedAt).toLocaleString()
    : 'Just now';

  // ── Webhook panel helpers ─────────────────────────────────────────────────

  const webhookRegistered = webhookStatus?.registered === true;
  const webhookActive = webhookStatus?.active !== false;
  const tokenMissing = webhookStatus?.tokenMissing === true;

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-5 shadow-card">
      {/* Header & status badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B]">
            <Github className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-[#202524] text-sm">GitHub Team Sync</h3>
            <p className="text-[11px] font-mono text-[#6B7471]">{repoName}</p>
          </div>
        </div>

        {status === 'synced' && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/30 flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
            <span>🟢 Synced</span>
          </span>
        )}
        {status === 'update_available' && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>🟡 Update available</span>
          </span>
        )}
        {status === 'sync_failed' && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FDF3F3] text-[#C94A4A] border border-[#C94A4A]/20 flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#C94A4A]" />
            <span>🔴 Sync failed</span>
          </span>
        )}
      </div>

      {/* Repo info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] text-xs font-mono">
        <div>
          <span className="text-[#6B7471] block text-[10px] uppercase">Repository</span>
          <span className="text-[#202524] font-semibold truncate block">{repoName}</span>
        </div>
        <div>
          <span className="text-[#6B7471] block text-[10px] uppercase">Branch</span>
          <span className="text-[#1F5E4B] font-semibold">{module.githubBranch || 'main'}</span>
        </div>
        <div>
          <span className="text-[#6B7471] block text-[10px] uppercase">Current Commit</span>
          <span className="text-[#2E7D5B] font-semibold">
            {module.githubCurrentCommit?.slice(0, 7) || '—'}
          </span>
        </div>
        <div>
          <span className="text-[#6B7471] block text-[10px] uppercase">Last Synced</span>
          <span className="text-[#202524] truncate block">{formattedDate}</span>
        </div>
      </div>

      {/* Live Webhook panel */}
      <div className="rounded-xl border border-[#E2E6E4] overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F7F8F7] border-b border-[#E2E6E4]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#202524]">
            <Zap className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>Live Push Webhook</span>
          </div>

          {/* Webhook status pill */}
          {isLoadingWebhook ? (
            <span className="flex items-center gap-1.5 text-xs text-[#6B7471] font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking…
            </span>
          ) : tokenMissing ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-3 h-3" />
              Token missing
            </span>
          ) : webhookRegistered && webhookActive ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/30 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
              Active
            </span>
          ) : webhookRegistered && !webhookActive ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Inactive
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4] flex items-center gap-1.5">
              <ZapOff className="w-3 h-3" />
              Not registered
            </span>
          )}
        </div>

        {/* Panel body */}
        <div className="px-4 py-3 space-y-3 bg-white">
          {tokenMissing ? (
            <p className="text-xs text-amber-700 leading-relaxed">
              Set <code className="bg-amber-50 px-1 rounded text-amber-800">GITHUB_TOKEN</code> and{' '}
              <code className="bg-amber-50 px-1 rounded text-amber-800">WEBHOOK_PUBLIC_URL</code> in{' '}
              <code className="bg-amber-50 px-1 rounded text-amber-800">server/.env</code> to enable
              automatic webhook registration.
            </p>
          ) : webhookRegistered ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs font-mono text-[#6B7471]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[#2E7D5B] font-bold">Webhook active</span>
                  {webhookStatus?.webhookUrl && (
                    <span className="block text-[11px] text-[#6B7471] truncate mt-0.5">
                      → {webhookStatus.webhookUrl}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[#6B7471] leading-relaxed">
                Every push to <span className="text-[#202524] font-semibold">{module.githubBranch || 'main'}</span> will
                automatically sync this module and broadcast a live update.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#6B7471] leading-relaxed">
              Register a webhook so GitHub automatically notifies ModuleForge on every push.
            </p>
          )}

          {/* Webhook action buttons */}
          {!tokenMissing && (
            <div className="flex items-center gap-2 pt-1">
              {!webhookRegistered ? (
                <button
                  onClick={handleRegisterWebhook}
                  disabled={isRegisteringWebhook}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition"
                >
                  {isRegisteringWebhook ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  <span>{isRegisteringWebhook ? 'Registering…' : 'Register Webhook'}</span>
                </button>
              ) : (
                <button
                  onClick={handleDeleteWebhook}
                  disabled={isDeletingWebhook}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FDF3F3] hover:bg-[#FBE6E6] disabled:opacity-50 text-[#C94A4A] border border-[#C94A4A]/20 text-xs font-bold transition"
                >
                  {isDeletingWebhook ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeletingWebhook ? 'Removing…' : 'Remove Webhook'}</span>
                </button>
              )}

              <button
                onClick={loadWebhookStatus}
                disabled={isLoadingWebhook}
                title="Refresh webhook status"
                className="p-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] border border-[#E2E6E4] transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWebhook ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast message */}
      {message && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 animate-fade-in ${
            message.type === 'success'
              ? 'bg-[#F0F9F5] border-[#2E7D5B]/30 text-[#2E7D5B] font-bold'
              : message.type === 'error'
              ? 'bg-[#FDF3F3] border-[#C94A4A]/20 text-[#C94A4A] font-bold'
              : 'bg-[#EAF3EF] border-[#1F5E4B]/20 text-[#1F5E4B] font-bold'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Manual sync & check actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing…' : status === 'update_available' ? 'Sync Latest Version' : 'Sync Now'}</span>
        </button>

        <button
          onClick={handleCheckSync}
          disabled={isChecking}
          className="py-2.5 px-4 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] disabled:opacity-50 text-[#202524] text-xs font-semibold border border-[#E2E6E4] flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6B7471] ${isChecking ? 'animate-spin' : ''}`} />
          <span>Check Status</span>
        </button>

        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          className="py-2.5 px-3.5 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] border border-[#E2E6E4] text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3.5 h-3.5 text-[#6B7471]" />
        </a>
      </div>

      {/* Sync history */}
      <div className="space-y-2 pt-2 border-t border-[#E2E6E4]">
        <div className="flex items-center justify-between text-xs font-mono text-[#6B7471]">
          <span className="flex items-center gap-1.5 font-bold text-[#202524]">
            <History className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>Version Sync History</span>
          </span>
          <span>{syncHistory.length} sync logs</span>
        </div>

        {syncHistory.length > 0 ? (
          <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto pr-1">
            {syncHistory.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GitCommit className="w-3.5 h-3.5 text-[#1F5E4B] shrink-0" />
                  <span className="px-1.5 py-0.5 rounded bg-[#EAF3EF] text-[#1F5E4B] font-bold text-[11px] border border-[#1F5E4B]/20 shrink-0">
                    {log.commitSha.slice(0, 7)}
                  </span>
                  <span className="text-[#202524] truncate text-xs" title={log.commitMessage || ''}>
                    {log.commitMessage || 'Synchronized update'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[11px] text-[#6B7471]">
                  <span className="hidden sm:flex items-center gap-1">
                    <User className="w-3 h-3 text-[#6B7471]" />
                    {log.author || 'Dev'}
                  </span>
                  <span>{new Date(log.syncedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] text-xs font-mono text-[#6B7471] italic text-center">
            No sync history yet. Register the webhook or click "Sync Now" to log the first entry.
          </div>
        )}
      </div>
    </div>
  );
};
