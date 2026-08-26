import { create } from 'zustand';
import { Module, Category, ValidationResult, ModuleMetadataInput } from '../types';

interface WebhookStatusResult {
  registered: boolean;
  webhookId?: string;
  webhookUrl?: string;
  active?: boolean;
  tokenMissing?: boolean;
  error?: string;
}

interface ModuleState {
  modules: Module[];
  categories: Category[];
  selectedCategory: string;
  searchQuery: string;
  sortBy: string; // 'popular' | 'newest' | 'name'
  isLoading: boolean;
  error: string | null;

  fetchModules: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  setCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: string) => void;
  validateModuleZip: (file: File) => Promise<ValidationResult>;
  validateGithubRepo: (repoUrl: string) => Promise<ValidationResult>;
  createModule: (metadata: ModuleMetadataInput) => Promise<{ success: boolean; module?: Module; error?: string }>;
  uploadModuleZip: (file: File) => Promise<ValidationResult>;
  importGithubRepo: (repoUrl: string) => Promise<ValidationResult>;
  deleteModule: (id: string) => Promise<{ success: boolean; error?: string }>;
  checkModuleSync: (id: string) => Promise<{ success: boolean; hasUpdate?: boolean; status?: string; error?: string }>;
  syncModule: (id: string) => Promise<{ success: boolean; module?: Module; error?: string }>;
  fetchModuleSyncHistory: (id: string) => Promise<any[]>;
  updateRuntimeConfig: (id: string, config: any) => Promise<{ success: boolean; module?: Module; error?: string }>;
  // GitHub webhook management
  fetchWebhookStatus: (id: string) => Promise<WebhookStatusResult>;
  registerWebhook: (id: string) => Promise<{ success: boolean; webhookId?: string; webhookUrl?: string; alreadyRegistered?: boolean; error?: string }>;
  deleteWebhook: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const API_BASE = '/api';

export const useModuleStore = create<ModuleState>((set, get) => ({
  modules: [],
  categories: [],
  selectedCategory: 'All',
  searchQuery: '',
  sortBy: 'popular',
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) {
        const categories = await res.json();
        set({ categories });
      }
    } catch (e) {
      console.warn('Failed to fetch categories:', e);
    }
  },

  fetchModules: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedCategory, searchQuery, sortBy } = get();
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (sortBy) {
        params.append('sort', sortBy);
      }

      const res = await fetch(`${API_BASE}/modules?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch modules');
      }
      const modules = await res.json();
      set({ modules, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Error loading modules', isLoading: false });
    }
  },

  setCategory: (category: string) => {
    set({ selectedCategory: category });
    get().fetchModules();
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().fetchModules();
  },

  setSortBy: (sort: string) => {
    set({ sortBy: sort });
    get().fetchModules();
  },

  validateModuleZip: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/modules/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return data;
  },

  validateGithubRepo: async (repoUrl: string) => {
    const res = await fetch(`${API_BASE}/modules/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    });

    const data = await res.json();
    return data;
  },

  createModule: async (metadata: ModuleMetadataInput) => {
    try {
      const res = await fetch(`${API_BASE}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save module');
      }

      get().fetchModules();
      return { success: true, module: data.module };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  uploadModuleZip: async (file: File) => {
    return get().validateModuleZip(file);
  },

  importGithubRepo: async (repoUrl: string) => {
    return get().validateGithubRepo(repoUrl);
  },

  deleteModule: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete module');
      }
      set((state) => ({
        modules: state.modules.filter((m) => m.id !== id && m.slug !== id),
      }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  checkModuleSync: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/check-sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check sync');
      get().fetchModules();
      return { success: true, hasUpdate: data.hasUpdate, status: data.status };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  syncModule: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync module');
      get().fetchModules();
      return { success: true, module: data.module };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  fetchModuleSyncHistory: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/sync-history`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  updateRuntimeConfig: async (id: string, config: any) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/runtime-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update runtime configuration');
      }
      get().fetchModules();
      return { success: true, module: data.module };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // ── GitHub webhook management ──────────────────────────────────────────────

  fetchWebhookStatus: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/webhook-status`);
      const data = await res.json();
      if (!res.ok) return { registered: false, error: data.error || 'Failed to fetch webhook status' };
      return data as WebhookStatusResult;
    } catch (e: any) {
      return { registered: false, error: e.message };
    }
  },

  registerWebhook: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/register-webhook`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to register webhook' };
      return {
        success: true,
        webhookId: data.webhookId,
        webhookUrl: data.webhookUrl,
        alreadyRegistered: data.alreadyRegistered ?? false,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  deleteWebhook: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/modules/${id}/webhook`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to delete webhook' };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
}));
