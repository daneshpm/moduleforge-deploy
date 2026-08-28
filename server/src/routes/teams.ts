import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { emailService } from '../services/emailService';
import { realtimeEventManager } from '../services/realtimeEvents';

export const teamsRouter = Router();

// Helper to check caller permission in a team
async function getCallerTeamRole(teamId: string, userId?: string): Promise<{ isOwner: boolean; isAdmin: boolean; isMember: boolean; role?: string } | null> {
  if (!userId) return null;

  const team = await (prisma as any).team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!team) return null;

  if (team.ownerId === userId) {
    return { isOwner: true, isAdmin: true, isMember: true, role: 'owner' };
  }

  const member = team.members[0];
  if (!member) return null;

  return {
    isOwner: member.role === 'owner',
    isAdmin: member.role === 'admin' || member.role === 'owner',
    isMember: true,
    role: member.role,
  };
}

// POST /api/teams - Create a new team
teamsRouter.post('/', async (req, res) => {
  try {
    const { name, description, avatarUrl, ownerId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (!ownerId) {
      return res.status(400).json({ error: 'Owner user ID is required' });
    }

    const owner = await (prisma as any).user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return res.status(404).json({ error: 'Owner user account not found' });
    }

    const team = await (prisma as any).team.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
        ownerId: owner.id,
        members: {
          create: {
            userId: owner.id,
            role: 'owner',
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Automatically create default #general channel for the team
    await (prisma as any).channel.create({
      data: {
        teamId: team.id,
        name: 'general',
        description: 'General team discussion and announcements',
        type: 'text',
        createdById: owner.id,
      },
    });

    res.status(201).json({ success: true, team });
  } catch (error: any) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: error.message || 'Failed to create team' });
  }
});

// GET /api/teams - List all teams current user belongs to or owns
teamsRouter.get('/', async (req, res) => {
  try {
    const userId = (req.query.userId || req.headers['x-user-id']) as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const teams = await (prisma as any).team.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
            invitations: {
              where: { status: 'pending' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Decorate with user's role in each team
    const formattedTeams = teams.map((team: any) => {
      const myMembership = team.members.find((m: any) => m.userId === userId);
      const userRole = team.ownerId === userId ? 'owner' : (myMembership?.role || 'member');
      return {
        ...team,
        userRole,
        memberCount: team._count.members,
        projectCount: team._count.projects,
        pendingInviteCount: team._count.invitations,
      };
    });

    res.json({ teams: formattedTeams });
  } catch (error: any) {
    console.error('Error listing teams:', error);
    res.status(500).json({ error: error.message || 'Failed to list teams' });
  }
});

// GET /api/teams/:teamId - Get team details, member roster, projects, pending invites
teamsRouter.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = (req.query.userId || req.headers['x-user-id']) as string | undefined;

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        projects: {
          include: {
            _count: { select: { modules: true, members: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
        invitations: {
          where: {
            status: 'pending',
            expiresAt: { gt: new Date() },
          },
          include: {
            inviter: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
            inviteeUser: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const callerMembership = userId ? team.members.find((m: any) => m.userId === userId) : null;
    const isOwner = team.ownerId === userId;
    const isAdmin = isOwner || callerMembership?.role === 'admin';
    const userRole = isOwner ? 'owner' : (callerMembership?.role || 'viewer');

    res.json({
      team,
      permissions: {
        isOwner,
        isAdmin,
        canManageMembers: isAdmin,
        canInvite: isAdmin,
        userRole,
      },
    });
  } catch (error: any) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch team' });
  }
});

// PATCH /api/teams/:teamId - Update team name/description
teamsRouter.patch('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, description, avatarUrl, userId } = req.body;

    const caller = await getCallerTeamRole(teamId, userId);
    if (!caller || !caller.isAdmin) {
      return res.status(403).json({ error: 'Only team owners or administrators can edit team settings' });
    }

    const updated = await (prisma as any).team.update({
      where: { id: teamId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
      },
    });

    res.json({ success: true, team: updated });
  } catch (error: any) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: error.message || 'Failed to update team' });
  }
});

// DELETE /api/teams/:teamId - Delete team (Owner only)
teamsRouter.delete('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = (req.query.userId || req.body?.userId || req.headers['x-user-id']) as string | undefined;

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the team owner can delete this team' });
    }

    await (prisma as any).team.delete({
      where: { id: teamId },
    });

    res.json({ success: true, message: 'Team successfully deleted' });
  } catch (error: any) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: error.message || 'Failed to delete team' });
  }
});

