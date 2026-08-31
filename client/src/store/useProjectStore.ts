import { create } from 'zustand';
import { Project, ProjectModule, Module } from '../types';

import { useAuthStore } from './useAuthStore';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  error: string | null;
  isRealtimeConnected: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (
    name: string,
    options?: string | {
      description?: string;
      projectType?: 'individual' | 'team';
      visibility?: 'private' | 'public';
      teamId?: string;
      gitRepositoryUrl?: string;
      gitBranch?: string;
      teamRepos?: Array<{ name: string; category?: string; githubRepository: string; branch?: string }>;
    }
  ) => Promise<Project | null>;
  loadProject: (id: string) => Promise<void>;
  subscribeToProjectEvents: (projectId: string) => () => void;
  syncEntireProject: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  syncModuleNow: (projectId: string, pmId: string) => Promise<{ success: boolean; error?: string }>;
  rollbackModule: (projectId: string, pmId: string, previousCommitSha: string) => Promise<{ success: boolean; error?: string }>;
  saveCurrentProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addModuleToCurrentProject: (module: Module) => void;
  applySynthesizedArchitecture: (items: Array<{ module: Module; xPosition: number; yPosition: number }>) => void;
  removeModuleFromCurrentProject: (moduleId: string) => void;
  updateModulePosition: (moduleId: string, x: number, y: number) => void;
  exportProjectZip: (projectId: string) => Promise<void>;
  inviteMember: (projectId: string, email: string, role?: string) => Promise<{ success: boolean; member?: any; inviteToken?: string; inviteLink?: string; gmailComposeUrl?: string; mailtoUrl?: string; previewUrl?: string; error?: string }>;
  removeMember: (projectId: string, memberId: string) => Promise<{ success: boolean; error?: string }>;
  approveMember: (projectId: string, memberId: string) => Promise<{ success: boolean; member?: any; error?: string }>;
  rejectMember: (projectId: string, memberId: string) => Promise<{ success: boolean; error?: string }>;
  joinProjectByCode: (code: string, name: string, email: string) => Promise<{ success: boolean; status?: string; projectId?: string; message?: string; isOwner?: boolean; error?: string }>;
  validateJoinCode: (code: string) => Promise<{ valid: boolean; project?: any; error?: string }>;
  checkMemberStatus: (projectId: string, email: string) => Promise<{ status: string; role?: string; name?: string; error?: string }>;
  connectModuleRepo: (projectId: string, pmId: string, githubRepository: string, githubBranch?: string) => Promise<{ success: boolean; projectModule?: any; error?: string }>;
  syncProjectModule: (projectId: string, pmId: string) => Promise<{ success: boolean; projectModule?: any; deploymentUrl?: string; error?: string }>;
  redeployProjectModule: (projectId: string, pmId: string) => Promise<{ success: boolean; projectModule?: any; error?: string }>;
  rollbackProjectModule: (projectId: string, pmId: string, previousCommitSha: string) => Promise<{ success: boolean; projectModule?: any; deploymentUrl?: string; error?: string }>;
  fetchModuleLogs: (projectId: string, pmId: string) => Promise<any[]>;
  fetchProjectActivities: (projectId: string) => Promise<any[]>;
  fetchProjectMembers: (projectId: string) => Promise<any[]>;
  fetchProjectRunnerStatus: (projectId?: string) => Promise<any[]>;
  startLocalModule: (projectId: string, pmId: string) => Promise<{ success: boolean; state?: any; error?: string }>;
  stopLocalModule: (pmId: string) => Promise<{ success: boolean; state?: any; error?: string }>;
  startLocalProject: (projectId: string) => Promise<{ success: boolean; states?: any[]; error?: string }>;
  fetchLocalRunnerStatus: () => Promise<any[]>;
  fetchLocalModuleLogs: (pmId: string) => Promise<string[]>;
  openProjectInAntigravity: (projectId: string) => Promise<{ success: boolean; folderPath?: string; antigravityUrl?: string; prompt?: string; error?: string }>;
}

