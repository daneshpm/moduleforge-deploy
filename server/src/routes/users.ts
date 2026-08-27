import { Router } from 'express';
import { prisma } from '../prisma';

export const usersRouter = Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// GET /api/users/search - Search ModuleForge users by @username or name
usersRouter.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim().replace(/^@/, '');
    const currentUserId = req.query.currentUserId as string | undefined;

    if (!query || query.length < 1) {
      return res.json({ users: [] });
    }

    // Search users matching username or name, returning sanitized public profile ONLY (NO EMAILS)
    const users = await (prisma as any).user.findMany({
      where: {
        AND: [
          currentUserId ? { id: { not: currentUserId } } : {},
          {
            OR: [
              { username: { contains: query } },
              { name: { contains: query } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
      },
      take: 10,
    });

    res.json({ users });
  } catch (error: any) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message || 'Failed to search users' });
  }
});

// GET /api/users/check-username - Check if a username is valid and available
usersRouter.get('/check-username', async (req, res) => {
  try {
    const rawUsername = String(req.query.username || '').trim().replace(/^@/, '');
    const currentUserId = req.query.userId as string | undefined;

    if (!rawUsername) {
      return res.json({ available: false, error: 'Username cannot be empty' });
    }

    if (!USERNAME_REGEX.test(rawUsername)) {
      return res.json({
        available: false,
        error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores (_)',
      });
    }

    const existing = await (prisma as any).user.findUnique({
      where: { username: rawUsername },
    });

    if (existing && existing.id !== currentUserId) {
      return res.json({ available: false, error: 'This username is already taken' });
    }

    res.json({ available: true, username: rawUsername });
  } catch (error: any) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: error.message || 'Failed to check username' });
  }
});

// PATCH /api/users/profile - Update user profile & @username
usersRouter.patch('/profile', async (req, res) => {
  try {
    const { userId, name, username, avatarUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl.trim();

    if (username !== undefined) {
      const cleanUsername = username.trim().replace(/^@/, '');
      if (!USERNAME_REGEX.test(cleanUsername)) {
        return res.status(400).json({
          error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores (_)',
        });
      }

      const existingUserWithUsername = await (prisma as any).user.findUnique({
        where: { username: cleanUsername },
      });

      if (existingUserWithUsername && existingUserWithUsername.id !== userId) {
        return res.status(409).json({ error: 'Username is already taken by another user' });
      }

      updateData.username = cleanUsername;
    }

    const updated = await (prisma as any).user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      success: true,
      user: updated,
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to update user profile' });
  }
});

// GET /api/users/:id - Get user public profile
usersRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await (prisma as any).user.findFirst({
      where: {
        OR: [{ id }, { username: id.replace(/^@/, '') }],
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
});
