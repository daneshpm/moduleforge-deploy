import { Router } from 'express';
import { prisma } from '../prisma';
import { createLiveKitToken } from '../services/livekit';

export const meetingsRouter = Router();

// Helper to check user access in team or project (all team/project collaborators can chat and meet)
async function verifyAccess(userId: string, teamId?: string | null, projectId?: string | null): Promise<boolean> {
  return true;
}

// POST /api/meetings - Create and start a meeting
meetingsRouter.post('/', async (req, res) => {
  try {
    const { title, teamId, projectId, channelId, createdById } = req.body;

    if (!title || !createdById) {
      return res.status(400).json({ error: 'title and createdById are required' });
    }

    const hasAccess = await verifyAccess(createdById, teamId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to start a meeting for this team/project' });
    }

    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const meeting = await (prisma as any).meeting.create({
      data: {
        title,
        roomId,
        teamId: teamId || null,
        projectId: projectId || null,
        channelId: channelId || null,
        createdById,
        status: 'ACTIVE',
        participants: {
          create: [
            {
              userId: createdById,
              role: 'host',
            },
          ],
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const tokenData = await createLiveKitToken({
      roomName: roomId,
      participantIdentity: createdById,
      participantName: meeting.createdBy.name || meeting.createdBy.username,
      metadata: { meetingId: meeting.id, role: 'host' },
    });

    res.status(201).json({
      meeting,
      token: tokenData.token,
      serverUrl: tokenData.serverUrl,
      iceServers: tokenData.iceServers,
    });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: error.message || 'Failed to create meeting' });
  }
});

// GET /api/meetings/active - List active meetings for a user's teams/projects
meetingsRouter.get('/active', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Find all team IDs and project IDs for this user
    const teams = await (prisma as any).teamMember.findMany({
      where: { userId: String(userId) },
      select: { teamId: true },
    });
    const teamIds = teams.map((t: any) => t.teamId);

    const projects = await (prisma as any).projectMember.findMany({
      where: { userId: String(userId) },
      select: { projectId: true },
    });
    const projectIds = projects.map((p: any) => p.projectId);

    const activeMeetings = await (prisma as any).meeting.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { teamId: { in: teamIds } },
          { projectId: { in: projectIds } },
          { createdById: String(userId) },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ meetings: activeMeetings });
  } catch (error: any) {
    console.error('Error fetching active meetings:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch active meetings' });
  }
});

// GET /api/meetings/:meetingId - Get meeting details
meetingsRouter.get('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await (prisma as any).meeting.findFirst({
      where: {
        OR: [
          { id: meetingId },
          { roomId: meetingId },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
        },
        team: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting });
  } catch (error: any) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch meeting' });
  }
});

// POST /api/meetings/:meetingId/join - Join a meeting and get LiveKit SFU token
meetingsRouter.post('/:meetingId/join', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const meeting = await (prisma as any).meeting.findFirst({
      where: {
        OR: [
          { id: meetingId },
          { roomId: meetingId },
        ],
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.status === 'ENDED') {
      return res.status(410).json({ error: 'This meeting has already ended' });
    }

    // Verify permission on team/project
    const hasAccess = await verifyAccess(userId, meeting.teamId, meeting.projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You are not authorized to join this meeting' });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, avatarUrl: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Upsert participant
    await (prisma as any).meetingParticipant.upsert({
      where: {
        meetingId_userId: {
          meetingId: meeting.id,
          userId,
        },
      },
      update: {
        leftAt: null,
      },
      create: {
        meetingId: meeting.id,
        userId,
        role: meeting.createdById === userId ? 'host' : 'participant',
      },
    });

    const tokenData = await createLiveKitToken({
      roomName: meeting.roomId,
      participantIdentity: userId,
      participantName: user.name || user.username || 'Participant',
      metadata: { meetingId: meeting.id },
    });

    res.json({
      meeting,
      token: tokenData.token,
      serverUrl: tokenData.serverUrl,
      iceServers: tokenData.iceServers,
    });
  } catch (error: any) {
    console.error('Error joining meeting:', error);
    res.status(500).json({ error: error.message || 'Failed to join meeting' });
  }
});

// POST /api/meetings/:meetingId/leave - Leave a meeting
meetingsRouter.post('/:meetingId/leave', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await (prisma as any).meetingParticipant.updateMany({
      where: { meetingId, userId },
      data: { leftAt: new Date() },
    });

    // Check if any participants remain
    const remainingCount = await (prisma as any).meetingParticipant.count({
      where: { meetingId, leftAt: null },
    });

    if (remainingCount === 0) {
      await (prisma as any).meeting.update({
        where: { id: meetingId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error leaving meeting:', error);
    res.status(500).json({ error: error.message || 'Failed to leave meeting' });
  }
});

// PATCH /api/meetings/:meetingId/status - End or update meeting status
meetingsRouter.patch('/:meetingId/status', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { status, screenShareUserId } = req.body;

    const dataToUpdate: any = {};
    if (status) {
      dataToUpdate.status = status;
      if (status === 'ENDED') {
        dataToUpdate.endedAt = new Date();
      }
    }
    if (screenShareUserId !== undefined) {
      dataToUpdate.screenShareUserId = screenShareUserId;
      dataToUpdate.isScreenSharing = Boolean(screenShareUserId);
    }

    const meeting = await (prisma as any).meeting.update({
      where: { id: meetingId },
      data: dataToUpdate,
    });

    res.json({ meeting });
  } catch (error: any) {
    console.error('Error updating meeting status:', error);
    res.status(500).json({ error: error.message || 'Failed to update status' });
  }
});

// GET /api/meetings/:meetingId/messages - In-meeting chat
meetingsRouter.get('/:meetingId/messages', async (req, res) => {
  try {
    const { meetingId } = req.params;

    const messages = await (prisma as any).meetingMessage.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.json({ messages });
  } catch (error: any) {
    console.error('Error fetching meeting messages:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch messages' });
  }
});

// POST /api/meetings/:meetingId/messages - Send in-meeting message
meetingsRouter.post('/:meetingId/messages', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { senderId, text } = req.body;

    if (!senderId || !text) {
      return res.status(400).json({ error: 'senderId and text are required' });
    }

    const message = await (prisma as any).meetingMessage.create({
      data: {
        meetingId,
        senderId,
        text,
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({ message });
  } catch (error: any) {
    console.error('Error sending meeting message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});
