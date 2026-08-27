import React, { useState, useEffect } from 'react';
import { Settings, Zap, ShieldCheck, Database, HardDrive, Cpu, Github, Eye, EyeOff, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const GITHUB_TOKEN_KEY = 'moduleforge_github_token';
const GITHUB_WEBHOOK_SECRET_KEY = 'moduleforge_github_webhook_secret';

export const SettingsPage: React.FC = () => {
  const { user, isDevMode } = useAuthStore();

  const [githubToken, setGithubToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem(GITHUB_TOKEN_KEY) || '';
    const savedSecret = localStorage.getItem(GITHUB_WEBHOOK_SECRET_KEY) || '';
    setGithubToken(savedToken);
    setWebhookSecret(savedSecret);
  }, []);

  const handleSaveGitHub = () => {
    if (githubToken && !githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      setTokenError('Token should start with ghp_ or github_pat_');
      return;
    }
    setTokenError('');
    localStorage.setItem(GITHUB_TOKEN_KEY, githubToken.trim());
    localStorage.setItem(GITHUB_WEBHOOK_SECRET_KEY, webhookSecret.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClearGitHub = () => {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    localStorage.removeItem(GITHUB_WEBHOOK_SECRET_KEY);
    setGithubToken('');
    setWebhookSecret('');
  };

  const maskedToken = githubToken
    ? githubToken.slice(0, 8) + '••••••••••••••••' + githubToken.slice(-4)
    : '';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-indigo-400" />
          <span>Platform Settings</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          System environment configuration and developer mode settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* User Account Settings */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>Developer Account</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">NAME</span>
              <span className="text-white font-bold">{user?.name || 'Dev Architect'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">EMAIL</span>
              <span className="text-indigo-400 font-bold">{user?.email || 'developer@moduleforge.io'}</span>
            </div>
          </div>
        </div>

        {/* GitHub Integration */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Github className="w-5 h-5 text-slate-300" />
              <span>GitHub Integration</span>
            </h2>
            {githubToken && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Token configured
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Add your GitHub Personal Access Token to enable automatic webhook registration for modules.
            The token is stored locally in your browser and sent only to the ModuleForge API.
          </p>

          <div className="space-y-4">
            {/* Token input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Personal Access Token
                <span className="ml-2 text-slate-500 font-normal">
                  (needs <code className="text-indigo-400">repo</code> scope)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => { setGithubToken(e.target.value); setTokenError(''); }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 pr-10"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {tokenError && (
                <p className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" /> {tokenError}
                </p>
              )}
              {githubToken && !showToken && (
                <p className="text-xs text-slate-500 font-mono">{maskedToken}</p>
              )}
            </div>

            {/* Webhook secret input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Webhook Secret
                <span className="ml-2 text-slate-500 font-normal">(optional, for HMAC verification)</span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="your_webhook_secret"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 pr-10"
                />
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* How to get a token */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">How to get a token:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-500">
                <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">github.com/settings/tokens/new</a></li>
                <li>Set a note (e.g. "ModuleForge")</li>
                <li>Check the <code className="text-indigo-400">repo</code> scope (full checkbox)</li>
                <li>Click Generate token and paste it above</li>
              </ol>
            </div>

            {/* Save / Clear buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveGitHub}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
              >
                {saved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save Token'}
              </button>
              {githubToken && (
                <button
                  onClick={handleClearGitHub}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold border border-slate-700 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Environment & Services Status */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            <span>Services & Infrastructure</span>
          </h2>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>Database Engine</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                SQLite / PostgreSQL Ready (Prisma)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Authentication Provider</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                Local Dev Mode Fallback
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Module Storage</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                Local Storage (/uploads)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>Export Format</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                ZIP with PROJECT.json
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
