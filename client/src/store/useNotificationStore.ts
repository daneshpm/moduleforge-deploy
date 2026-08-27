import { create } from 'zustand';
import { Notification } from '../types';
import { useAuthStore } from './useAuthStore';

const API_BASE = '/api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isPanelOpen: boolean;

  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  respondToInvitation: (notificationId: string, action: 'accept' | 'decline') => Promise<{ success: boolean; teamId?: string; error?: string }>;
  startListening: () => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isPanelOpen: false,

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelOpen: (open: boolean) => set({ isPanelOpen: open }),

  fetchNotifications: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const res = await fetch(`${API_BASE}/notifications?userId=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        set({
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  },

  markAsRead: async (id: string) => {
    const user = useAuthStore.getState().user;
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  },

  markAllAsRead: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  },

  respondToInvitation: async (notificationId: string, action: 'accept' | 'decline') => {
    const user = useAuthStore.getState().user;
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch(`${API_BASE}/notifications/${notificationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to respond' };
      }

      await get().fetchNotifications();
      return {
        success: true,
        teamId: data.teamId,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  startListening: () => {
    const user = useAuthStore.getState().user;
    if (!user) return () => {};

    // Initial fetch
    get().fetchNotifications();

    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;

    try {
      eventSource = new EventSource(`${API_BASE}/notifications/stream?userId=${user.id}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'NOTIFICATION_RECEIVED') {
            get().fetchNotifications();
          }
        } catch {
          // ignore
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Fallback to polling every 6 seconds if SSE disconnects
        if (!fallbackInterval) {
          fallbackInterval = setInterval(() => {
            get().fetchNotifications();
          }, 6000);
        }
      };
    } catch {
      fallbackInterval = setInterval(() => {
        get().fetchNotifications();
      }, 6000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  },
}));
