import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { getUserId, isEnforced } from './auth';

export interface ProjectAccess {
  exists: boolean;
  isOwner: boolean;
  isMember: boolean;
}

/** Owner = project creator (or team owner for team projects). Member = owner, accepted project member, or team member. */
export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
  const project = await (prisma as any).project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      teamId: true,
      members: { where: { userId, status: 'accepted' }, select: { role: true } },
    },
  });
  if (!project) return { exists: false, isOwner: false, isMember: false };

  let isOwner = project.userId === userId || project.members.some((m: any) => m.role === 'owner');
  let isMember = isOwner || project.members.length > 0;

  if (project.teamId) {
    const team = await (prisma as any).team.findUnique({
      where: { id: project.teamId },
      select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
    });
    if (team) {
      if (team.ownerId === userId) {
        isOwner = true;
        isMember = true;
      } else if (team.members.length > 0) {
        isMember = true;
        if (team.members[0].role === 'admin') isOwner = isOwner || false;
      }
    }
  }
  return { exists: true, isOwner, isMember };
}

async function guard(req: Request, res: Response, next: NextFunction, projectId: string, ownerOnly: boolean) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      if (isEnforced()) return res.status(401).json({ error: 'Authentication required' });
      return next(); // legacy mode, anonymous: behaves as before
    }
    const access = await getProjectAccess(userId, projectId);
    if (!access.exists) return res.status(404).json({ error: 'Project not found' });
    if (ownerOnly ? !access.isOwner : !access.isMember) {
      // 404 rather than 403 so non-members cannot probe project ids
      return res.status(ownerOnly ? 403 : 404).json({ error: ownerOnly ? 'Only the project owner can do this' : 'Project not found' });
    }
    next();
  } catch (e) {
    console.error('[access] project guard error:', e);
    res.status(500).json({ error: 'Failed to verify project access' });
  }
}

/** router.param handler: any route with a project id param requires membership. */
export function projectMemberParam(req: Request, res: Response, next: NextFunction, id: string) {
  // A prospective member may poll their own join-request status
  if (req.method === 'GET' && /\/members\/status\/?$/.test(req.path)) return next();
  return guard(req, res, next, id, false);
}

/** Route middleware (params :id or :projectId) requiring project ownership. */
export function projectOwnerOnly(req: Request, res: Response, next: NextFunction) {
  const id = req.params.id || req.params.projectId;
  return guard(req, res, next, id, true);
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const team = await (prisma as any).team.findUnique({
    where: { id: teamId },
    select: { ownerId: true, members: { where: { userId }, select: { id: true } } },
  });
  return !!team && (team.ownerId === userId || team.members.length > 0);
}

/** True when the user belongs to the given team and/or project scope. */
export async function canAccessScope(userId: string, teamId?: string | null, projectId?: string | null): Promise<boolean> {
  if (!teamId && !projectId) return false;
  if (teamId && !(await isTeamMember(userId, teamId))) return false;
  if (projectId && !(await getProjectAccess(userId, projectId)).isMember) return false;
  return true;
}

export async function canAccessChannel(userId: string, channelId: string): Promise<boolean> {
  const ch = await (prisma as any).channel.findUnique({ where: { id: channelId }, select: { teamId: true, projectId: true } });
  if (!ch) return false;
  return canAccessScope(userId, ch.teamId, ch.projectId);
}
