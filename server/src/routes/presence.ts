import { Router } from 'express';
import { prisma } from '../prisma';

export const presenceRouter = Router();

// GET /api/presence - Get presence status for users (can filter by comma-separated userIds)
presenceRouter.get('/', async (req, res) => {
  try {
    const { userIds } = req.query;

    let whereClause: any = {};
    if (userIds) {
      const ids = String(userIds).split(',').map((id) => id.trim());
      whereClause.userId = { in: ids };
    }

    const presenceList = await (prisma as any).userPresence.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // Also mark users whose lastSeen > 2 minutes ago as offline
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const mapped = presenceList.map((p: any) => {
      const isRecentlyActive = new Date(p.lastSeen) > twoMinutesAgo;
      return {
        ...p,
        status: isRecentlyActive ? p.status : 'offline',
      };
    });

    res.json({ presence: mapped });
  } catch (error: any) {
    console.error('Error fetching presence (fallback to empty):', error.message);
    res.json({ presence: [], isFallback: true });
  }
});

// POST /api/presence/heartbeat - Update user's presence heartbeat and current activity
presenceRouter.post('/heartbeat', async (req, res) => {
  const { userId, status = 'online', customStatus, currentActivity } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const userExists = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      return res.json({ presence: { userId, status: 'offline' } });
    }

    const presence = await (prisma as any).userPresence.upsert({
      where: { userId },
      update: {
        status,
        customStatus: customStatus !== undefined ? customStatus : undefined,
        currentActivity: currentActivity !== undefined ? currentActivity : undefined,
        lastSeen: new Date(),
      },
      create: {
        userId,
        status,
        customStatus: customStatus || null,
        currentActivity: currentActivity || null,
        lastSeen: new Date(),
      },
    });

    res.json({ presence });
  } catch (error: any) {
    console.error('Error updating presence heartbeat (fallback):', error.message);
    res.json({ presence: { userId, status: 'online' }, isFallback: true });
  }
});
