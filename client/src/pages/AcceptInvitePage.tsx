import React, { useEffect, useState } from 'react';
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
  Layers,
  Check,
  X,
  LogIn,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';

interface TeamInviteDetails {
  id: string;
  teamId: string;
  teamName: string;
  teamDescription?: string;
  teamAvatarUrl?: string;
  memberCount: number;
  projectCount: number;
  inviterName: string;
  inviterUsername?: string;
  inviterAvatarUrl?: string;
  inviteeEmail?: string;
  role: string;
  expiresAt: string;
}

export const AcceptInvitePage: React.FC = () => {
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const tokenParam = params.token || searchParams.get('token');
  const codeParam = searchParams.get('code');

  const navigate = useNavigate();
  const { user, isAuthenticated, loginWithGoogle } = useAuthStore();
  const { validateJoinCode } = useProjectStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamInvite, setTeamInvite] = useState<TeamInviteDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  // Validate Invitation Token
  useEffect(() => {
    const validate = async () => {
      if (!tokenParam) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/invitations/${tokenParam}`);
        const data = await res.json();

        if (res.ok && data.invitation) {
          setTeamInvite(data.invitation);
          if (data.isExpired) {
            setError('This invitation has expired (7-day validity exceeded). Please ask the team administrator for a new invite.');
          }
        } else {
          // Check fallback for project invite token
          const projRes = await fetch(`/api/projects/invites/validate?token=${tokenParam}`);
          const projData = await projRes.json();
          if (projRes.ok && projData.project) {
            navigate(`/join-project?token=${tokenParam}`);
            return;
          }
          setError(data.error || 'Invalid or unknown invitation link.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to validate invitation');
      } finally {
        setIsLoading(false);
      }
    };

    validate();
  }, [tokenParam, navigate]);

  const handleAccept = async () => {
    if (!tokenParam || !user) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${tokenParam}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (res.ok) {
        setAcceptedSuccess(true);
        setTimeout(() => {
          navigate(data.teamId ? `/teams/${data.teamId}` : '/teams');
        }, 1500);
      } else {
        setError(data.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Network error while accepting invitation');
    }
  };

  const handleDecline = async () => {
    if (!tokenParam) return;
    setIsSubmitting(true);
    try {
      await fetch(`/api/invitations/${tokenParam}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      navigate('/dashboard');
    } catch {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex flex-col items-center justify-center p-4 select-none relative overflow-hidden">
      {/* Background glow accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#1F5E4B]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-lg space-y-6 relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F5E4B] p-0.5 shadow-md shadow-[#1F5E4B]/20 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#202524] tracking-tight">
            ModuleForge
          </h1>
          <p className="text-xs text-[#6B7471] font-mono">Team Collaboration Invitation</p>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#1F5E4B] animate-spin mx-auto" />
              <p className="text-xs text-[#6B7471] font-mono">Validating invitation link...</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF3F3] text-[#C94A4A] flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#202524]">Invitation Unavailable</h3>
                <p className="text-xs text-[#6B7471] max-w-xs mx-auto leading-relaxed">{error}</p>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition"
              >
                Go to Dashboard
              </button>
            </div>
          ) : acceptedSuccess ? (
            <div className="py-8 text-center space-y-4 animate-scale-in">
              <div className="w-14 h-14 rounded-2xl bg-[#EAF3EF] border border-[#2E7D5B]/30 text-[#2E7D5B] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#202524]">Welcome to the Team!</h3>
                <p className="text-xs text-[#6B7471]">
                  You have successfully joined <span className="font-bold text-[#1F5E4B]">{teamInvite?.teamName}</span>. Redirecting to team workspace...
                </p>
              </div>
              <Loader2 className="w-5 h-5 text-[#1F5E4B] animate-spin mx-auto" />
            </div>
          ) : teamInvite ? (
            <div className="space-y-6">
              {/* Team Profile Header */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4]">
                <img
                  src={teamInvite.teamAvatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${teamInvite.teamName}`}
                  alt={teamInvite.teamName}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#1F5E4B]/20 shadow-xs"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase text-[#1F5E4B] tracking-wider block">
                    You've been invited to join
                  </span>
                  <h2 className="text-lg font-black text-[#202524] truncate">{teamInvite.teamName}</h2>
                  <p className="text-xs text-[#6B7471] line-clamp-1">
                    {teamInvite.teamDescription || 'Modular full-stack development team.'}
                  </p>
                </div>
              </div>

              {/* Inviter & Role Details */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
                  <span className="text-[#6B7471] block text-[10px] uppercase">Invited By</span>
                  <span className="font-bold text-[#202524] truncate block">
                    {teamInvite.inviterName}
                  </span>
                  {teamInvite.inviterUsername && (
                    <span className="text-[#1F5E4B] text-[11px] block font-semibold">
                      @{teamInvite.inviterUsername}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
                  <span className="text-[#6B7471] block text-[10px] uppercase">Assigned Role</span>
                  <span className="font-bold text-[#1F5E4B] capitalize block text-sm">
                    {teamInvite.role}
                  </span>
                  <span className="text-[#6B7471] text-[10px] block">
                    {teamInvite.role === 'admin' ? 'Team Administrator' : 'Standard Member'}
                  </span>
                </div>
              </div>

              {/* Login State check */}
              {!isAuthenticated ? (
                <div className="space-y-4 pt-2 border-t border-[#E2E6E4]">
                  <div className="p-3.5 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-xs text-[#1F5E4B] space-y-1">
                    <span className="font-bold block">Sign in required</span>
                    <p className="text-[11px] text-[#6B7471]">
                      Please sign in with your Google account to claim your username and join this team automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => loginWithGoogle()}
                    className="w-full py-3.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign in with Google to Accept</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-[#E2E6E4]">
                  <div className="flex items-center justify-between text-xs text-[#6B7471] px-1">
                    <span>Joining as:</span>
                    <span className="font-bold text-[#202524] font-mono">
                      {user?.name} (@{user?.username || 'user'})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDecline}
                      disabled={isSubmitting}
                      className="w-1/3 py-3 rounded-xl bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] border border-[#E2E6E4] text-xs font-semibold transition"
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={isSubmitting}
                      className="w-2/3 py-3 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Join Team →</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
