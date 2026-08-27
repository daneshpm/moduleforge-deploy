import { Response } from 'express';

export interface RealtimeProjectEvent {
  type: 'MODULE_UPDATED' | 'ACTIVITY_CREATED' | 'PROJECT_SYNCED' | 'ROLLBACK_COMPLETED' | 'MEMBER_JOINED';
  projectId: string;
  moduleId?: string;
  moduleName?: string;
  commitSha?: string;
  author?: string;
  message?: string;
  status?: string;
  data?: any;
  timestamp: string;
}

export interface RealtimeNotificationEvent {
  type: 'NOTIFICATION_RECEIVED' | 'INVITATION_STATUS_CHANGED';
  userId: string;
  notification?: any;
  unreadCount?: number;
  timestamp: string;
}

class RealtimeEventManager {
  // Map of projectId -> Set of SSE Response streams
  private projectClients = new Map<string, Set<Response>>();
  // Map of userId -> Set of SSE Response streams
  private userClients = new Map<string, Set<Response>>();

  // Register client connection for a project
  public registerClient(projectId: string, res: Response): () => void {
    if (!this.projectClients.has(projectId)) {
      this.projectClients.set(projectId, new Set());
    }

    const clients = this.projectClients.get(projectId)!;
    clients.add(res);

    console.log(`[SSE] Client connected to project ${projectId}. Total active listeners: ${clients.size}`);

    // Return cleanup function on disconnect
    return () => {
      clients.delete(res);
      if (clients.size === 0) {
        this.projectClients.delete(projectId);
      }
      console.log(`[SSE] Client disconnected from project ${projectId}. Remaining: ${clients.size}`);
    };
  }

  // Register client connection for a user's notification stream
  public registerUserClient(userId: string, res: Response): () => void {
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }

    const clients = this.userClients.get(userId)!;
    clients.add(res);

    console.log(`[SSE] User ${userId} connected to notification stream. Total listeners: ${clients.size}`);

    return () => {
      clients.delete(res);
      if (clients.size === 0) {
        this.userClients.delete(userId);
      }
      console.log(`[SSE] User ${userId} disconnected from notifications. Remaining: ${clients.size}`);
    };
  }

  // Broadcast event payload to all clients listening to this project
  public broadcastToProject(projectId: string, event: Omit<RealtimeProjectEvent, 'projectId' | 'timestamp'>) {
    const clients = this.projectClients.get(projectId);
    if (!clients || clients.size === 0) return;

    const payload: RealtimeProjectEvent = {
      ...event,
      projectId,
      timestamp: new Date().toISOString(),
    };

    const sseData = `data: ${JSON.stringify(payload)}\n\n`;

    for (const client of clients) {
      try {
        client.write(sseData);
      } catch (err: any) {
        console.warn(`[SSE] Failed to write event to client:`, err.message);
        clients.delete(client);
      }
    }
  }

  // Broadcast notification event to a specific user
  public broadcastToUser(userId: string, event: Omit<RealtimeNotificationEvent, 'userId' | 'timestamp'>) {
    const clients = this.userClients.get(userId);
    if (!clients || clients.size === 0) return;

    const payload: RealtimeNotificationEvent = {
      ...event,
      userId,
      timestamp: new Date().toISOString(),
    };

    const sseData = `data: ${JSON.stringify(payload)}\n\n`;

    for (const client of clients) {
      try {
        client.write(sseData);
      } catch (err: any) {
        console.warn(`[SSE] Failed to write notification to user:`, err.message);
        clients.delete(client);
      }
    }
  }
}

export const realtimeEventManager = new RealtimeEventManager();
