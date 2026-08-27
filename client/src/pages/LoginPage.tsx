import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Lock, Mail, ArrowRight, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, loginWithGoogleDev } = useAuthStore();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    const res = await loginWithGoogle();
    setIsGoogleLoading(false);
    if (res.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setErrorMsg(res.error || 'Google authentication failed');
    }
  };

  const handleDevGoogleAccount = async (devEmail: string, devName: string) => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    const res = await loginWithGoogleDev(devEmail, devName);
    setIsGoogleLoading(false);
    if (res.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setErrorMsg(res.error || 'Failed to sign in');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const result = isRegister
      ? await register(name, email, password)
      : await login(email, password);

    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setErrorMsg(result.error ?? 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex flex-col justify-center items-center p-6 select-none relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-[#1F5E4B]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F5E4B] p-0.5 shadow-xl shadow-[#1F5E4B]/20 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#202524] tracking-tight">
            {isRegister ? 'Create your account' : 'Welcome to ModuleForge'}
          </h1>
          <p className="text-xs text-[#6B7471] font-mono">Full-Stack Modular Software Platform</p>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-8 rounded-3xl bg-white border border-[#E2E6E4] space-y-5 shadow-2xl">
          {/* Primary Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full py-3 px-4 rounded-xl border border-[#E2E6E4] hover:border-[#1F5E4B]/40 hover:bg-[#F7F8F7] text-[#202524] font-bold text-xs shadow-xs flex items-center justify-center gap-3 transition"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#1F5E4B]" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Quick Dev Switcher */}
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase text-[#6B7471] block">
              Instant Dev Accounts (for quick testing):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDevGoogleAccount('shalya@example.com', 'Shalya Gaonkar')}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E6E4] hover:border-[#1F5E4B]/40 hover:bg-[#EAF3EF] text-[#202524] text-[11px] font-mono font-semibold transition truncate"
              >
                @shalya
              </button>
              <button
                type="button"
                onClick={() => handleDevGoogleAccount('alex@example.com', 'Alex Developer')}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E6E4] hover:border-[#1F5E4B]/40 hover:bg-[#EAF3EF] text-[#202524] text-[11px] font-mono font-semibold transition truncate"
              >
                @alex
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E2E6E4]" />
            <span className="text-[10px] font-mono uppercase text-[#6B7471]">or with email</span>
            <div className="flex-1 h-px bg-[#E2E6E4]" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202524]">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202524]">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] font-mono"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[#6B7471]">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErrorMsg(null);
                }}
                className="text-[#1F5E4B] hover:underline font-semibold"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
