import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Github,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const GITHUB_TOKEN_KEY = 'moduleforge_github_token';

export const SettingsPage: React.FC = () => {
  const { user, updateUsername, checkUsernameAvailability } = useAuthStore();

  // Username edit state
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // GitHub token state
  const [githubToken, setGithubToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    if (user) {
      setNameInput(user.name || '');
      setUsernameInput(user.username || '');
    }
  }, [user]);

  useEffect(() => {
    const savedToken = localStorage.getItem(GITHUB_TOKEN_KEY) || '';
    setGithubToken(savedToken);
  }, []);

  // Debounced check for username availability
  useEffect(() => {
    const clean = usernameInput.trim().replace(/^@/, '');
    if (!clean || clean === user?.username) {
      setIsUsernameAvailable(null);
      setUsernameError(null);
      return;
    }

    if (clean.length < 3) {
      setIsUsernameAvailable(false);
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setIsUsernameAvailable(false);
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      const res = await checkUsernameAvailability(clean);
      setIsCheckingUsername(false);
      setIsUsernameAvailable(res.available);
      setUsernameError(res.error || null);
    }, 350);

    return () => clearTimeout(timer);
  }, [usernameInput, user?.username, checkUsernameAvailability]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@/, '');
    if (!clean) return;

    setIsSavingProfile(true);
    setProfileSuccess(null);
    setUsernameError(null);

    const res = await updateUsername(clean, nameInput.trim());
    setIsSavingProfile(false);

    if (res.success) {
      setProfileSuccess('Profile and @username updated successfully!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } else {
      setUsernameError(res.error || 'Failed to update username');
    }
  };

  const handleSaveGitHub = () => {
    if (githubToken && !githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
      setTokenError('Token should start with ghp_ or github_pat_');
      return;
    }
    setTokenError('');
    localStorage.setItem(GITHUB_TOKEN_KEY, githubToken.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClearGitHub = () => {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    setGithubToken('');
  };

  const maskedToken = githubToken
    ? githubToken.slice(0, 8) + '••••••••••••••••' + githubToken.slice(-4)
    : '';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-[#202524] tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-[#1F5E4B]" />
          <span className="primary-text-gradient">Platform Settings</span>
        </h1>
        <p className="text-sm text-[#6B7471] mt-1">
          Manage your developer profile, unique username, and system integrations.
        </p>
      </div>

      <div className="space-y-6">
        {/* User Account & Unique @Username Settings */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2E6E4] space-y-6 shadow-card">
          <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-4">
            <h2 className="text-base font-bold text-[#202524] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1F5E4B]" />
              <span>Developer Profile & Username</span>
            </h2>
            <span className="text-xs font-mono text-[#1F5E4B] bg-[#EAF3EF] px-2.5 py-1 rounded-full font-bold">
              @{user?.username || 'user'}
            </span>
          </div>

          {profileSuccess && (
            <div className="p-3 rounded-xl bg-[#EAF3EF] border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {usernameError && (
            <div className="p-3 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{usernameError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Full Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Shalya Gaonkar"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524] flex items-center justify-between">
                  <span>Unique Username</span>
                  {isCheckingUsername && (
                    <span className="text-[10px] text-[#6B7471] font-mono flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#6B7471]">
                    @
                  </span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/gi, ''))}
                    placeholder="shalya"
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-7 pr-8 py-2.5 text-xs font-mono text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                    required
                  />
                  {isUsernameAvailable === true && (
                    <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] absolute right-2.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-[#6B7471] block text-[10px]">EMAIL ADDRESS</span>
                <span className="text-[#202524] font-bold">{user?.email || 'developer@moduleforge.io'}</span>
              </div>
              <span className="text-[10px] text-[#6B7471]">Google OAuth Linked</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile || isCheckingUsername || isUsernameAvailable === false}
                className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition"
              >
                {isSavingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
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
            Add your GitHub Personal Access Token to enable seamless Git repository imports and version synchronization.
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
                  onChange={(e) => {
                    setGithubToken(e.target.value);
                    setTokenError('');
                  }}
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
      </div>
    </div>
  );
};
