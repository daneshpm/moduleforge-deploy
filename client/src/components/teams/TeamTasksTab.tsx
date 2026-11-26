import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  Clock,
  Calendar,
  AlertTriangle,
  Loader2,
  Mail,
  CheckCircle2,
} from 'lucide-react';

type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

interface TaskUser {
  id: string;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

interface TeamTask {
  id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string | null;
  createdAt: string;
  assignees: Array<{ id: string; userId: string; user: TaskUser }>;
}

interface TeamTasksTabProps {
  team: {
    id: string;
    name: string;
    ownerId: string;
    owner?: TaskUser;
    userRole?: 'owner' | 'admin' | 'member';
    members?: Array<{ userId: string; user: TaskUser }>;
  };
  currentUserId?: string;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Done' },
];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: 'bg-[#FDF3F3] text-[#C94A4A] border-[#C94A4A]/25',
  medium: 'bg-[#FFF7E6] text-[#B7791F] border-[#B7791F]/25',
  low: 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/25',
};

const displayName = (u: TaskUser) => u.name || (u.username ? `@${u.username}` : 'Member');

function deadlineInfo(t: TeamTask): { label: string; cls: string; overdue: boolean } {
  if (!t.deadline) return { label: 'No deadline', cls: 'text-[#6B7471]', overdue: false };
  const when = new Date(t.deadline);
  const text = when.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (t.status === 'done') return { label: text, cls: 'text-[#1F5E4B]', overdue: false };
  const ms = when.getTime() - Date.now();
  if (ms < 0) return { label: `Overdue · ${text}`, cls: 'text-[#C94A4A]', overdue: true };
  if (ms < 24 * 3600 * 1000) return { label: `Due soon · ${text}`, cls: 'text-[#B7791F]', overdue: false };
  return { label: text, cls: 'text-[#202524]', overdue: false };
}

const inputCls =
  'w-full bg-white border border-[#E2E6E4] rounded-2xl px-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition font-medium';

