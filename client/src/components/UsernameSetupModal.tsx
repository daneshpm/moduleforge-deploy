import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, AlertCircle, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const UsernameSetupModal: React.FC = () => {
  const { user, needsUsernameSetup, updateUsername, checkUsernameAvailability, setNeedsUsernameSetup } = useAuthStore();
  
  const [usernameInput, setUsernameInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.username) {
      setUsernameInput(user.username);
    } else if (user?.email) {
      const initial = user.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 15);
      setUsernameInput(initial);
    }
  }, [user]);

  // Debounced check for username availability
  useEffect(() => {
    const clean = usernameInput.trim().replace(/^@/, '');
    if (!clean) {
      setIsAvailable(null);
      setErrorMessage(null);
      return;
    }

    if (clean.length < 3) {
      setIsAvailable(false);
      setErrorMessage('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setIsAvailable(false);
      setErrorMessage('Only letters, numbers, and underscores allowed');
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      const res = await checkUsernameAvailability(clean);
      setIsChecking(false);
      setIsAvailable(res.available);
      setErrorMessage(res.error || null);
    }, 350);

    return () => clearTimeout(timer);
  }, [usernameInput, checkUsernameAvailability]);

  if (!needsUsernameSetup || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim().replace(/^@/, '');
    if (!clean || isAvailable === false) return;

    setIsSubmitting(true);
    const res = await updateUsername(clean);
    setIsSubmitting(false);

    if (res.success) {
      setNeedsUsernameSetup(false);
    } else {
      setErrorMessage(res.error || 'Failed to set username');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-6 shadow-2xl relative overflow-hidden">
        {/* Decorative background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1F5E4B]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center mx-auto text-[#1F5E4B] shadow-xs">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#202524] tracking-tight">
            Claim Your Unique Username
          </h2>
          <p className="text-xs text-[#6B7471] leading-relaxed">
            Every ModuleForge developer has a unique <span className="font-mono text-[#1F5E4B] font-semibold">@username</span> used to collaborate and receive team invitations.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#202524] flex items-center justify-between">
              <span>Choose Username</span>
              {isChecking && (
                <span className="text-[11px] text-[#6B7471] flex items-center gap-1 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                </span>
              )}
            </label>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-[#6B7471]">
                @
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/gi, ''))}
                placeholder="username"
                maxLength={20}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-8 pr-10 py-3 text-sm font-mono text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition"
                required
                autoFocus
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {isAvailable === true && (
                  <CheckCircle2 className="w-5 h-5 text-[#2E7D5B] animate-scale-in" />
                )}
                {isAvailable === false && !isChecking && (
                  <AlertCircle className="w-5 h-5 text-[#C94A4A] animate-scale-in" />
                )}
              </div>
            </div>

            {errorMessage && (
              <p className="text-[11px] text-[#C94A4A] font-mono flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}

            {isAvailable === true && !errorMessage && (
              <p className="text-[11px] text-[#2E7D5B] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>@{usernameInput.trim()} is available!</span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center gap-3">
            <img
              src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || user.email)}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#1F5E4B]/20 shrink-0"
            />
            <div className="text-xs overflow-hidden">
              <span className="font-bold text-[#202524] block truncate">{user.name || 'Developer'}</span>
              <span className="text-[#6B7471] block truncate text-[11px] font-mono">
                @{usernameInput.trim() || 'username'} • {user.email}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isAvailable || isSubmitting || isChecking}
            className="w-full py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Complete Setup & Enter Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
