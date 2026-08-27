import { Router } from 'express';
import { prisma } from '../prisma';
import { realtimeEventManager } from '../services/realtimeEvents';

export const notificationsRouter = Router();

// GET /api/notifications - Get current user notifications
notificationsRouter.get('/', async (req, res) => {
  try {
    const userId = (req.query.userId || req.headers['x-user-id']) as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const notifications = await (prisma as any).notification.findMany({
      where: { userId },
      include: {
        relatedTeam: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        relatedInvitation: {
          select: {
            id: true,
            token: true,
            status: true,
            role: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await (prisma as any).notification.count({
      where: {
        userId,
        read: false,
      },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/stream - Server-Sent Events stream for user notifications
notificationsRouter.get('/stream', (req, res) => {
  const userId = (req.query.userId || req.headers['x-user-id']) as string | undefined;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required for notification stream' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const unregister = realtimeEventManager.registerUserClient(userId, res);

  req.on('close', () => {
    unregister();
  });
});

// PATCH /api/notifications/:id/read - Mark notification as read
notificationsRouter.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.query.userId || req.body?.userId || req.headers['x-user-id']) as string | undefined;

    const notif = await (prisma as any).notification.updateMany({
      where: {
        id,
        ...(userId ? { userId } : {}),
      },
      data: { read: true },
    });

    res.json({ success: true, updated: notif });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

// POST /api/notifications/read-all - Mark all notifications as read
notificationsRouter.post('/read-all', async (req, res) => {
  try {
    const userId = (req.query.userId || req.body?.userId || req.headers['x-user-id']) as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await (prisma as any).notification.updateMany({
      where: { userId },
      data: { read: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: error.message || 'Failed to mark all notifications as read' });
  }
});

// POST /api/notifications/:id/respond - Direct response (accept/decline) from notification panel
notificationsRouter.post('/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, userId } = req.body; // 'accept' | 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "accept" or "decline"' });
    }

    const notif = await (prisma as any).notification.findUnique({
      where: { id },
      include: {
        relatedInvitation: true,
        relatedTeam: true,
      },
    });

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (!notif.relatedInvitation) {
      return res.status(400).json({ error: 'No active invitation linked to this notification' });
    }

    const invitation = notif.relatedInvitation;

    if (action === 'accept') {
      if (invitation.status === 'accepted') {
        return res.json({ success: true, message: 'Already accepted', teamId: invitation.teamId });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'This invitation has expired' });
      }

      // Add to team
      await (prisma as any).teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: invitation.teamId,
            userId,
          },
        },
        update: { role: invitation.role || 'member' },
        create: {
          teamId: invitation.teamId,
          userId,
          role: invitation.role || 'member',
        },
      });

      // Update invitation
      await (prisma as any).teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          inviteeUserId: userId,
        },
      });

      // Mark notification as read
      await (prisma as any).notification.update({
        where: { id },
        data: { read: true },
      });

      // Notify inviter
      const user = await (prisma as any).user.findUnique({ where: { id: userId } });
      const acceptNotif = await (prisma as any).notification.create({
        data: {
          userId: invitation.inviterId,
          type: 'invitation_accepted',
          title: 'Invitation Accepted',
          message: `${user?.name || `@${user?.username}`} joined ${notif.relatedTeam?.name || 'your team'}`,
          relatedTeamId: invitation.teamId,
          relatedInvitationId: invitation.id,
          read: false,
        },
      });

      realtimeEventManager.broadcastToUser(invitation.inviterId, {
        type: 'NOTIFICATION_RECEIVED',
        notification: acceptNotif,
      });

      return res.json({
        success: true,
        message: `Joined ${notif.relatedTeam?.name}`,
        teamId: invitation.teamId,
      });
    } else {
      // Decline
      await (prisma as any).teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'declined' },
      });

      await (prisma as any).notification.update({
        where: { id },
        data: { read: true },
      });

      return res.json({
        success: true,
        message: 'Invitation declined',
      });
    }
  } catch (error: any) {
    console.error('Error responding to invitation notification:', error);
    res.status(500).json({ error: error.message || 'Failed to respond to notification' });
  }
});
