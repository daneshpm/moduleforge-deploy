import { create } from 'zustand';
import { User } from '../types';
import { firebaseAuth, googleProvider, isFirebaseConfigured } from '../firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';

const API_BASE = '/api';

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
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (e) {
    return null;
  }
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

// Helper to sync user profile with backend SQLite database
async function syncWithBackend(userData: Partial<User>): Promise<{ user: User; needsUsernameSetup: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      return {
        user: data.user,
        needsUsernameSetup: Boolean(data.needsUsernameSetup || !data.user.username),
      };
    }
  } catch (err) {
    console.warn('Backend sync fallback:', err);
  }

  // Fallback if backend unreachable
  const fallbackUser: User = {
    id: userData.id || `user-${Date.now()}`,
    email: userData.email || 'user@moduleforge.local',
    name: userData.name || 'Developer',
    username: userData.username || userData.email?.split('@')[0] || 'developer',
    avatarUrl: userData.avatarUrl,
    isDev: userData.isDev ?? true,
  };

  return {
    user: fallbackUser,
    needsUsernameSetup: !fallbackUser.username,
  };
}

// ---------------------------------------------------------------------------
// Store Interface
// ---------------------------------------------------------------------------
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isDevMode: boolean;
  needsUsernameSetup: boolean;

  setNeedsUsernameSetup: (needs: boolean) => void;
  checkAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithGoogleDev: (email?: string, name?: string, avatarUrl?: string) => Promise<{ success: boolean; error?: string }>;
  updateUsername: (username: string, name?: string, avatarUrl?: string) => Promise<{ success: boolean; error?: string }>;
  checkUsernameAvailability: (username: string) => Promise<{ available: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
}

function formatFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in your Firebase console.';
    case 'auth/weak-password':
      return 'The password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No account exists with this email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to many failed attempts. Try again later or reset your password.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in cancelled';
    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}

