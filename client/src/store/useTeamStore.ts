import { create } from 'zustand';
import { Team, TeamInvitation } from '../types';
import { useAuthStore } from './useAuthStore';

const API_BASE = '/api';

interface TeamPermissions {
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
  canInvite: boolean;
  userRole: string;
}

interface TeamState {
  teams: Team[];
  activeTeam: Team | null;
  activeTeamPermissions: TeamPermissions | null;
  isLoading: boolean;
  error: string | null;

  fetchTeams: () => Promise<void>;
  fetchTeamDetails: (teamId: string) => Promise<Team | null>;
  createTeam: (name: string, description?: string) => Promise<{ success: boolean; team?: Team; error?: string }>;
  updateTeam: (teamId: string, name?: string, description?: string) => Promise<{ success: boolean; team?: Team; error?: string }>;
  deleteTeam: (teamId: string) => Promise<{ success: boolean; error?: string }>;
  inviteByUsername: (teamId: string, username: string, role?: string) => Promise<{ success: boolean; message?: string; error?: string; invitation?: TeamInvitation }>;
  inviteByEmail: (teamId: string, email: string, role?: string) => Promise<{ success: boolean; message?: string; error?: string; invitation?: TeamInvitation; emailResult?: any }>;
  cancelInvitation: (teamId: string, invitationId: string) => Promise<{ success: boolean; error?: string }>;
  removeMember: (teamId: string, memberUserId: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (teamId: string, memberUserId: string, role: string) => Promise<{ success: boolean; error?: string }>;
  searchUsersByUsername: (query: string) => Promise<Array<{ id: string; name: string; username: string; avatarUrl?: string }>>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  activeTeam: null,
  activeTeamPermissions: null,
  isLoading: false,
  error: null,

  fetchTeams: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/teams?userId=${user.id}`);
      const data = await res.json();
      if (res.ok && data.teams) {
        set({ teams: data.teams, isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch teams', isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message || 'Network error', isLoading: false });
    }
  },

  fetchTeamDetails: async (teamId: string) => {
    const user = useAuthStore.getState().user;
    set({ isLoading: true, error: null });
    try {
      const query = user?.id ? `?userId=${user.id}` : '';
      const res = await fetch(`${API_BASE}/teams/${teamId}${query}`);
      const data = await res.json();
      if (res.ok && data.team) {
        set({
          activeTeam: data.team,
          activeTeamPermissions: data.permissions,
          isLoading: false,
        });
        return data.team;
      } else {
        set({ error: data.error || 'Failed to fetch team details', isLoading: false });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message || 'Network error', isLoading: false });
      return null;
    }
  },

  createTeam: async (name: string, description?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          ownerId: user.id,
          ownerEmail: user.email,
          ownerName: user.name,
          ownerUsername: user.username,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create team' };
      }

      await get().fetchTeams();
      return { success: true, team: data.team };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updateTeam: async (teamId: string, name?: string, description?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update team' };

      await get().fetchTeamDetails(teamId);
      await get().fetchTeams();
      return { success: true, team: data.team };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  deleteTeam: async (teamId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}?userId=${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to delete team' };

      await get().fetchTeams();
      set({ activeTeam: null, activeTeamPermissions: null });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  inviteByUsername: async (teamId: string, username: string, role = 'member') => {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/invitations/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          role,
          inviterId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send invite' };
      }

      await get().fetchTeamDetails(teamId);
      return { success: true, message: data.message, invitation: data.invitation };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  inviteByEmail: async (teamId: string, email: string, role = 'member') => {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/invitations/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          inviterId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send email invite' };
      }

      await get().fetchTeamDetails(teamId);
      return {
        success: true,
        message: data.message,
        invitation: data.invitation,
        emailResult: data.emailResult,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  cancelInvitation: async (teamId: string, invitationId: string) => {
    const user = useAuthStore.getState().user;
    try {
      const query = user?.id ? `?userId=${user.id}` : '';
      const res = await fetch(`${API_BASE}/teams/${teamId}/invitations/${invitationId}${query}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to cancel invite' };

      await get().fetchTeamDetails(teamId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  removeMember: async (teamId: string, memberUserId: string) => {
    const user = useAuthStore.getState().user;
    try {
      const query = user?.id ? `?userId=${user.id}` : '';
      const res = await fetch(`${API_BASE}/teams/${teamId}/members/${memberUserId}${query}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to remove member' };

      await get().fetchTeamDetails(teamId);
      await get().fetchTeams();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  updateMemberRole: async (teamId: string, memberUserId: string, role: string) => {
    const user = useAuthStore.getState().user;
    try {
      const res = await fetch(`${API_BASE}/teams/${teamId}/members/${memberUserId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, callerUserId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update member role' };

      await get().fetchTeamDetails(teamId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  searchUsersByUsername: async (query: string) => {
    const user = useAuthStore.getState().user;
    if (!query.trim()) return [];

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        ...(user?.id ? { currentUserId: user.id } : {}),
      });
      const res = await fetch(`${API_BASE}/users/search?${params.toString()}`);
      const data = await res.json();
      return data.users || [];
    } catch {
      return [];
    }
  },
}));
