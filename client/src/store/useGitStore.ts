import { create } from 'zustand';
import axios from 'axios';
import { GitStatusResult, GitCommitRecord, FileTreeItem } from '../types';

interface GitWorkspaceModuleMeta {
  id: string;
  name: string;
  category: string;
  repositoryType: string;
  ownerName: string;
  frontendPort?: number;
  backendPort?: number;
}

interface GitState {
  moduleMeta: GitWorkspaceModuleMeta | null;
  status: GitStatusResult | null;
  branches: string[];
  currentBranch: string;
  history: GitCommitRecord[];
  fileTree: FileTreeItem[];
  activeFilePath: string | null;
  activeFileContent: string;
  isLoading: boolean;
  isSavingFile: boolean;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;
  errorMessage: string | null;
  successMessage: string | null;

  // Actions
  fetchWorkspaceStatus: (projectId: string, pmId: string) => Promise<void>;
  commit: (projectId: string, pmId: string, message: string, author?: string) => Promise<boolean>;
  push: (projectId: string, pmId: string, branch?: string) => Promise<boolean>;
  pull: (projectId: string, pmId: string, branch?: string) => Promise<{ success: boolean; error?: string }>;
  fetchBranches: (projectId: string, pmId: string) => Promise<void>;
  createBranch: (projectId: string, pmId: string, branchName: string) => Promise<boolean>;
  switchBranch: (projectId: string, pmId: string, branchName: string) => Promise<boolean>;
  fetchHistory: (projectId: string, pmId: string) => Promise<void>;
  fetchFileTree: (projectId: string, pmId: string) => Promise<void>;
  loadFile: (projectId: string, pmId: string, filePath: string) => Promise<void>;
  saveFile: (projectId: string, pmId: string, filePath: string, content: string) => Promise<boolean>;
  setActiveFileContent: (content: string) => void;
  clearMessages: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  moduleMeta: null,
  status: null,
  branches: ['main'],
  currentBranch: 'main',
  history: [],
  fileTree: [],
  activeFilePath: null,
  activeFileContent: '',
  isLoading: false,
  isSavingFile: false,
  isCommitting: false,
  isPushing: false,
  isPulling: false,
  errorMessage: null,
  successMessage: null,