const isLocalAuthFallback = !isFirebaseConfigured && !(
  Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
);

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isDevMode: isLocalAuthFallback,
  needsUsernameSetup: false,

  setNeedsUsernameSetup: (needs: boolean) => set({ needsUsernameSetup: needs }),

  // ── Restore session on page load ─────────────────────────────────────────
  checkAuth: async () => {
    set({ isLoading: true, error: null });

    // 1. Firebase session restore
    if (isFirebaseConfigured && firebaseAuth) {
      await new Promise<void>((resolve) => {
        const unsubscribe = firebaseAuth!.onAuthStateChanged(async (fbUser) => {
          unsubscribe();
          if (fbUser) {
            const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
              id: fbUser.uid,
              email: fbUser.email ?? '',
              name: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'User',
              avatarUrl: fbUser.photoURL ?? undefined,
              googleId: fbUser.uid,
              isDev: false,
            });
            persist(syncedUser);
            set({ user: syncedUser, isAuthenticated: true, isLoading: false, needsUsernameSetup });
          } else {
            // No Firebase session — fall through to localStorage
            const saved = readPersisted();
            if (saved) {
              set({ user: saved, isAuthenticated: true, isLoading: false, needsUsernameSetup: !saved.username });
            } else {
              set({ user: null, isAuthenticated: false, isLoading: false });
            }
          }
          resolve();
        });
      });
      return;
    }

    // 2. Supabase session restore
    const sb = await getSupabase();

    if (sb) {
      // ── Supabase path ──
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        const email = session.user.email ?? '';
        const name = session.user.user_metadata?.name ?? session.user.user_metadata?.full_name ?? email.split('@')[0];
        const avatarUrl = session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture;
        const googleId = session.user.identities?.find((id: any) => id.provider === 'google')?.id || session.user.id;

        const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
          id: session.user.id,
          email,
          name,
          avatarUrl,
          googleId,
          isDev: false,
        });

        persist(syncedUser);
        set({
          user: syncedUser,
          isAuthenticated: true,
          isLoading: false,
          needsUsernameSetup,
        });
        return;
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // ── Dev / offline mode — restore from localStorage ──
    const saved = readPersisted();
    if (saved) {
      // Re-verify with backend to get latest username / profile
      try {
        const { user: syncedUser, needsUsernameSetup } = await syncWithBackend(saved);
        persist(syncedUser);
        set({
          user: syncedUser,
          isAuthenticated: true,
          isLoading: false,
          needsUsernameSetup,
        });
        return;
      } catch {
        set({ user: saved, isAuthenticated: true, isLoading: false, needsUsernameSetup: !saved.username });
        return;
      }
    }

    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  // ── Sign in with Google ──────────────────────────────────────────────────
  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });

    // 1. Firebase path (preferred)
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        const fbUser = result.user;

        const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
          id: fbUser.uid,
          email: fbUser.email ?? '',
          name: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'User',
          avatarUrl: fbUser.photoURL ?? undefined,
          googleId: fbUser.uid,
          isDev: false,
        });

        persist(syncedUser);
        set({ user: syncedUser, isAuthenticated: true, isLoading: false, needsUsernameSetup });
        return { success: true };
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          set({ isLoading: false });
          return { success: false, error: 'Sign-in cancelled' };
        }
        const friendlyMessage = formatFirebaseAuthError(err);
        set({ isLoading: false, error: friendlyMessage });
        return { success: false, error: friendlyMessage };
      }
    }

    // 2. Supabase path (fallback)
    const sb = await getSupabase();
    if (sb) {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: { access_type: 'offline' },
        },
      });
      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }
      return { success: true };
    }

    // 3. Dev fallback
    return get().loginWithGoogleDev();
  },

  // ── Dev Google Login Simulation ──────────────────────────────────────────
  loginWithGoogleDev: async (
    email?: string,
    name?: string,
    avatarUrl?: string
  ) => {
    set({ isLoading: true, error: null });

    const devEmail = email || 'developer@moduleforge.local';
    const devName = name || devEmail.split('@')[0];

    try {
      const res = await fetch(`${API_BASE}/auth/google-dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: devEmail, name: devName, avatarUrl }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.user) {
        persist(data.user);
        set({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          needsUsernameSetup: Boolean(data.needsUsernameSetup || !data.user.username),
        });
        return { success: true };
      }
      throw new Error(data?.error || 'Failed to sign in with Google account');
    } catch (err: any) {
      console.warn('Google dev sign-in API fallback active:', err);
      const fallbackUser: User = {
        id: `dev-${Date.now()}`,
        email: devEmail,
        name: devName,
        username: devEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'developer',
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(devName)}`,
        isDev: true,
      };
      persist(fallbackUser);
      set({
        user: fallbackUser,
        isAuthenticated: true,
        isLoading: false,
        needsUsernameSetup: false,
      });
      return { success: true };
    }
  },

  // ── Update Username ──────────────────────────────────────────────────────
  updateUsername: async (username: string, name?: string, avatarUrl?: string) => {
    const currentUser = get().user;
    if (!currentUser) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          username,
          name: name || currentUser.name,
          avatarUrl: avatarUrl || currentUser.avatarUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update username' };
      }

      const updatedUser = data.user;
      persist(updatedUser);
      set({
        user: updatedUser,
        needsUsernameSetup: false,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  // ── Check Username Availability ──────────────────────────────────────────
  checkUsernameAvailability: async (username: string) => {
    const currentUser = get().user;
    try {
      const query = new URLSearchParams({
        username,
        ...(currentUser?.id ? { userId: currentUser.id } : {}),
      });
      const res = await fetch(`${API_BASE}/users/check-username?${query.toString()}`);
      const data = await res.json();
      return {
        available: Boolean(data.available),
        error: data.error,
      };
    } catch (err: any) {
      return { available: false, error: 'Failed to verify username availability' };
    }
  },

  // ── Sign in with Email / Password ─────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    // 1. Firebase path (preferred)
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const fbUser = cred.user;

        const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
          id: fbUser.uid,
          email: fbUser.email ?? email,
          name: fbUser.displayName ?? email.split('@')[0],
          avatarUrl: fbUser.photoURL ?? undefined,
          googleId: fbUser.uid,
          isDev: false,
        });

        persist(syncedUser);
        set({ user: syncedUser, isAuthenticated: true, isLoading: false, needsUsernameSetup });
        return { success: true };
      } catch (err: any) {
        const friendlyMessage = formatFirebaseAuthError(err);
        set({ isLoading: false, error: friendlyMessage });
        return { success: false, error: friendlyMessage };
      }
    }

    // 2. Supabase path (fallback)
    const sb = await getSupabase();
    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        const msg = error?.message ?? 'Login failed';
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }

      const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
        id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.name ?? email.split('@')[0],
        avatarUrl: data.user.user_metadata?.avatar_url,
      });

      persist(syncedUser);
      set({ user: syncedUser, isAuthenticated: true, isLoading: false, needsUsernameSetup });
      return { success: true };
    }

    // 3. Dev fallback
    if (!email || !password) {
      set({ isLoading: false, error: 'Email and password are required' });
      return { success: false, error: 'Email and password are required' };
    }

    const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
      email,
      name: email.split('@')[0],
      isDev: true,
    });

    persist(syncedUser);
    set({ user: syncedUser, isAuthenticated: true, isLoading: false, needsUsernameSetup });
    return { success: true };
  },

  // ── Register ─────────────────────────────────────────────────────────────
  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true, error: null });

    // 1. Firebase path (preferred)
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const fbUser = cred.user;

        if (name && fbUser) {
          try {
            await updateProfile(fbUser, { displayName: name });
          } catch (profileErr) {
            console.warn('Could not set displayName on Firebase user:', profileErr);
          }
        }

        const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
          id: fbUser.uid,
          email: fbUser.email ?? email,
          name: name || fbUser.displayName || email.split('@')[0],
          avatarUrl: fbUser.photoURL ?? undefined,
          googleId: fbUser.uid,
          isDev: false,
        });

        persist(syncedUser);
        set({
          user: syncedUser,
          isAuthenticated: true,
          isLoading: false,
          needsUsernameSetup,
        });
        return { success: true };
      } catch (err: any) {
        const friendlyMessage = formatFirebaseAuthError(err);
        set({ isLoading: false, error: friendlyMessage });
        return { success: false, error: friendlyMessage };
      }
    }

    // 2. Supabase path (fallback)
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

      const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
        id: data.user?.id,
        email,
        name,
      });

      if (syncedUser) persist(syncedUser);
      set({
        user: syncedUser,
        isAuthenticated: Boolean(syncedUser),
        isLoading: false,
        needsUsernameSetup,
      });
      return { success: true };
    }

    // 3. Dev fallback
    const { user: syncedUser, needsUsernameSetup } = await syncWithBackend({
      email,
      name,
      isDev: true,
    });

    persist(syncedUser);
    set({ user: syncedUser, isAuthenticated: true, isLoading: false, needsUsernameSetup });
    return { success: true };
  },

  // ── Reset Password ───────────────────────────────────────────────────────
  resetPassword: async (email: string) => {
    // 1. Firebase path (preferred)
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        await sendPasswordResetEmail(firebaseAuth, email);
        return { success: true, message: 'Password reset link sent to your email address.' };
      } catch (err: any) {
        const friendlyMessage = formatFirebaseAuthError(err);
        return { success: false, error: friendlyMessage };
      }
    }

    // 2. Supabase path (fallback)
    const sb = await getSupabase();
    if (sb) {
      const { error } = await sb.auth.resetPasswordForEmail(email);
      if (error) return { success: false, error: error.message };
      return { success: true, message: 'Password reset link sent to your email.' };
    }

    // 3. Dev fallback
    return { success: true, message: 'Password reset email simulated for dev.' };
  },

  // ── Sign out ─────────────────────────────────────────────────────────────
  logout: async () => {
    // Sign out from Firebase if active
    if (isFirebaseConfigured && firebaseAuth) {
      try { await firebaseSignOut(firebaseAuth); } catch (_) {}
    }
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
    persist(null);
    set({ user: null, isAuthenticated: false, isLoading: false, needsUsernameSetup: false });
  },
}));
