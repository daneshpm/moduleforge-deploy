import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Layers,
  Lock,
  Mail,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Code2,
  ArrowLeft,
  X,
  Crown,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface AuthPageProps {
  initialMode?: 'signin' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loginWithGoogle, resetPassword, isAuthenticated } = useAuthStore();

  const isSignUpPath = location.pathname.includes('signup') || location.pathname.includes('register');
  const [isRegister, setIsRegister] = useState<boolean>(
    initialMode ? initialMode === 'signup' : isSignUpPath
  );

  useEffect(() => {
    setIsRegister(initialMode ? initialMode === 'signup' : isSignUpPath);
  }, [location.pathname, initialMode, isSignUpPath]);

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passStrength = calculatePasswordStrength(password);
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-[#C94A4A]', 'bg-[#C94A4A]/80', 'bg-amber-500', 'bg-[#2E7D5B]/80', 'bg-[#2E7D5B]'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isRegister) {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isRegister) {
        const result = await register(name, email, password);
        if (result.success) {
          navigate('/dashboard', { replace: true });
        } else {
          setErrorMsg(result.error ?? 'Registration failed.');
        }
      } else {
        const result = await login(email, password);
        if (result.success) {
          navigate('/dashboard', { replace: true });
        } else {
          setErrorMsg(result.error ?? 'Authentication failed.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsGoogleSubmitting(true);
    const result = await loginWithGoogle();
    setIsGoogleSubmitting(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setErrorMsg(result.error ?? 'Google sign-in failed.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetStatus(null);

    const res = await resetPassword(resetEmail.trim());
    setResetLoading(false);
    if (res.success) {
      setResetStatus({
        success: true,
        msg: `Password reset link sent to ${resetEmail}. Check your inbox!`,
      });
    } else {
      setResetStatus({
        success: false,
        msg: res.error || 'Failed to send reset email.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] text-[#202524] flex flex-col justify-between selection:bg-[#1F5E4B] selection:text-white relative overflow-x-hidden">
      {/* Subtle Green Ambient Background */}
      <div className="fixed top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-[#EAF3EF] blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-15%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-[#D1E6DC]/40 blur-[140px] pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#E2E6E4] px-6 sm:px-12 flex items-center justify-between sticky top-0 bg-white/85 backdrop-blur-xl z-40 shadow-xs">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#1F5E4B] p-0.5 shadow-md shadow-[#1F5E4B]/20 group-hover:scale-105 transition flex items-center justify-center">
            <Layers className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight primary-text-gradient">ModuleForge</span>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7471] hover:text-[#202524] transition px-3 py-1.5 rounded-xl hover:bg-[#EAF3EF]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 z-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Hero/Branding Showcase */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 rounded-3xl bg-[#EAF3EF] border border-[#1F5E4B]/20 shadow-sm relative overflow-hidden">
            <div className="space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#1F5E4B]/20 text-[#1F5E4B] text-xs font-mono font-bold shadow-xs">
                <Crown className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Modular Architecture</span>
              </div>

              <div>
                <h2 className="text-3xl font-black text-[#202524] tracking-tight leading-snug">
                  Build faster with <span className="primary-text-gradient">verified modules.</span>
                </h2>
                <p className="text-sm text-[#6B7471] mt-3 leading-relaxed">
                  Combine backend microservices, visual canvases, and pre-built frontend blocks into a production-ready stack in seconds.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-white text-[#1F5E4B] shrink-0 mt-0.5 border border-[#1F5E4B]/20 shadow-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#202524]">Visual Drag & Drop Flow</h4>
                    <p className="text-[11px] text-[#6B7471]">Compose complex microservice pipelines with node-based canvas.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-white text-[#1F5E4B] shrink-0 mt-0.5 border border-[#1F5E4B]/20 shadow-xs">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#202524]">Full Git Sync & Webhooks</h4>
                    <p className="text-[11px] text-[#6B7471]">Auto-sync GitHub repositories, commits, and multi-service runners.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-white text-[#1F5E4B] shrink-0 mt-0.5 border border-[#1F5E4B]/20 shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#202524]">Secure Authentication</h4>
                    <p className="text-[11px] text-[#6B7471]">Enterprise token management, OAuth, and encrypted session store.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom mini status badge */}
            <div className="pt-8 border-t border-[#1F5E4B]/20 flex items-center justify-between text-xs text-[#6B7471] font-mono">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
                <span className="text-[#202524] font-semibold">Platform Online</span>
              </span>
              <span className="text-[11px] text-[#1F5E4B] font-bold">PRO EDITION</span>
            </div>
          </div>

          {/* Right Card: Auth Form */}
          <div className="w-full lg:col-span-7 flex flex-col justify-center">
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E2E6E4] shadow-card relative">
              {/* Tab Selector: Sign In vs Sign Up */}
              <div className="grid grid-cols-2 p-1 bg-[#F7F8F7] rounded-2xl border border-[#E2E6E4] mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                    !isRegister
                      ? 'bg-[#1F5E4B] text-white shadow-xs'
                      : 'text-[#6B7471] hover:text-[#202524]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                    isRegister
                      ? 'bg-[#1F5E4B] text-white shadow-xs'
                      : 'text-[#6B7471] hover:text-[#202524]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Header Title */}
              <div className="mb-6 space-y-1">
                <h1 className="text-2xl font-black text-[#202524] tracking-tight">
                  {isRegister ? 'Create your ModuleForge account' : 'Welcome back to ModuleForge'}
                </h1>
                <p className="text-xs text-[#6B7471]">
                  {isRegister
                    ? 'Start building modular full-stack projects in minutes.'
                    : 'Enter your credentials to access your workspaces and modules.'}
                </p>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C94A4A]" />
                  <span className="flex-1 font-semibold">{errorMsg}</span>
                  <button onClick={() => setErrorMsg(null)} className="text-[#C94A4A] hover:text-[#A83B3B]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Success Banner */}
              {successMsg && (
                <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-[#F0F9F5] border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#2E7D5B]" />
                  <span className="flex-1 font-semibold">{successMsg}</span>
                  <button onClick={() => setSuccessMsg(null)} className="text-[#2E7D5B] hover:text-[#246549]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Google 1-Click Sign-in Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleSubmitting || isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-[#F7F8F7] border border-[#E2E6E4] hover:border-[#1F5E4B]/40 text-[#202524] font-semibold text-xs flex items-center justify-center gap-3 transition shadow-xs disabled:opacity-60 group"
              >
                {isGoogleSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1F5E4B]" />
                ) : (
                  <svg className="w-4 h-4 transition group-hover:scale-110" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.3s.7 5.6 1.9 8l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-6">
                <div className="border-t border-[#E2E6E4] w-full" />
                <span className="bg-white px-3 text-[11px] text-[#6B7471] font-mono uppercase tracking-wider">
                  or with email
                </span>
                <div className="border-t border-[#E2E6E4] w-full" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name for Registration */}
                {isRegister && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524]">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@company.com"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#202524]">Password</label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setIsResetOpen(true);
                          setResetStatus(null);
                        }}
                        className="text-[11px] text-[#1F5E4B] hover:text-[#174739] font-semibold transition"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition font-mono"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7471] hover:text-[#202524] transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {isRegister && password.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#6B7471]">
                        <span className="text-[#1F5E4B] font-bold">Strength: {strengthLabels[passStrength]}</span>
                        <span>{password.length < 6 ? 'Min 6 chars' : '✓ Length OK'}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1">
                        {[0, 1, 2, 3].map((idx) => (
                          <div
                            key={idx}
                            className={`h-full rounded-full transition-all ${
                              passStrength > idx ? strengthColors[passStrength] : 'bg-[#E2E6E4]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                {isRegister && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524]">Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full bg-[#F7F8F7] border rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none transition font-mono ${
                          confirmPassword && confirmPassword !== password
                            ? 'border-[#C94A4A] focus:border-[#C94A4A]'
                            : 'border-[#E2E6E4] focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15'
                        }`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7471] hover:text-[#202524] transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[#F7F8F7] border-[#E2E6E4] text-[#1F5E4B] focus:ring-0"
                    />
                    <span className="text-xs text-[#6B7471]">
                      {isRegister ? 'I agree to Terms & Conditions' : 'Keep me signed in'}
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleSubmitting}
                  className="w-full py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition transform active:scale-[0.99] mt-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>{isRegister ? 'Create My Account' : 'Sign In to Workspace'}</span>
                      <ArrowRight className="w-4 h-4 text-white stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Switch Link */}
              <div className="pt-6 mt-6 border-t border-[#E2E6E4] text-center text-xs text-[#6B7471]">
                {isRegister ? (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegister(false);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[#1F5E4B] hover:text-[#174739] font-bold transition underline-offset-4 hover:underline"
                    >
                      Sign In
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegister(true);
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-[#1F5E4B] hover:text-[#174739] font-bold transition underline-offset-4 hover:underline"
                    >
                      Create one for free
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-[#6B7471] font-mono z-10">
        ModuleForge © {new Date().getFullYear()} • Pro Edition
      </footer>

      {/* Forgot Password Modal */}
      {isResetOpen && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-5 shadow-2xl relative">
            <button
              onClick={() => setIsResetOpen(false)}
              className="absolute top-4 right-4 text-[#6B7471] hover:text-[#202524] transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#202524] flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#1F5E4B]" />
                <span>Reset your password</span>
              </h3>
              <p className="text-xs text-[#6B7471]">
                Enter your account email address and we will send you a secure link to reset your password.
              </p>
            </div>

            {resetStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  resetStatus.success
                    ? 'bg-[#F0F9F5] border border-[#2E7D5B]/20 text-[#2E7D5B]'
                    : 'bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A]'
                }`}
              >
                {resetStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2E7D5B]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#C94A4A]" />
                )}
                <span className="font-semibold">{resetStatus.msg}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Account Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] text-xs font-semibold transition border border-[#E2E6E4]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition disabled:opacity-60"
                >
                  {resetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <span>Send Reset Link</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
