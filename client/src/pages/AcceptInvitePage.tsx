import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, AlertCircle, ArrowRight, Shield, Sparkles, FolderGit2 } from 'lucide-react';

interface InviteDetails {
  member: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
  project: {
    id: string;
    name: string;
    description?: string;
    ownerName: string;
    modulesCount: number;
  };
}

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [userName, setUserName] = useState('');
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invitation token in the link.');
      setIsLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/projects/invites/validate?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to validate invitation token');
        }
        setInviteDetails(data);
        setUserName(data.member?.email?.split('@')[0] || '');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/projects/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userName: userName.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setAcceptedSuccess(true);
      setTimeout(() => {
        navigate(`/builder/${data.projectId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3 font-mono">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Verifying project invitation token...</p>
        </div>
      </div>
    );
  }

  if (error || !inviteDetails) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Invitation Link Invalid</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'This invitation link may have expired or has already been accepted.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Go to ModuleForge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
        {/* Header Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
              TEAM COLLABORATION INVITATION
            </span>
            <h1 className="text-2xl font-extrabold text-white">Join Team Project</h1>
          </div>
        </div>

        {/* Invitation Context Card */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Project Name:</span>
            <strong className="text-white font-sans text-sm">{inviteDetails.project.name}</strong>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Invited by:</span>
            <span className="text-indigo-300 font-bold">{inviteDetails.project.ownerName}</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Your Role:</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              {inviteDetails.member.role}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Invited Email:</span>
            <span className="text-slate-300">{inviteDetails.member.email}</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Modules in Project:</span>
            <span className="text-emerald-400 font-bold">{inviteDetails.project.modulesCount} modules</span>
          </div>
        </div>

        {/* Feature summary */}
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Connect your module's GitHub repository or ZIP source</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Live synchronization with the unified project state</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>1-click local runner test on localhost</span>
          </div>
        </div>

        {/* Accept Form */}
        <form onSubmit={handleAccept} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Your Display Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Shalya, Member 2"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-medium placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isAccepting || acceptedSuccess}
            className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
              acceptedSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
            }`}
          >
            {acceptedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Joined! Opening Project Canvas...</span>
              </>
            ) : isAccepting ? (
              <span>Joining Project...</span>
            ) : (
              <>
                <span>Accept Invitation & Join Project</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