export const TeamTasksTab: React.FC<TeamTasksTabProps> = ({ team, currentUserId }) => {
  const canManage = team.userRole === 'owner' || team.userRole === 'admin' || team.ownerId === currentUserId;

  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [deadline, setDeadline] = useState('');
  const [wholeTeam, setWholeTeam] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Everyone who can be assigned: members, plus the owner if not listed as a member.
  const people = useMemo(() => {
    const list: Array<{ id: string; user: TaskUser }> = (team.members || []).map((m) => ({ id: m.userId, user: m.user }));
    if (team.owner && !list.some((p) => p.id === team.ownerId)) list.unshift({ id: team.ownerId, user: team.owner });
    return list;
  }, [team.members, team.owner, team.ownerId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${team.id}/tasks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tasks');
      setTasks(data.tasks || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [team.id]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  const openModal = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDeadline('');
    setWholeTeam(true);
    setPicked([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wholeTeam && picked.length === 0) return setFormError('Pick at least one member, or choose "Whole team".');
    setIsSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/teams/${team.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          assigneeIds: wholeTeam ? [] : picked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign task');
      setIsModalOpen(false);
      setNotice(
        data.notified
          ? `Task assigned. ${data.notified} member${data.notified === 1 ? '' : 's'} notified in-app and by email.`
          : 'Task assigned.'
      );
      setTimeout(() => setNotice(null), 6000);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const setStatus = async (task: TeamTask, status: TaskStatus) => {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/teams/${team.id}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update task');
    } catch (e: any) {
      setTasks(prev);
      setError(e.message);
    }
  };

  const remove = async (task: TeamTask) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      const res = await fetch(`/api/teams/${team.id}/tasks/${task.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete task');
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const visible = onlyMine ? tasks.filter((t) => t.assignees.some((a) => a.userId === currentUserId)) : tasks;
  const openCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyMine(false)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition ${
              !onlyMine ? 'bg-[#1F5E4B] text-white' : 'bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4]'
            }`}
          >
            All tasks ({tasks.length})
          </button>
          <button
            onClick={() => setOnlyMine(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition ${
              onlyMine ? 'bg-[#1F5E4B] text-white' : 'bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4]'
            }`}
          >
            Assigned to me
          </button>
          <span className="text-[11px] font-mono text-[#6B7471] pl-1">{openCount} open</span>
        </div>

        {canManage && (
          <button
            onClick={openModal}
            className="px-4 py-1.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Assign Task</span>
          </button>
        )}
      </div>

      {notice && (
        <div className="p-3 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}
      {error && <div className="p-3 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-medium">{error}</div>}

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 text-[#1F5E4B] animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white border border-[#E2E6E4] rounded-3xl">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center mx-auto text-[#1F5E4B]">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-[#202524]">No tasks yet</h3>
          <p className="text-xs text-[#6B7471] max-w-sm mx-auto">
            {canManage
              ? 'Click "Assign Task" to give work to your team with a deadline. Assignees get an email and an in-app notification.'
              : 'Team owners and admins can assign tasks to you here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = visible.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6B7471]">
                  {col.label} · {items.length}
                </div>
                {items.length === 0 && (
                  <div className="p-4 rounded-2xl border border-dashed border-[#E2E6E4] text-center text-[11px] text-[#6B7471]">Nothing here</div>
                )}
                {items.map((t) => {
                  const dl = deadlineInfo(t);
                  const canChange = canManage || t.assignees.some((a) => a.userId === currentUserId);
                  return (
                    <div key={t.id} className="p-4 rounded-2xl bg-white border border-[#E2E6E4] shadow-xs space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-bold ${t.status === 'done' ? 'line-through text-[#6B7471]' : 'text-[#202524]'}`}>{t.title}</h4>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold uppercase ${PRIORITY_STYLE[t.priority]}`}>
                          {t.priority}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-[#6B7471] whitespace-pre-wrap line-clamp-3">{t.description}</p>}
                      <div className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold ${dl.cls}`}>
                        {dl.overdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        <span>{dl.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {t.assignees.map((a) => (
                          <span key={a.id} className="px-2 py-0.5 rounded-lg bg-[#F7F8F7] border border-[#E2E6E4] text-[10px] text-[#202524] font-medium">
                            {displayName(a.user)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <select
                          value={t.status}
                          disabled={!canChange}
                          onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                          className="bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-2 py-1 text-[11px] text-[#202524] focus:outline-none focus:border-[#1F5E4B] disabled:opacity-60"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.status} value={c.status}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        {canManage && (
                          <button onClick={() => remove(t)} className="p-1.5 text-[#6B7471] hover:text-[#C94A4A] transition" title="Delete task">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <header className="p-5 border-b border-[#E2E6E4] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#202524]">Assign Task</h2>
                <p className="text-xs text-[#6B7471]">{team.name}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition">
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAFBFA]">
              {formError && <div className="p-3 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-medium">{formError}</div>}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#202524]">
                  Task <span className="text-[#C94A4A]">*</span>
                </label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} placeholder="What needs to be done?" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#202524]">Details (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#202524] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1F5E4B]" /> Deadline
                  </label>
                  <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#202524]">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#202524]">Assign to</label>
                <label className="flex items-center gap-2 text-xs text-[#202524] cursor-pointer font-medium">
                  <input type="checkbox" checked={wholeTeam} onChange={(e) => setWholeTeam(e.target.checked)} className="accent-[#1F5E4B]" />
                  <span>Whole team ({people.length})</span>
                </label>
                {!wholeTeam && (
                  <div className="max-h-40 overflow-y-auto space-y-1 p-2.5 rounded-2xl bg-white border border-[#E2E6E4]">
                    {people.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-[#202524] cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={picked.includes(p.id)}
                          onChange={() => setPicked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                          className="accent-[#1F5E4B]"
                        />
                        <span>{displayName(p.user)}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-[#6B7471] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Assignees get an in-app notification and an email.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EEF0EF] text-[#202524] text-xs font-semibold border border-[#E2E6E4] transition">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50">
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Assign Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
