import React, { useState } from 'react';
import {
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Send,
  Link2,
  Sparkles,
} from 'lucide-react';
import { useTeamStore } from '../store/useTeamStore';
import { Team } from '../types';

interface InviteMemberModalProps {
  team?: Team;
  teamId?: string;
  teamName?: string;
  isOpen?: boolean;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  team,
  teamId: propTeamId,
  teamName: propTeamName,
  isOpen = true,
  onClose,
}) => {
  const { inviteByEmail, inviteByUsername } = useTeamStore();

  const targetTeamId = team?.id || propTeamId || '';
  const targetTeamName = team?.name || propTeamName || 'Team';

  const [inviteMode, setInviteMode] = useState<'email' | 'username'>('email');
  const [inputVal, setInputVal] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailInviteResult, setEmailInviteResult] = useState<{
    inviteLink: string;
    gmailComposeUrl?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (isOpen === false) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputVal.trim();
    if (!cleanInput || !targetTeamId) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailInviteResult(null);
    setIsSubmitting(true);

    try {
      if (inviteMode === 'email') {
        const res = await inviteByEmail(targetTeamId, cleanInput, role);
        if (res.success) {
          setSuccessMessage(`Invitation email sent to ${cleanInput}!`);
          if (res.emailResult) {
            setEmailInviteResult(res.emailResult);
          } else if (res.invitation) {
            const baseUrl = window.location.origin;
            const inviteLink = `${baseUrl}/invite/${res.invitation.token}`;
            const subject = `You're invited to join "${targetTeamName}" on ModuleForge`;
            const plainBody = `Hello,\n\nYou have been invited to join the team "${targetTeamName}" on ModuleForge.\n\nClick the link below to accept the invitation and join the team:\n${inviteLink}\n\nHappy building,\nModuleForge Team`;
            setEmailInviteResult({
              inviteLink,
              gmailComposeUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanInput)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`,
            });
          }
          setInputVal('');
        } else {
          setErrorMessage(res.error || 'Failed to send email invitation');
        }
      } else {
        const res = await inviteByUsername(targetTeamId, cleanInput.replace(/^@/, ''), role);
        if (res.success) {
          setSuccessMessage(`Invitation sent to @${cleanInput.replace(/^@/, '')}!`);
          if (res.invitation) {
            const baseUrl = window.location.origin;
            const inviteLink = `${baseUrl}/invite/${res.invitation.token}`;
            const subject = `You're invited to join "${targetTeamName}" on ModuleForge`;
            const plainBody = `Hello,\n\nYou have been invited to join the team "${targetTeamName}" on ModuleForge.\n\nClick the link below to accept the invitation and join the team:\n${inviteLink}\n\nHappy building,\nModuleForge Team`;
            setEmailInviteResult({
              inviteLink,
              gmailComposeUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`,
            });
          }
          setInputVal('');
        } else {
          setErrorMessage(res.error || 'Failed to send username invitation');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-7 w-full max-w-lg space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202524]">Invite to {targetTeamName}</h2>
              <p className="text-xs text-[#6B7471]">
                Add teammates by email or @username to collaborate on microservices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: By Email vs By Username */}
        <div className="grid grid-cols-2 p-1 bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setInviteMode('email');
              setInputVal('');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              inviteMode === 'email'
                ? 'bg-white text-[#1F5E4B] shadow-xs'
                : 'text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Invite by Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setInviteMode('username');
              setInputVal('');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              inviteMode === 'username'
                ? 'bg-white text-[#1F5E4B] shadow-xs'
                : 'text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Invite by @Username</span>
          </button>
        </div>

        {/* Role Selection */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
          <div>
            <label className="text-xs font-semibold text-[#202524] block">Assigned Role</label>
            <span className="text-[11px] text-[#6B7471]">
              {role === 'admin' ? 'Can manage projects & invite members' : 'Can collaborate on team modules'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRole('member')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                role === 'member'
                  ? 'bg-[#1F5E4B] text-white shadow-xs'
                  : 'bg-white text-[#6B7471] border border-[#E2E6E4] hover:text-[#202524]'
              }`}
            >
              Member
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                role === 'admin'
                  ? 'bg-[#1F5E4B] text-white shadow-xs'
                  : 'bg-white text-[#6B7471] border border-[#E2E6E4] hover:text-[#202524]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-[#EAF3EF] border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202524]">
              {inviteMode === 'email' ? 'Teammate Email Address' : 'ModuleForge @Username'}
            </label>
            <div className="relative">
              {inviteMode === 'email' ? (
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
              ) : (
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
              )}
              <input
                type={inviteMode === 'email' ? 'email' : 'text'}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={inviteMode === 'email' ? 'teammate@company.com' : '@danesh'}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 font-mono"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-[#6B7471]">
              {inviteMode === 'email'
                ? 'Generates a secure 7-day token link and delivers a branded invitation email.'
                : 'Instantly sends an in-app team invite to the registered user.'}
            </p>
          </div>

          {/* Shareable Link Result Card */}
          {emailInviteResult && (
            <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-2.5">
              <span className="text-[11px] font-bold text-[#202524] uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Shareable Access Link:</span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={emailInviteResult.inviteLink}
                  className="w-full bg-white border border-[#E2E6E4] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-[#202524] truncate"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(emailInviteResult.inviteLink)}
                  className="p-2 rounded-lg bg-white border border-[#E2E6E4] hover:bg-[#EAF3EF] text-[#1F5E4B] transition shrink-0"
                  title="Copy Link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#2E7D5B]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {emailInviteResult.gmailComposeUrl && (
                <div className="pt-1 flex items-center gap-2">
                  <a
                    href={emailInviteResult.gmailComposeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EAF3EF] border border-[#E2E6E4] text-[#1F5E4B] text-[11px] font-bold flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in Gmail Web</span>
                  </a>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!inputVal.trim() || isSubmitting}
            className="w-full py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{inviteMode === 'email' ? 'Send Email Invitation' : 'Send Direct Invitation'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
