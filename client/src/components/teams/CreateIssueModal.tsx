import React, { useState } from 'react';
import { X, AlertCircle, Tag, UserCheck, Flame, Plus, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { IssuePriority, IssueAuthor } from '../../types/issues';
import { useAuthStore } from '../../store/useAuthStore';

const PRESET_LABELS = [
  { id: 'bug', name: 'bug', color: 'bg-[#FDF3F3] text-[#C94A4A] border-[#C94A4A]/20' },
  { id: 'feature', name: 'feature', color: 'bg-[#F0F9F5] text-[#2E7D5B] border-[#2E7D5B]/20' },
  { id: 'enhancement', name: 'enhancement', color: 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/20' },
  { id: 'documentation', name: 'documentation', color: 'bg-[#FFFBEB] text-[#D97706] border-[#D97706]/20' },
  { id: 'design', name: 'design', color: 'bg-[#F3E8FF] text-[#9333EA] border-[#9333EA]/20' },
  { id: 'performance', name: 'performance', color: 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]/20' },
  { id: 'security', name: 'security', color: 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/20' },
];

interface CreateIssueModalProps {
  teamId: string;
  teamMembers: Array<{ id: string; user: { id: string; name?: string; username?: string; avatarUrl?: string } }>;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  teamId,
  teamMembers,
  onClose,
  onCreated,
}) => {
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(['bug']);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLabel = (label: string) => {
    if (selectedLabels.includes(label)) {
      setSelectedLabels(selectedLabels.filter((l) => l !== label));
    } else {
      setSelectedLabels([...selectedLabels, label]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an issue title');
      return;
    }

    if (!user) {
      setError('You must be logged in to create an issue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const author: IssueAuthor = {
        id: user.id,
        name: user.name || 'Developer',
        username: user.username || user.email?.split('@')[0] || 'developer',
        avatarUrl: user.avatarUrl,
      };

      let assignee: IssueAuthor | null = null;
      if (assigneeId) {
        const member = teamMembers.find((m) => m.user.id === assigneeId);
        if (member) {
          assignee = {
            id: member.user.id,
            name: member.user.name || 'Team Member',
            username: member.user.username || member.user.name || 'member',
            avatarUrl: member.user.avatarUrl,
          };
        }
      }

      const res = await fetch(`/api/teams/${teamId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          labels: selectedLabels.length > 0 ? selectedLabels : ['bug'],
          author,
          assignee,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create issue');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create issue');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="bg-white border border-[#E2E6E4] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <header className="p-5 border-b border-[#E2E6E4] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B] shadow-xs">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202524]">Create New Team Issue</h2>
              <p className="text-xs text-[#6B7471] font-sans">
                Report a bug, request a feature, or track a development milestone
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition border border-transparent hover:border-[#E2E6E4]"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FAFBFA]">
          {error && (
            <div className="p-3.5 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-medium flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202524] block">
              Issue Title <span className="text-[#C94A4A]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix WebSocket reconnect glitch in video meeting"
              className="w-full bg-white border border-[#E2E6E4] rounded-2xl px-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition font-medium"
              required
              autoFocus
            />
          </div>

          {/* Description Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202524] block">
              Description / Steps to Reproduce
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, steps to reproduce, or acceptance criteria..."
              rows={5}
              className="w-full bg-white border border-[#E2E6E4] rounded-2xl p-4 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition font-sans leading-relaxed resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524] flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Priority</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full bg-white border border-[#E2E6E4] rounded-2xl px-3.5 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] transition font-medium"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent / Blocker</option>
              </select>
            </div>

            {/* Assignee Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Assignee</span>
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-white border border-[#E2E6E4] rounded-2xl px-3.5 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] transition font-medium"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name || `@${m.user.username || 'member'}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Labels Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#202524] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#1F5E4B]" />
              <span>Labels / Tags</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_LABELS.map((lbl) => {
                const isSelected = selectedLabels.includes(lbl.id);
                return (
                  <button
                    key={lbl.id}
                    type="button"
                    onClick={() => toggleLabel(lbl.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition ${
                      isSelected
                        ? lbl.color + ' ring-2 ring-[#1F5E4B]/20 scale-105'
                        : 'bg-white text-[#6B7471] border-[#E2E6E4] hover:border-[#1F5E4B]/40 opacity-70'
                    }`}
                  >
                    {lbl.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#E2E6E4] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] text-xs font-semibold border border-[#E2E6E4] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2.5 rounded-2xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Submit New Issue</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