  fetchWorkspaceStatus: async (projectId: string, pmId: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.get(`/api/git/projects/${projectId}/modules/${pmId}/status`);
      if (res.data.success) {
        set({
          moduleMeta: res.data.module,
          status: res.data.status,
          currentBranch: res.data.status.branch,
          isLoading: false,
        });
      }
    } catch (e: any) {
      set({
        isLoading: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to load Git status',
      });
    }
  },

  commit: async (projectId: string, pmId: string, message: string, author?: string) => {
    try {
      set({ isCommitting: true, errorMessage: null, successMessage: null });
      const res = await axios.post(`/api/git/projects/${projectId}/modules/${pmId}/commit`, {
        message,
        author,
      });

      if (res.data.success) {
        set({
          isCommitting: false,
          successMessage: `✓ Committed: ${res.data.commit.shortSha} - "${res.data.commit.message}"`,
        });
        // Refresh status and history
        await get().fetchWorkspaceStatus(projectId, pmId);
        await get().fetchHistory(projectId, pmId);
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isCommitting: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to commit changes',
      });
      return false;
    }
  },

  push: async (projectId: string, pmId: string, branch?: string) => {
    try {
      set({ isPushing: true, errorMessage: null, successMessage: null });
      const res = await axios.post(`/api/git/projects/${projectId}/modules/${pmId}/push`, {
        branch: branch || get().currentBranch,
      });

      if (res.data.success) {
        set({
          isPushing: false,
          successMessage: `✓ Push successful: ${res.data.commitSha ? res.data.commitSha.substring(0, 7) : ''} to "${res.data.branch}"`,
        });
        await get().fetchWorkspaceStatus(projectId, pmId);
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isPushing: false,
        errorMessage: e.response?.data?.error || e.message || 'Push failed',
      });
      return false;
    }
  },

  pull: async (projectId: string, pmId: string, branch?: string) => {
    try {
      set({ isPulling: true, errorMessage: null, successMessage: null });
      const res = await axios.post(`/api/git/projects/${projectId}/modules/${pmId}/pull`, {
        branch: branch || get().currentBranch,
      });

      if (res.data.success) {
        set({
          isPulling: false,
          successMessage: `✓ Pull complete: ${res.data.message}`,
        });
        await get().fetchWorkspaceStatus(projectId, pmId);
        await get().fetchFileTree(projectId, pmId);
        return { success: true };
      }
      return { success: false, error: 'Pull failed' };
    } catch (e: any) {
      const err = e.response?.data?.error || e.message || 'Pull failed';
      set({
        isPulling: false,
        errorMessage: err,
      });
      return { success: false, error: err };
    }
  },

  fetchBranches: async (projectId: string, pmId: string) => {
    try {
      const res = await axios.get(`/api/git/projects/${projectId}/modules/${pmId}/branches`);
      if (res.data.success) {
        set({
          branches: res.data.branches,
          currentBranch: res.data.current,
        });
      }
    } catch (e: any) {
      console.warn('Failed to fetch branches:', e.message);
    }
  },

  createBranch: async (projectId: string, pmId: string, branchName: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.post(`/api/git/projects/${projectId}/modules/${pmId}/branches`, {
        branchName,
      });

      if (res.data.success) {
        set({
          branches: res.data.branches,
          currentBranch: res.data.current,
          isLoading: false,
          successMessage: `✓ Created and switched to branch "${res.data.current}"`,
        });
        await get().fetchWorkspaceStatus(projectId, pmId);
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isLoading: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to create branch',
      });
      return false;
    }
  },

  switchBranch: async (projectId: string, pmId: string, branchName: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.post(`/api/git/projects/${projectId}/modules/${pmId}/checkout`, {
        branchName,
      });

      if (res.data.success) {
        set({
          branches: res.data.branches,
          currentBranch: res.data.current,
          isLoading: false,
          successMessage: `✓ Switched to branch "${res.data.current}"`,
        });
        await get().fetchWorkspaceStatus(projectId, pmId);
        await get().fetchFileTree(projectId, pmId);
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isLoading: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to switch branch',
      });
      return false;
    }
  },

  fetchHistory: async (projectId: string, pmId: string) => {
    try {
      const res = await axios.get(`/api/git/projects/${projectId}/modules/${pmId}/history`);
      if (res.data.success) {
        set({ history: res.data.history });
      }
    } catch (e: any) {
      console.warn('Failed to fetch history:', e.message);
    }
  },

  fetchFileTree: async (projectId: string, pmId: string) => {
    try {
      const res = await axios.get(`/api/git/projects/${projectId}/modules/${pmId}/files`);
      if (res.data.success) {
        set({ fileTree: res.data.files });
      }
    } catch (e: any) {
      console.warn('Failed to fetch files:', e.message);
    }
  },

  loadFile: async (projectId: string, pmId: string, filePath: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.get(`/api/git/projects/${projectId}/modules/${pmId}/file`, {
        params: { path: filePath },
      });

      if (res.data.success) {
        set({
          activeFilePath: res.data.path,
          activeFileContent: res.data.content,
          isLoading: false,
        });
      }
    } catch (e: any) {
      set({
        isLoading: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to load file',
      });
    }
  },

  saveFile: async (projectId: string, pmId: string, filePath: string, content: string) => {
    try {
      set({ isSavingFile: true, errorMessage: null });
      const res = await axios.post(`/api/git/projects/${projectId}/modules/${pmId}/file`, {
        path: filePath,
        content,
      });

      if (res.data.success) {
        set({
          isSavingFile: false,
          successMessage: `Saved ${filePath}`,
        });
        await get().fetchWorkspaceStatus(projectId, pmId);
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isSavingFile: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to save file',
      });
      return false;
    }
  },

  setActiveFileContent: (content: string) => set({ activeFileContent: content }),
  clearMessages: () => set({ errorMessage: null, successMessage: null }),
}));
