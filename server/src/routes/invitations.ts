import { Router } from 'express';
import { prisma } from '../prisma';
import { realtimeEventManager } from '../services/realtimeEvents';

export const invitationsRouter = Router();

// GET /api/invitations/:token - Validate token and get invitation preview
invitationsRouter.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    const invitation = await (prisma as any).teamInvitation.findUnique({
      where: { token },
      include: {
        team: {
          include: {
            owner: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
            _count: { select: { members: true, projects: true } },
          },
        },
        inviter: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        inviteeUser: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        valid: false,
        error: 'Invalid or unknown invitation link.',
      });
    }

    const isExpired = new Date(invitation.expiresAt) < new Date();
    const isPending = invitation.status === 'pending' && !isExpired;

    res.json({
      valid: isPending,
      status: isExpired ? 'expired' : invitation.status,
      isExpired,
      isPending,
      invitation: {
        id: invitation.id,
        teamId: invitation.teamId,
        teamName: invitation.team.name,
        teamDescription: invitation.team.description,
        teamAvatarUrl: invitation.team.avatarUrl,
        memberCount: invitation.team._count.members,
        projectCount: invitation.team._count.projects,
        inviterName: invitation.inviter.name || 'Team Member',
        inviterUsername: invitation.inviter.username,
        inviterAvatarUrl: invitation.inviter.avatarUrl,
        inviteeEmail: invitation.inviteeEmail,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error validating invitation token:', error);
    res.status(500).json({ valid: false, error: error.message || 'Failed to validate invitation' });
  }
});

// POST /api/invitations/:token/accept - Accept invitation & join team
invitationsRouter.post('/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'You must be signed in to accept this invitation' });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const invitation = await (prisma as any).teamInvitation.findUnique({
      where: { token },
      include: {
        team: true,
        inviter: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({ error: 'This invitation has already been accepted', teamId: invitation.teamId });
    }

    if (new Date(invitation.expiresAt) < new Date() || invitation.status === 'expired') {
      return res.status(400).json({ error: 'This invitation has expired. Please ask the team administrator for a new invite.' });
    }

    // Check email restriction if specific email was invited
    if (invitation.inviteeEmail && user.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
      return res.status(403).json({
        error: `This invitation was sent specifically to ${invitation.inviteeEmail}. You are currently signed in as ${user.email}.`,
      });
    }

    // Add user as team member (upsert to avoid duplicates)
    await (prisma as any).teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: invitation.teamId,
          userId: user.id,
        },
      },
      update: {
        role: invitation.role || 'member',
      },
      create: {
        teamId: invitation.teamId,
        userId: user.id,
        role: invitation.role || 'member',
      },
    });

    // Mark invitation as accepted
    await (prisma as any).teamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        inviteeUserId: user.id,
      },
    });

    // Mark related notifications for this user as read
    await (prisma as any).notification.updateMany({
      where: {
        userId: user.id,
        relatedInvitationId: invitation.id,
      },
      data: {
        read: true,
      },
    });

    // Notify team inviter/owner that user joined
    const notif = await (prisma as any).notification.create({
      data: {
        userId: invitation.inviterId,
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        message: `${user.name || `@${user.username}`} joined ${invitation.team.name}`,
        relatedTeamId: invitation.teamId,
        relatedInvitationId: invitation.id,
        read: false,
      },
    });

    realtimeEventManager.broadcastToUser(invitation.inviterId, {
      type: 'NOTIFICATION_RECEIVED',
      notification: notif,
    });

    res.json({
      success: true,
      message: `Successfully joined ${invitation.team.name}`,
      teamId: invitation.teamId,
      teamName: invitation.team.name,
    });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: error.message || 'Failed to accept invitation' });
  }
});

// POST /api/invitations/:token/decline - Decline invitation
invitationsRouter.post('/:token/decline', async (req, res) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    const invitation = await (prisma as any).teamInvitation.findUnique({
      where: { token },
      include: { team: true },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    await (prisma as any).teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'declined' },
    });

    if (userId) {
      await (prisma as any).notification.updateMany({
        where: {
          userId,
          relatedInvitationId: invitation.id,
        },
        data: { read: true },
      });
    }

    res.json({
      success: true,
      message: `Invitation to join ${invitation.team.name} was declined`,
    });
  } catch (error: any) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ error: error.message || 'Failed to decline invitation' });
  }
});
