import { create } from 'zustand';
import { User } from '../types';

// ---------------------------------------------------------------------------
// Supabase is an optional peer — imported lazily so the build doesn't break
// when VITE_SUPABASE_URL is not set (local dev without Supabase).
// ---------------------------------------------------------------------------
let supabaseClient: any = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'moduleforge_user';

function persist(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function readPersisted(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isDevMode: boolean;

  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const isLocalAuthFallback = !(
  Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
);

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isDevMode: isLocalAuthFallback,

  // ── Restore session on page load ─────────────────────────────────────────
  checkAuth: async () => {
    set({ isLoading: true, error: null });

    const sb = await getSupabase();

    if (sb) {
      // ── Supabase path ──
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        const u: User = {
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.name ?? session.user.email,
          avatarUrl: session.user.user_metadata?.avatar_url,
        };
        persist(u);
        set({ user: u, isAuthenticated: true, isLoading: false });
        return;
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // ── No Supabase — restore from localStorage (dev / offline) ──
    const saved = readPersisted();
    if (saved) {
      set({ user: saved, isAuthenticated: true, isLoading: false });
      return;
    }

    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  // ── Sign in ──────────────────────────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    const sb = await getSupabase();

    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        const msg = error?.message ?? 'Login failed';
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }
      const u: User = {
        id: data.user.id,
        email: data.user.email ?? '',
        name: data.user.user_metadata?.name ?? data.user.email,
        avatarUrl: data.user.user_metadata?.avatar_url,
      };
      persist(u);
      set({ user: u, isAuthenticated: true, isLoading: false });
      return { success: true };
    }

    // ── Dev fallback when Supabase is not configured ──
    if (!email || !password) {
      set({ isLoading: false, error: 'Email and password are required' });
      return { success: false, error: 'Email and password are required' };
    }
    const devUser: User = {
      id: `local-${Date.now()}`,
      email,
      name: email.split('@')[0],
    };
    persist(devUser);
    set({ user: devUser, isAuthenticated: true, isLoading: false });
    return { success: true };
  },

  // ── Register ─────────────────────────────────────────────────────────────
  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true, error: null });
    const sb = await getSupabase();

    if (sb) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      // Supabase may require email confirmation — handle gracefully
      const u: User | null = data.user
        ? { id: data.user.id, email: data.user.email ?? '', name }
        : null;
      if (u) persist(u);
      set({ user: u, isAuthenticated: Boolean(u), isLoading: false });
      return { success: true };
    }

    // ── Dev fallback ──
    const devUser: User = { id: `local-${Date.now()}`, email, name };
    persist(devUser);
    set({ user: devUser, isAuthenticated: true, isLoading: false });
    return { success: true };
  },

  // ── Sign out ─────────────────────────────────────────────────────────────
  logout: async () => {
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
    persist(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
