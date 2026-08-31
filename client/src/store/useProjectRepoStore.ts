import { create } from 'zustand';
import axios from 'axios';
import {
  ProjectRepository,
  GitStatusResult,
  GitCommitRecord,
  FileTreeItem,
  ModuleForgeManifest,
} from '../types';

interface ProjectRepoState {
  hasRepository: boolean;
  repository: ProjectRepository | null;
  status: GitStatusResult | null;
  stats: {
    branch: string;
    totalFiles: number;
    modulesCount: number;
    latestCommit?: any;
    isClean: boolean;
  } | null;
  manifest: ModuleForgeManifest | null;
  branches: string[];
  currentBranch: string;
  history: GitCommitRecord[];
  fileTree: FileTreeItem[];
  activeFilePath: string | null;
  activeFileContent: string;
  originalFileContent: string;
  isDirty: boolean;
  isLoading: boolean;
  isSavingFile: boolean;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;
  isIngesting: boolean;
  errorMessage: string | null;
  successMessage: string | null;

  // Actions
  fetchRepoOverview: (projectId: string) => Promise<void>;
  createOrConnectRepo: (projectId: string, payload: any) => Promise<boolean>;
  disconnectRepo: (projectId: string) => Promise<boolean>;
  fetchFileTree: (projectId: string) => Promise<void>;
  loadFile: (projectId: string, filePath: string) => Promise<void>;
  saveFile: (projectId: string, filePath: string, content: string) => Promise<boolean>;
  commitChanges: (projectId: string, message: string, author?: string) => Promise<boolean>;
  fetchBranches: (projectId: string) => Promise<void>;
  createBranch: (projectId: string, branchName: string) => Promise<boolean>;
  switchBranch: (projectId: string, branchName: string) => Promise<boolean>;
  fetchHistory: (projectId: string) => Promise<void>;
  push: (projectId: string, branch?: string) => Promise<boolean>;
  pull: (projectId: string, branch?: string) => Promise<{ success: boolean; error?: string }>;
  ingestZipModule: (
    projectId: string,
    file: File,
    moduleName?: string,
    destinationPath?: string,
    version?: string
  ) => Promise<{ success: boolean; error?: string }>;
  ingestGithubModule: (
    projectId: string,
    githubUrl: string,
    moduleName?: string,
    destinationPath?: string
  ) => Promise<{ success: boolean; error?: string }>;
  ingestMarketplaceModule: (
    projectId: string,
    moduleId: string,
    version?: string,
    destinationPath?: string
  ) => Promise<{ success: boolean; error?: string }>;
  setActiveFileContent: (content: string) => void;
  clearMessages: () => void;
}

