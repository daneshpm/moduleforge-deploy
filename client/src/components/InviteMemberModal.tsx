import React, { useState } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { useTeamStore } from '../store/useTeamStore';
import { Team } from '../types';

interface InviteMemberModalProps {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ team, isOpen, onClose }) => {
  const { inviteByEmail } = useTeamStore();

  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailInviteResult, setEmailInviteResult] = useState<{
    inviteLink: string;
    gmailComposeUrl?: string;
    mailtoUrl?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailInviteResult(null);
    setIsSubmitting(true);

    const res = await inviteByEmail(team.id, emailInput.trim(), role);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(`Invitation email sent to ${emailInput.trim()}`);
      if (res.emailResult) {
        setEmailInviteResult(res.emailResult);
      } else if (res.invitation) {
        const baseUrl = window.location.origin;
        setEmailInviteResult({
          inviteLink: `${baseUrl}/invite/${res.invitation.token}`,
        });
      }
      setEmailInput('');
    } else {
      setErrorMessage(res.error || 'Failed to send email invitation');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-7 w-full max-w-lg space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202524]">Invite to {team.name}</h2>
              <p className="text-xs text-[#6B7471]">
                Send an email invitation with a secure 7-day access link.
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

        {/* Email / Gmail Invite Form */}
        <form onSubmit={handleSendEmailInvite} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202524]">Teammate Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="collaborator@gmail.com"
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 font-mono"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-[#6B7471]">
              Generates a secure 7-day token link and automatically delivers a branded invitation email.
            </p>
          </div>

          {/* Email Result Card with 1-click links */}
          {emailInviteResult && (
            <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-2.5">
              <span className="text-[11px] font-bold text-[#202524] uppercase tracking-wider font-mono block">
                Invitation Link Created:
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
            disabled={!emailInput.trim() || isSubmitting}
            className="w-full py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Email Invitation</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
