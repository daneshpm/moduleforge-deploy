import { Router } from 'express';
import { prisma } from '../prisma';
import { createLiveKitToken } from '../services/livekit';
import { emailService } from '../services/emailService';
import { realtimeEventManager } from '../services/realtimeEvents';

export const meetingsRouter = Router();

// Helper to check user access in team or project
async function verifyAccess(userId: string, teamId?: string | null, projectId?: string | null): Promise<boolean> {
  if (!userId) return false;

  // If teamId is specified, check if user is the owner or a member
  if (teamId) {
    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!team) return false;
    if (team.ownerId === userId) return true;
    if (team.members && team.members.length > 0) return true;
    return false;
  }

  // If projectId is specified
  if (projectId) {
    const project = await (prisma as any).project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!project) return false;
    if (project.userId === userId) return true;
    if (project.members && project.members.length > 0) return true;
    return false;
  }

  return true;
}

// POST /api/meetings - Create and start a meeting
meetingsRouter.post('/', async (req, res) => {
  try {
    const { title, teamId, projectId, channelId, createdById, meetingId: customMeetingId, invitedMembers, appUrl: clientAppUrl } = req.body;

    if (!title || !createdById) {
      return res.status(400).json({ error: 'title and createdById are required' });
    }

    const hasAccess = await verifyAccess(createdById, teamId, projectId);
    if (!hasAccess) {
      console.warn(`[Meetings] User ${createdById} starting meeting without explicit team/project role, proceeding with graceful access.`);
    }

    const roomId = customMeetingId || `room-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Fetch or auto-upsert creator details
    let creator = await (prisma as any).user.findUnique({
      where: { id: createdById },
      select: { id: true, name: true, username: true, email: true, avatarUrl: true },
    });

    if (!creator) {
      const creatorEmail = req.body.creatorEmail || req.body.creator?.email;
      if (creatorEmail) {
        creator = await (prisma as any).user.findUnique({
          where: { email: creatorEmail },
          select: { id: true, name: true, username: true, email: true, avatarUrl: true },
        });
      }
    }

    if (!creator) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      creator = await (prisma as any).user.create({
        data: {
          id: createdById,
          name: req.body.creatorName || req.body.creator?.name || 'Host',
          username: req.body.creatorUsername || req.body.creator?.username || `user_${createdById.substring(0, 6)}_${uniqueSuffix}`,
          email: req.body.creatorEmail || req.body.creator?.email || `user_${createdById.substring(0, 6)}_${uniqueSuffix}@gmail.com`,
          avatarUrl: req.body.creatorAvatar || req.body.creator?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${createdById}`,
        },
        select: { id: true, name: true, username: true, email: true, avatarUrl: true },
      });
    }

    const creatorName = creator.name || creator.username || 'Host';

    // Fetch team details if teamId is provided
    let teamName = 'Development Team';
    let teamMembers: any[] = [];

    if (teamId) {
      const team = await (prisma as any).team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, username: true, email: true, avatarUrl: true },
              },
            },
          },
          owner: {
            select: { id: true, name: true, username: true, email: true, avatarUrl: true },
          },
        },
      });

      if (team) {
        teamName = team.name;
        teamMembers = team.members.map((m: any) => m.user).filter(Boolean);
        if (team.owner && !teamMembers.some((m) => m.id === team.owner.id)) {
          teamMembers.push(team.owner);
        }
      }
    }

    // Ensure invited members exist in SQLite User table
    if (invitedMembers && Array.isArray(invitedMembers)) {
      for (const m of invitedMembers) {
        if (m.userId) {
          const existing = await (prisma as any).user.findUnique({ where: { id: m.userId } });
          if (!existing) {
            try {
              const uniqueSuffix = Math.random().toString(36).substring(2, 6);
              await (prisma as any).user.create({
                data: {
                  id: m.userId,
                  name: m.name || m.displayName || 'Member',
                  username: m.username || `user_${m.userId.substring(0, 6)}_${uniqueSuffix}`,
                  email: m.email || `user_${m.userId.substring(0, 6)}_${uniqueSuffix}@gmail.com`,
                  avatarUrl: m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.userId}`,
                },
              });
            } catch (_) {}
          }
        }
      }
    }

    // Build participants records by querying only validated User records in DB
    const candidateUserIds = new Set<string>([creator.id, createdById]);
    if (invitedMembers && Array.isArray(invitedMembers)) {
      invitedMembers.forEach((m: any) => {
        if (m.userId) candidateUserIds.add(m.userId);
      });
    }

    const validUsers = await (prisma as any).user.findMany({
      where: { id: { in: Array.from(candidateUserIds) } },
      select: { id: true },
    });
    const validUserIds = new Set<string>(validUsers.map((u: any) => u.id));
    validUserIds.add(creator.id);

    const participantsCreateData = Array.from(validUserIds).map((userId) => ({
      userId,
      role: userId === creator.id ? 'host' : 'participant',
    }));

    const meeting = await (prisma as any).meeting.create({
      data: {
        title,
        roomId,
        teamId: teamId || null,
        projectId: projectId || null,
        channelId: channelId || null,
        createdById: creator.id,
        status: 'ACTIVE',
        participants: {
          create: participantsCreateData,
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true },
        },
        team: { select: { id: true, name: true } },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const hostOrigin = (
      clientAppUrl ||
      req.headers.origin ||
      req.headers.referer ||
      process.env.APP_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://moduleforge-deploy-pearl.vercel.app' : 'http://localhost:5173')
    )
      .toString()
      .replace(/\/+$/, '');
    const meetingUrl = `${hostOrigin}/meet/${roomId}`;

    // Collect all invited / team members to notify (excluding the host)
    const notifyUserMap = new Map<string, { id: string; email?: string; name?: string }>();
    teamMembers.forEach((m: any) => {
      if (m.id && m.id !== createdById) {
        notifyUserMap.set(m.id, { id: m.id, email: m.email, name: m.name || m.username });
      }
    });
    if (invitedMembers && Array.isArray(invitedMembers)) {
      invitedMembers.forEach((m: any) => {
        if (m.userId && m.userId !== createdById) {
          notifyUserMap.set(m.userId, { id: m.userId, email: m.email, name: m.name || m.displayName || m.username });
        }
      });
    }

    // Send in-app notifications and email invitations
    for (const member of notifyUserMap.values()) {
      // 1. Create In-App Notification with explicit relatedMeetingId
      try {
        const notif = await (prisma as any).notification.create({
          data: {
            userId: member.id,
            type: 'team_meeting',
            title: `🎥 ${title}`,
            message: `${creatorName} started a team meeting in ${teamName}.`,
            relatedTeamId: teamId || null,
            relatedMeetingId: meeting.id,
          },
        });

        // Realtime SSE broadcast to active client tabs
        realtimeEventManager.broadcastToUser(member.id, {
          type: 'NOTIFICATION_RECEIVED',
          notification: notif,
        });
      } catch (notifErr) {
        console.warn('Failed to create in-app meeting notification:', notifErr);
      }

      // 2. Send Email Invitation (if user has an email)
      if (member.email) {
        emailService.sendMeetingInvitation({
          to: member.email,
          meetingTitle: title,
          teamName,
          hostName: creatorName,
          meetingUrl,
        }).catch((err) => {
          console.warn(`Email invitation to ${member.email} failed:`, err);
        });
      }
    }

    let token = '';
    let serverUrl = '';
    let iceServers: any[] = [];

    try {
      const tokenData = await createLiveKitToken({
        roomName: roomId,
        participantIdentity: createdById,
        participantName: creatorName,
        metadata: { meetingId: meeting.id, role: 'host' },
      });
      token = tokenData.token;
      serverUrl = tokenData.serverUrl;
      iceServers = tokenData.iceServers;
    } catch (_) {}

    res.status(201).json({
      meeting,
      meetingUrl,
      token,
      serverUrl,
      iceServers,
    });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: error.message || 'Failed to create meeting' });
  }
});

// GET /api/meetings/team/:teamId - Get meetings history for a team
meetingsRouter.get('/team/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    const meetings = await (prisma as any).meeting.findMany({
      where: { teamId },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true },
        },
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ meetings });
  } catch (error: any) {
    console.error('Error fetching team meetings:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch team meetings' });
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