// DELETE /api/teams/:teamId/members/:memberUserId - Remove a team member
teamsRouter.delete('/:teamId/members/:memberUserId', async (req, res) => {
  try {
    const { teamId, memberUserId } = req.params;
    const callerId = (req.query.userId || req.headers['x-user-id']) as string | undefined;

    const caller = await getCallerTeamRole(teamId, callerId);
    if (!caller || !caller.isAdmin) {
      // Allow user to leave team on their own
      if (callerId !== memberUserId) {
        return res.status(403).json({ error: 'You do not have permission to remove this member' });
      }
    }

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId === memberUserId) {
      return res.status(400).json({ error: 'The team owner cannot be removed from the team' });
    }

    await (prisma as any).teamMember.deleteMany({
      where: { teamId, userId: memberUserId },
    });

    res.json({ success: true, message: 'Member removed from team' });
  } catch (error: any) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: error.message || 'Failed to remove member' });
  }
});

// PATCH /api/teams/:teamId/members/:memberUserId/role - Change a member's role
teamsRouter.patch('/:teamId/members/:memberUserId/role', async (req, res) => {
  try {
    const { teamId, memberUserId } = req.params;
    const { role, callerUserId } = req.body;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "admin" or "member"' });
    }

    const caller = await getCallerTeamRole(teamId, callerUserId);
    if (!caller || !caller.isOwner) {
      return res.status(403).json({ error: 'Only the team owner can change member roles' });
    }

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId === memberUserId) {
      return res.status(400).json({ error: 'Cannot change the role of the team owner' });
    }

    const updated = await (prisma as any).teamMember.updateMany({
      where: { teamId, userId: memberUserId },
      data: { role },
    });

    res.json({ success: true, updated });
  } catch (error: any) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: error.message || 'Failed to update member role' });
  }
});