export const useProjectRepoStore = create<ProjectRepoState>((set, get) => ({
  hasRepository: false,
  repository: null,
  status: null,
  stats: null,
  manifest: null,
  branches: ['main'],
  currentBranch: 'main',
  history: [],
  fileTree: [],
  activeFilePath: null,
  activeFileContent: '',
  originalFileContent: '',
  isDirty: false,
  isLoading: false,
  isSavingFile: false,
  isCommitting: false,
  isPushing: false,
  isPulling: false,
  isIngesting: false,
  errorMessage: null,
  successMessage: null,

  fetchRepoOverview: async (projectId: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.get(`/api/projects/${projectId}/repository`);
      if (res.data.success) {
        set({
          hasRepository: res.data.hasRepository,
          repository: res.data.repository,
          status: res.data.status,
          stats: res.data.stats,
          manifest: res.data.manifest,
          currentBranch: res.data.status?.branch || 'main',
          isLoading: false,
        });
      }
    } catch (e: any) {
      set({
        isLoading: false,
        hasRepository: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to load project repository',
      });
    }
  },

  createOrConnectRepo: async (projectId: string, payload: any) => {
    try {
      set({ isLoading: true, errorMessage: null, successMessage: null });
      const res = await axios.post(`/api/projects/${projectId}/repository`, payload);
      if (res.data.success) {
        set({
          hasRepository: true,
          repository: res.data.repository,
          isLoading: false,
          successMessage: '✓ Repository created and initialized successfully!',
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchFileTree(projectId);
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isLoading: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to configure repository',
      });
      return false;
    }
  },

  disconnectRepo: async (projectId: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.delete(`/api/projects/${projectId}/repository`);
      if (res.data.success) {
        set({
          hasRepository: false,
          repository: null,
          isLoading: false,
          successMessage: 'Repository disconnected.',
        });
        return true;
      }
      return false;
    } catch (e: any) {
      set({
        isLoading: false,
        errorMessage: e.response?.data?.error || e.message || 'Failed to disconnect repository',
      });
      return false;
    }
  },

  fetchFileTree: async (projectId: string) => {
    try {
      const res = await axios.get(`/api/projects/${projectId}/repository/files`);
      if (res.data.success) {
        set({ fileTree: res.data.files });
      }
    } catch (e: any) {
      console.warn('Failed to fetch file tree:', e.message);
    }
  },

  loadFile: async (projectId: string, filePath: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.get(`/api/projects/${projectId}/repository/file`, {
        params: { path: filePath },
      });

      if (res.data.success) {
        set({
          activeFilePath: res.data.path,
          activeFileContent: res.data.content,
          originalFileContent: res.data.content,
          isDirty: false,
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

  saveFile: async (projectId: string, filePath: string, content: string) => {
    try {
      set({ isSavingFile: true, errorMessage: null });
      const res = await axios.post(`/api/projects/${projectId}/repository/file`, {
        path: filePath,
        content,
      });

      if (res.data.success) {
        set({
          isSavingFile: false,
          originalFileContent: content,
          isDirty: false,
          successMessage: `✓ Saved ${filePath}`,
        });
        await get().fetchRepoOverview(projectId);
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

  commitChanges: async (projectId: string, message: string, author?: string) => {
    try {
      set({ isCommitting: true, errorMessage: null, successMessage: null });
      const res = await axios.post(`/api/projects/${projectId}/repository/commit`, {
        message,
        author,
      });

      if (res.data.success) {
        set({
          isCommitting: false,
          successMessage: `✓ Committed: ${res.data.commit.shortSha} — "${res.data.commit.message}"`,
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchHistory(projectId);
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

  fetchBranches: async (projectId: string) => {
    try {
      const res = await axios.get(`/api/projects/${projectId}/repository/branches`);
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

  createBranch: async (projectId: string, branchName: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.post(`/api/projects/${projectId}/repository/branches`, {
        branchName,
      });

      if (res.data.success) {
        set({
          branches: res.data.branches,
          currentBranch: res.data.current,
          isLoading: false,
          successMessage: `✓ Created and switched to branch "${res.data.current}"`,
        });
        await get().fetchRepoOverview(projectId);
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

  switchBranch: async (projectId: string, branchName: string) => {
    try {
      set({ isLoading: true, errorMessage: null });
      const res = await axios.post(`/api/projects/${projectId}/repository/checkout`, {
        branchName,
      });

      if (res.data.success) {
        set({
          branches: res.data.branches,
          currentBranch: res.data.current,
          isLoading: false,
          successMessage: `✓ Switched to branch "${res.data.current}"`,
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchFileTree(projectId);
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

  fetchHistory: async (projectId: string) => {
    try {
      const res = await axios.get(`/api/projects/${projectId}/repository/commits`);
      if (res.data.success) {
        set({ history: res.data.history });
      }
    } catch (e: any) {
      console.warn('Failed to fetch commits:', e.message);
    }
  },

  push: async (projectId: string, branch?: string) => {
    try {
      set({ isPushing: true, errorMessage: null, successMessage: null });
      const token = localStorage.getItem('moduleforge_github_token') || undefined;
      const res = await axios.post(`/api/projects/${projectId}/repository/push`, {
        branch: branch || get().currentBranch,
        token,
      });

      if (res.data.success) {
        set({
          isPushing: false,
          successMessage: `✓ ${res.data.message || `Push successful: to "${res.data.branch}"`}`,
        });
        await get().fetchRepoOverview(projectId);
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

  pull: async (projectId: string, branch?: string) => {
    try {
      set({ isPulling: true, errorMessage: null, successMessage: null });
      const token = localStorage.getItem('moduleforge_github_token') || undefined;
      const res = await axios.post(`/api/projects/${projectId}/repository/pull`, {
        branch: branch || get().currentBranch,
        token,
      });

      if (res.data.success) {
        set({
          isPulling: false,
          successMessage: `✓ Pull complete: ${res.data.message}`,
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchFileTree(projectId);
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

  ingestZipModule: async (projectId, file, moduleName, destinationPath, version) => {
    try {
      set({ isIngesting: true, errorMessage: null, successMessage: null });
      const formData = new FormData();
      formData.append('file', file);
      if (moduleName) formData.append('moduleName', moduleName);
      if (destinationPath) formData.append('destinationPath', destinationPath);
      if (version) formData.append('version', version);

      const res = await axios.post(
        `/api/projects/${projectId}/repository/modules/ingest-zip`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (res.data.success) {
        set({
          isIngesting: false,
          successMessage: res.data.message || 'Module added to project repository!',
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchFileTree(projectId);
        return { success: true };
      }
      return { success: false, error: 'Failed to ingest module' };
    } catch (e: any) {
      const err = e.response?.data?.error || e.message || 'Failed to ingest ZIP module';
      set({ isIngesting: false, errorMessage: err });
      return { success: false, error: err };
    }
  },

  ingestGithubModule: async (projectId, githubUrl, moduleName, destinationPath) => {
    try {
      set({ isIngesting: true, errorMessage: null, successMessage: null });
      const res = await axios.post(
        `/api/projects/${projectId}/repository/modules/ingest-github`,
        { githubUrl, moduleName, destinationPath }
      );

      if (res.data.success) {
        set({
          isIngesting: false,
          successMessage: res.data.message || 'GitHub module added to project repository!',
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchFileTree(projectId);
        return { success: true };
      }
      return { success: false, error: 'Failed to ingest GitHub module' };
    } catch (e: any) {
      const err = e.response?.data?.error || e.message || 'Failed to ingest GitHub module';
      set({ isIngesting: false, errorMessage: err });
      return { success: false, error: err };
    }
  },

  ingestMarketplaceModule: async (projectId, moduleId, version, destinationPath) => {
    try {
      set({ isIngesting: true, errorMessage: null, successMessage: null });
      const res = await axios.post(
        `/api/projects/${projectId}/repository/modules/ingest-marketplace`,
        { moduleId, version, destinationPath }
      );

      if (res.data.success) {
        set({
          isIngesting: false,
          successMessage: res.data.message || 'Marketplace module added to project repository!',
        });
        await get().fetchRepoOverview(projectId);
        await get().fetchFileTree(projectId);
        return { success: true };
      }
      return { success: false, error: 'Failed to add marketplace module' };
    } catch (e: any) {
      const err = e.response?.data?.error || e.message || 'Failed to add marketplace module';
      set({ isIngesting: false, errorMessage: err });
      return { success: false, error: err };
    }
  },

  setActiveFileContent: (content: string) => {
    const original = get().originalFileContent;
    set({ activeFileContent: content, isDirty: content !== original });
  },

  clearMessages: () => set({ errorMessage: null, successMessage: null }),
}));
