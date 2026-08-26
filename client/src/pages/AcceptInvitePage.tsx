import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Clock, RefreshCw, KeyRound, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';

interface ProjectPreview {
  id: string;
  name: string;
  description?: string;
  ownerName: string;
  joinCode?: string;
  modulesCount: number;
}

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const codeParam = searchParams.get('code');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { validateJoinCode, joinProjectByCode, checkMemberStatus } = useProjectStore();

  const [joinCodeInput, setJoinCodeInput] = useState(codeParam || '');
  const [userName, setUserName] = useState(user?.name || '');
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [validatedProject, setValidatedProject] = useState<ProjectPreview | null>(null);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'submitting' | 'pending_approval' | 'accepted' | 'rejected'>('idle');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Validate join code if provided in URL or input
  const handleValidateCode = async (codeToValidate: string) => {
    if (!codeToValidate.trim()) return;
    setIsLoading(true);
    setError(null);

    const res = await validateJoinCode(codeToValidate.trim());
    setIsLoading(false);
    if (res.valid && res.project) {
      setValidatedProject(res.project);
      setActiveProjectId(res.project.id);
    } else {
      setError(res.error || 'Invalid team join code.');
      setValidatedProject(null);
    }
  };

  // Validate token if provided in URL
  const handleValidateToken = async (tokenToValidate: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/invites/validate?token=${tokenToValidate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to validate invitation link');

      setValidatedProject(data.project);
      setActiveProjectId(data.project.id);
      if (data.member?.email) setUserEmail(data.member.email);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) {
      handleValidateCode(codeParam);
    } else if (tokenParam) {
      handleValidateToken(tokenParam);
    }
    if (user?.name && !userName) setUserName(user.name);
    if (user?.email && !userEmail) setUserEmail(user.email);
  }, [codeParam, tokenParam, user]);

  // Polling check when waiting for owner approval
  useEffect(() => {
    if (joinStatus !== 'pending_approval' || !activeProjectId || !userEmail) return;

    const interval = setInterval(async () => {
      const res = await checkMemberStatus(activeProjectId, userEmail);
      if (res.status === 'accepted') {
        setJoinStatus('accepted');
        clearInterval(interval);
        setTimeout(() => {
          navigate(`/builder/${activeProjectId}`);
        }, 1200);
      } else if (res.status === 'rejected') {
        setJoinStatus('rejected');
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [joinStatus, activeProjectId, userEmail, checkMemberStatus, navigate]);

  const handleSubmitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim()) {
      setError('Please provide your email address.');
      return;
    }

    const code = joinCodeInput.trim() || validatedProject?.joinCode;
    if (!code && !tokenParam) {
      setError('Please provide a valid team join code.');
      return;
    }

    setError(null);
    setJoinStatus('submitting');

    if (tokenParam) {
      // Direct token acceptance
      try {
        const res = await fetch('/api/projects/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenParam, userName: userName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to accept invitation');

        setJoinStatus('accepted');
        setTimeout(() => {
          navigate(`/builder/${data.projectId}`);
        }, 1200);
      } catch (err: any) {
        setError(err.message);
        setJoinStatus('idle');
      }
    } else {
      // Join by Code -> requires owner approval
      const res = await joinProjectByCode(code!, userName.trim(), userEmail.trim());
      if (res.success) {
        if (res.isOwner || res.status === 'accepted') {
          setJoinStatus('accepted');
          setTimeout(() => {
            navigate(`/builder/${res.projectId}`);
          }, 1000);
        } else {
          setJoinStatus('pending_approval');
          if (res.projectId) setActiveProjectId(res.projectId);
        }
      } else {
        setError(res.error || 'Failed to send join request.');
        setJoinStatus('idle');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-8 rounded-3xl bg-white border border-[#E2E6E4] shadow-2xl space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center shrink-0 shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-[#1F5E4B] uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#1F5E4B]" />
              <span>TEAM COLLABORATION PORTAL</span>
            </span>
            <h1 className="text-2xl font-black text-[#202524]">Join Team Project</h1>
          </div>
        </div>

        {/* State 1: Accepted / Redirecting */}
        {joinStatus === 'accepted' && (
          <div className="p-6 rounded-2xl bg-[#EAF3EF] border border-[#2E7D5B]/30 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-[#2E7D5B] text-white flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#202524]">Approved! You are in the Team.</h2>
            <p className="text-xs text-[#6B7471] font-mono">
              Opening project canvas workspace...
            </p>
          </div>
        )}

        {/* State 2: Pending Approval Live Polling */}
        {joinStatus === 'pending_approval' && (
          <div className="p-6 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center mx-auto shadow-sm">
              <Clock className="w-6 h-6 text-[#1F5E4B] animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#202524]">Join Request Submitted!</h2>
              <p className="text-xs text-[#6B7471] leading-relaxed">
                Waiting for the project owner to <strong>approve</strong> your request.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2E6E4] font-mono text-xs text-left space-y-1.5 shadow-2xs">
              <div className="flex justify-between text-[#6B7471]">
                <span>Project:</span>
                <strong className="text-[#202524]">{validatedProject?.name || 'Team Workspace'}</strong>
              </div>
              <div className="flex justify-between text-[#6B7471]">
                <span>Your Email:</span>
                <span className="text-[#1F5E4B] font-bold">{userEmail}</span>
              </div>
              <div className="flex justify-between text-[#6B7471]">
                <span>Status:</span>
                <span className="text-[#1F5E4B] font-bold uppercase flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-[#1F5E4B]" />
                  <span>Pending Approval...</span>
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#6B7471] italic font-mono">
              This window will automatically refresh as soon as you are approved.
            </p>
          </div>
        )}

        {/* State 3: Rejected */}
        {joinStatus === 'rejected' && (
          <div className="p-6 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/30 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-[#C94A4A] text-white flex items-center justify-center mx-auto shadow-md">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-[#202524]">Join Request Rejected</h2>
            <p className="text-xs text-[#6B7471]">
              The project owner declined this join request. Contact the owner for a new invite.
            </p>
            <button
              onClick={() => {
                setJoinStatus('idle');
                setError(null);
              }}
              className="px-4 py-2 bg-[#1F5E4B] text-white text-xs font-bold rounded-xl"
            >
              Try Again
            </button>
          </div>
        )}

        {/* State 4: Default Form */}
        {(joinStatus === 'idle' || joinStatus === 'submitting') && (
          <form onSubmit={handleSubmitJoin} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* If Join Code needed */}
            {!tokenParam && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524] flex items-center justify-between">
                  <span>Team Join Code</span>
                  <span className="text-[10px] font-mono text-[#6B7471]">e.g. MF-8A2F1C</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="MF-XXXXXX"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono text-[#202524] font-bold tracking-wider placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleValidateCode(joinCodeInput)}
                    disabled={isLoading || !joinCodeInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white border border-[#1F5E4B]/20 text-xs font-bold transition flex items-center gap-1 shadow-2xs disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Verify</span>}
                  </button>
                </div>
              </div>
            )}

            {/* Validated Project Preview Card */}
            {validatedProject && (
              <div className="p-4 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7471]">Project Name:</span>
                  <strong className="text-[#202524] font-sans text-sm font-bold">{validatedProject.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7471]">Owner:</span>
                  <span className="text-[#1F5E4B] font-bold">{validatedProject.ownerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7471]">Modules:</span>
                  <span className="text-[#2E7D5B] font-bold">{validatedProject.modulesCount} modules configured</span>
                </div>
              </div>
            )}

            {/* Member Details */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Your Full Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Developer"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Your Email Address</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 font-medium"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={joinStatus === 'submitting' || isLoading}
              className="w-full py-3.5 rounded-xl font-bold text-xs bg-[#1F5E4B] hover:bg-[#174739] text-white flex items-center justify-center gap-2 transition shadow-md shadow-[#1F5E4B]/25 mt-3 disabled:opacity-50"
            >
              {joinStatus === 'submitting' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Join Request...</span>
                </>
              ) : (
                <>
                  <span>Request to Join Team Project</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