// POST /api/teams/:teamId/invitations/username - Option A: Invite by @username
teamsRouter.post('/:teamId/invitations/username', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { username, role = 'member', inviterId } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!inviterId) {
      return res.status(400).json({ error: 'Inviter ID is required' });
    }

    const caller = await getCallerTeamRole(teamId, inviterId);
    if (!caller) {
      return res.status(403).json({ error: 'You must be a member of this team to invite users' });
    }

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
      include: { owner: true },
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const inviter = await (prisma as any).user.findUnique({
      where: { id: inviterId },
    });

    if (!inviter) return res.status(404).json({ error: 'Inviter not found' });

    const cleanUsername = username.trim().replace(/^@/, '');

    // Find invitee by username
    const invitee = await (prisma as any).user.findUnique({
      where: { username: cleanUsername },
    });

    if (!invitee) {
      return res.status(404).json({ error: `User with username @${cleanUsername} was not found` });
    }

    if (invitee.id === inviterId) {
      return res.status(400).json({ error: 'You cannot invite yourself to the team' });
    }

    // Check if already a member
    const isAlreadyMember = await (prisma as any).teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: invitee.id,
        },
      },
    });

    if (isAlreadyMember) {
      return res.status(400).json({ error: `@${cleanUsername} is already a member of this team` });
    }

    // Check for existing pending invitation
    const existingPending = await (prisma as any).teamInvitation.findFirst({
      where: {
        teamId,
        inviteeUserId: invitee.id,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      return res.status(400).json({ error: `An invitation is already pending for @${cleanUsername}` });
    }

    // Generate secure token & 7-day expiration
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await (prisma as any).teamInvitation.create({
      data: {
        teamId,
        inviterId,
        inviteeUserId: invitee.id,
        role: ['admin', 'member'].includes(role) ? role : 'member',
        token,
        status: 'pending',
        expiresAt,
      },
      include: {
        team: true,
        inviter: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        inviteeUser: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // Create in-app notification for the recipient
    const inviterDisplay = inviter.name || `@${inviter.username || 'user'}`;
    const notification = await (prisma as any).notification.create({
      data: {
        userId: invitee.id,
        type: 'team_invitation',
        title: 'Team Invitation',
        message: `${inviterDisplay} (@${inviter.username || 'user'}) invited you to join ${team.name}`,
        relatedTeamId: team.id,
        relatedInvitationId: invitation.id,
        read: false,
      },
      include: {
        relatedTeam: {
          select: { id: true, name: true, avatarUrl: true },
        },
        relatedInvitation: true,
      },
    });

    // Broadcast real-time notification
    realtimeEventManager.broadcastToUser(invitee.id, {
      type: 'NOTIFICATION_RECEIVED',
      notification,
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to @${cleanUsername}`,
      invitation,
    });
  } catch (error: any) {
    console.error('Error inviting by username:', error);
    res.status(500).json({ error: error.message || 'Failed to send invitation' });
  }
});

// POST /api/teams/:teamId/invitations/email - Option B: Invite by Email
teamsRouter.post('/:teamId/invitations/email', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { email, role = 'member', inviterId } = req.body;

    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!inviterId) {
      return res.status(400).json({ error: 'Inviter ID is required' });
    }

    const caller = await getCallerTeamRole(teamId, inviterId);
    if (!caller) {
      return res.status(403).json({ error: 'You must be a member of this team to invite users' });
    }

    const team = await (prisma as any).team.findUnique({
      where: { id: teamId },
    });

    if (!team) return res.status(404).json({ error: 'Team not found' });

    const inviter = await (prisma as any).user.findUnique({
      where: { id: inviterId },
    });

    if (!inviter) return res.status(404).json({ error: 'Inviter not found' });

    const cleanEmail = email.toLowerCase().trim();

    if (inviter.email.toLowerCase() === cleanEmail) {
      return res.status(400).json({ error: 'You cannot invite your own email address' });
    }

    // Check if user with this email is already a member
    const existingUser = await (prisma as any).user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      const isAlreadyMember = await (prisma as any).teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: existingUser.id,
          },
        },
      });

      if (isAlreadyMember) {
        return res.status(400).json({ error: `This user (${cleanEmail}) is already a member of this team` });
      }
    }

    // Check for existing pending invitation for this email
    const existingPending = await (prisma as any).teamInvitation.findFirst({
      where: {
        teamId,
        inviteeEmail: cleanEmail,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      return res.status(400).json({ error: `An invitation is already pending for ${cleanEmail}` });
    }

    // Generate secure token & 7-day expiration
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await (prisma as any).teamInvitation.create({
      data: {
        teamId,
        inviterId,
        inviteeUserId: existingUser ? existingUser.id : null,
        inviteeEmail: cleanEmail,
        role: ['admin', 'member'].includes(role) ? role : 'member',
        token,
        status: 'pending',
        expiresAt,
      },
      include: {
        team: true,
        inviter: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // If recipient user exists in DB, create in-app notification as well
    if (existingUser) {
      const inviterDisplay = inviter.name || `@${inviter.username || 'user'}`;
      const notification = await (prisma as any).notification.create({
        data: {
          userId: existingUser.id,
          type: 'team_invitation',
          title: 'Team Invitation',
          message: `${inviterDisplay} invited you to join ${team.name}`,
          relatedTeamId: team.id,
          relatedInvitationId: invitation.id,
          read: false,
        },
      });

      realtimeEventManager.broadcastToUser(existingUser.id, {
        type: 'NOTIFICATION_RECEIVED',
        notification,
      });
    }

    // Deliver email invitation
    const emailResult = await emailService.sendTeamInvitation({
      to: cleanEmail,
      teamName: team.name,
      inviterName: inviter.name || 'Team Owner',
      inviterUsername: inviter.username || undefined,
      role: invitation.role,
      inviteToken: token,
      appUrl: req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : undefined),
    });

    res.status(201).json({
      success: true,
      message: `Invitation email sent to ${cleanEmail}`,
      invitation,
      emailResult,
    });
  } catch (error: any) {
    console.error('Error inviting by email:', error);
    res.status(500).json({ error: error.message || 'Failed to send email invitation' });
  }
});

// DELETE /api/teams/:teamId/invitations/:invitationId - Revoke/Cancel an invitation
teamsRouter.delete('/:teamId/invitations/:invitationId', async (req, res) => {
  try {
    const { teamId, invitationId } = req.params;
    const callerId = (req.query.userId || req.headers['x-user-id']) as string | undefined;

    const caller = await getCallerTeamRole(teamId, callerId);
    if (!caller) {
      return res.status(403).json({ error: 'You must be a member of this team to manage invitations' });
    }

    await (prisma as any).teamInvitation.delete({
      where: { id: invitationId },
    });

    // Delete any associated pending notification
    await (prisma as any).notification.deleteMany({
      where: { relatedInvitationId: invitationId },
    });

    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (error: any) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel invitation' });
  }
});
