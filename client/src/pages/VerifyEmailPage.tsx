import React, { useEffect, useState } from 'react';
import { Layers, MailCheck, Loader2, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Shown instead of the app while a Firebase email/password user has not verified their email
 * (the API answers 403 EMAIL_NOT_VERIFIED). No API requests are made from here except the explicit
 * "I've verified" re-sync, so there is no request loop while unverified.
 */
export const VerifyEmailPage: React.FC = () => {
  const { pendingVerificationEmail, resendVerificationEmail, confirmEmailVerified, logout } = useAuthStore();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS); // a mail was just sent at sign-up/sign-in
  const [busy, setBusy] = useState<'resend' | 'confirm' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy('resend');
    setMessage(null);
    const r = await resendVerificationEmail();
    setBusy(null);
    if (r.success) {
      setMessage({ kind: 'ok', text: 'Verification email sent. Check your inbox (and spam folder).' });
    } else {
      setMessage({ kind: 'error', text: r.error || 'Could not send the email. Try again shortly.' });
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy('confirm');
    setMessage(null);
    const r = await confirmEmailVerified();
    setBusy(null);
    if (!r.success) {
      setMessage({ kind: 'error', text: r.error || 'Your email is not verified yet.' });
    }
    // On success the store clears pendingVerificationEmail and this page unmounts.
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#1F5E4B]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F5E4B] shadow-md shadow-[#1F5E4B]/20 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#202524] tracking-tight">ModuleForge</h1>
        </div>

        <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center mx-auto">
            <MailCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#202524]">Verify your email</h2>
            <p className="text-xs text-[#6B7471] leading-relaxed">
              We sent a verification link to
            </p>
            <p className="text-sm font-bold text-[#202524] font-mono break-all">{pendingVerificationEmail}</p>
            <p className="text-xs text-[#6B7471] leading-relaxed">
              Open it, then come back here to continue.
            </p>
          </div>

          {message && (
            <div
              className={`flex items-start gap-2 text-left text-xs p-3 rounded-xl border ${
                message.kind === 'ok'
                  ? 'bg-[#EAF3EF] border-[#2E7D5B]/30 text-[#2E7D5B]'
                  : 'bg-[#FDF3F3] border-[#C94A4A]/30 text-[#C94A4A]'
              }`}
              role="status"
            >
              {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy !== null}
              className="w-full py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
            >
              {busy === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>I've verified — continue</span>
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || busy !== null}
              className="w-full py-3 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] disabled:opacity-50 text-[#202524] border border-[#E2E6E4] text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              {busy === 'resend' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{cooldown > 0 ? `Resend verification email (${cooldown}s)` : 'Resend verification email'}</span>
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="w-full py-2 text-xs font-semibold text-[#6B7471] hover:text-[#C94A4A] flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