const API_BASE = '/api';

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  isSaving: false,
  saveMessage: null,
  error: null,
  isRealtimeConnected: false,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const query = user?.id ? `?userId=${encodeURIComponent(user.id)}` : '';
      const res = await fetch(`${API_BASE}/projects${query}`);
      if (!res.ok) throw new Error('Failed to load projects');
      const projects = await res.json();
      set({ projects, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  createProject: async (name: string, options?: any) => {
    try {
      const user = useAuthStore.getState().user;
      const payload = typeof options === 'string'
        ? { name, description: options, userId: user?.id, userEmail: user?.email, userName: user?.name }
        : { name, ...options, userId: user?.id, userEmail: user?.email, userName: user?.name };

      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();
      get().fetchProjects();
      return project;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  loadProject: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`);
      if (!res.ok) throw new Error('Project not found');
      const currentProject = await res.json();
      set({ currentProject, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  // 🟢 Subscribe to Server-Sent Events (SSE) Real-Time Stream
  subscribeToProjectEvents: (projectId: string) => {
    const eventSource = new EventSource(`${API_BASE}/projects/${projectId}/events`);

    eventSource.onopen = () => {
      console.log(`[SSE] Connected to real-time project stream for: ${projectId}`);
      set({ isRealtimeConnected: true });
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log(`[SSE] Received event:`, payload);

        if (payload.type === 'MODULE_UPDATED' || payload.type === 'ROLLBACK_COMPLETED') {
          const { currentProject } = get();
          if (currentProject && currentProject.id === projectId) {
            const updatedModules = currentProject.modules.map((pm) => {
              if (pm.moduleId === payload.moduleId || pm.id === payload.moduleId) {
                return {
                  ...pm,
                  currentCommitSha: payload.commitSha || pm.currentCommitSha,
                  lastCommitMessage: payload.message || pm.lastCommitMessage,
                  lastCommitAuthor: payload.author || pm.lastCommitAuthor,
                  deploymentStatus: payload.status || 'synced',
                  lastSyncedAt: payload.timestamp || new Date().toISOString(),
                };
              }
              return pm;
            });

            const newActivity = {
              id: `sse-${Date.now()}`,
              projectId,
              moduleName: payload.moduleName,
              action: payload.type === 'ROLLBACK_COMPLETED' ? 'rollback' : 'updated',
              actorName: payload.author || 'Team Member',
              description: payload.message || 'Module updated',
              commitSha: payload.commitSha,
              status: payload.status || 'synced',
              createdAt: payload.timestamp || new Date().toISOString(),
            };

            set({
              currentProject: {
                ...currentProject,
                modules: updatedModules,
                activities: [newActivity, ...(currentProject.activities || [])],
              },
            });
          }
        } else if (payload.type === 'PROJECT_SYNCED') {
          get().loadProject(projectId);
        }
      } catch (e) {
        console.error('[SSE] Failed to parse message event:', e);
      }
    };

    eventSource.onerror = () => {
      console.warn('[SSE] EventSource disconnected, will attempt reconnect...');
      set({ isRealtimeConnected: false });
    };

    // Return cleanup unsubscriber
    return () => {
      console.log(`[SSE] Closing stream for: ${projectId}`);
      eventSource.close();
      set({ isRealtimeConnected: false });
    };
  },

  syncEntireProject: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync project');
      await get().loadProject(projectId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  syncModuleNow: async (projectId: string, pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/sync`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync module');
      await get().loadProject(projectId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  rollbackModule: async (projectId: string, pmId: string, previousCommitSha: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousCommitSha }),
      });
      if (!res.ok) throw new Error('Failed to rollback module');
      await get().loadProject(projectId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  saveCurrentProject: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isSaving: true, saveMessage: null });
    try {
      const payload = {
        name: currentProject.name,
        description: currentProject.description,
        canvasConfig: currentProject.canvasConfig,
        modules: currentProject.modules.map((pm) => ({
          moduleId: pm.module?.id || pm.moduleId,
          moduleVersion: pm.moduleVersion,
          xPosition: pm.xPosition,
          yPosition: pm.yPosition,
          configuration: pm.configuration,
        })),
      };

      const res = await fetch(`${API_BASE}/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save project');
      const updated = await res.json();
      set({ currentProject: updated, isSaving: false, saveMessage: 'Project saved successfully.' });

      setTimeout(() => set({ saveMessage: null }), 3000);
    } catch (e: any) {
      set({ isSaving: false, error: e.message });
    }
  },

  deleteProject: async (id: string) => {
    try {
      await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
      get().fetchProjects();
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  addModuleToCurrentProject: (module: Module) => {
    const { currentProject } = get();
    if (!currentProject) return;

    // Check if already in project
    const exists = currentProject.modules.some(
      (pm) => (pm.module?.id || pm.moduleId) === module.id
    );

    if (exists) return;

    const count = currentProject.modules.length;
    // Auto position in grid
    const xPosition = 120 + (count % 3) * 320;
    const yPosition = 120 + Math.floor(count / 3) * 220;

    const newProjectModule: ProjectModule = {
      id: `pm-${Date.now()}-${Math.random()}`,
      projectId: currentProject.id,
      moduleId: module.id,
      module,
      moduleVersion: module.version,
      xPosition,
      yPosition,
    };

    const updatedProject = {
      ...currentProject,
      modules: [...currentProject.modules, newProjectModule],
    };

    set({ currentProject: updatedProject });
  },

  applySynthesizedArchitecture: (items: Array<{ module: Module; xPosition: number; yPosition: number }>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newProjectModules: ProjectModule[] = items.map((item, index) => ({
      id: `pm-${Date.now()}-${index}`,
      projectId: currentProject.id,
      moduleId: item.module.id,
      module: item.module,
      moduleVersion: item.module.version,
      xPosition: item.xPosition,
      yPosition: item.yPosition,
    }));

    set({
      currentProject: {
        ...currentProject,
        modules: newProjectModules,
      },
    });
  },

  removeModuleFromCurrentProject: (moduleId: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedModules = currentProject.modules.filter(
      (pm) => (pm.module?.id || pm.moduleId) !== moduleId
    );

    set({
      currentProject: {
        ...currentProject,
        modules: updatedModules,
      },
    });
  },

  updateModulePosition: (moduleId: string, x: number, y: number) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const updatedModules = currentProject.modules.map((pm) => {
      if ((pm.module?.id || pm.moduleId) === moduleId) {
        return { ...pm, xPosition: x, yPosition: y };
      }
      return pm;
    });

    set({
      currentProject: {
        ...currentProject,
        modules: updatedModules,
      },
    });
  },

  exportProjectZip: async (projectId: string) => {
    try {
      const { currentProject } = get();
      if (currentProject && currentProject.id === projectId) {
        await get().saveCurrentProject();
      }

      const res = await fetch(`${API_BASE}/projects/${projectId}/export`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to generate export ZIP');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}-export.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      console.error('Export error:', e);
      alert(`Export failed: ${e.message}`);
    }
  },

  fetchMembers: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  inviteMember: async (projectId: string, email: string, role: string = 'developer') => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite team member');
      return {
        success: true,
        member: data.member,
        inviteToken: data.inviteToken,
        inviteLink: data.inviteLink,
        gmailComposeUrl: data.gmailComposeUrl,
        mailtoUrl: data.mailtoUrl,
        previewUrl: data.previewUrl,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  removeMember: async (projectId: string, memberId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  approveMember: async (projectId: string, memberId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members/${memberId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve member');
      return { success: true, member: data.member };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  rejectMember: async (projectId: string, memberId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members/${memberId}/reject`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject member');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  joinProjectByCode: async (code: string, name: string, email: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/join-by-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join project');
      return {
        success: true,
        status: data.status,
        projectId: data.projectId,
        message: data.message,
        isOwner: data.isOwner,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  validateJoinCode: async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/by-code/${encodeURIComponent(code.trim().toUpperCase())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid join code');
      return { valid: true, project: data.project };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  },

  checkMemberStatus: async (projectId: string, email: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members/status?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check status');
      return { status: data.status, role: data.role, name: data.name };
    } catch (e: any) {
      return { status: 'unknown', error: e.message };
    }
  },

  connectModuleRepo: async (projectId: string, pmId: string, githubRepository: string, githubBranch = 'main') => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/connect-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepository, githubBranch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect repository');
      get().loadProject(projectId);
      return { success: true, projectModule: data.projectModule };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  syncProjectModule: async (projectId: string, pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync project module');
      get().loadProject(projectId);
      return { success: true, projectModule: data.projectModule, deploymentUrl: data.deploymentUrl };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  redeployProjectModule: async (projectId: string, pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/redeploy`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to redeploy module');
      get().loadProject(projectId);
      return { success: true, projectModule: data.projectModule };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  rollbackProjectModule: async (projectId: string, pmId: string, previousCommitSha: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousCommitSha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rollback module');
      get().loadProject(projectId);
      return { success: true, projectModule: data.projectModule, deploymentUrl: data.deploymentUrl };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  fetchModuleLogs: async (projectId: string, pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/modules/${pmId}/logs`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  fetchProjectActivities: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/activity`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  fetchProjectMembers: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/members`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  fetchProjectRunnerStatus: async (_projectId?: string) => {
    try {
      const res = await fetch(`${API_BASE}/runner/status`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.processes || [];
    } catch (e) {
      return [];
    }
  },

  startLocalModule: async (projectId: string, pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/runner/start-module`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, pmId, openBrowser: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start module locally');
      get().loadProject(projectId);
      return { success: true, state: data.state };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  stopLocalModule: async (pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/runner/stop-module`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pmId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stop module process');
      return { success: true, state: data.state };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  startLocalProject: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/runner/start-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start project');
      get().loadProject(projectId);
      return { success: true, states: data.states };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  fetchLocalRunnerStatus: async () => {
    try {
      const res = await fetch(`${API_BASE}/runner/status`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.processes || [];
    } catch (e) {
      return [];
    }
  },

  fetchLocalModuleLogs: async (pmId: string) => {
    try {
      const res = await fetch(`${API_BASE}/runner/logs/${pmId}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  openProjectInAntigravity: async (projectId: string) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/open-antigravity`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open in Antigravity');

      // Auto-copy prompt to clipboard
      if (data.prompt && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(data.prompt);
        } catch (e) {}
      }

      // Trigger URI redirection to Antigravity
      if (data.antigravityUrl) {
        try {
          window.location.href = data.antigravityUrl;
        } catch (e) {}
      }

      return { success: true, folderPath: data.folderPath, antigravityUrl: data.antigravityUrl, prompt: data.prompt };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
}));
