import { Router } from 'express';
import { prisma } from '../prisma';

export const authRouter = Router();

// Helper to generate a clean username from name/email
function generateSuggestedUsername(email: string, name?: string): string {
  const base = (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')) || 'user';
  return base.slice(0, 15);
}

// POST /api/auth/sync - Sync Google / external session with ModuleForge DB
authRouter.post('/sync', async (req, res) => {
  const { email, name, avatarUrl, googleId, isDev } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Check if user already exists by email or googleId
    let user = await (prisma as any).user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          googleId ? { googleId } : undefined,
        ].filter(Boolean),
      },
    });

    if (user) {
      // Update existing user's latest details
      user = await (prisma as any).user.update({
        where: { id: user.id },
        data: {
          googleId: googleId || user.googleId,
          name: name || user.name,
          avatarUrl: avatarUrl || user.avatarUrl,
          lastLogin: new Date(),
        },
      });
    } else {
      // Generate an initial username candidate
      let candidateUsername = generateSuggestedUsername(cleanEmail, name);
      try {
        const existingUserWithUsername = await (prisma as any).user.findUnique({
          where: { username: candidateUsername },
        });

        if (existingUserWithUsername) {
          candidateUsername = `${candidateUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
        }
      } catch (_) {
        // Non-critical check
      }

      user = await (prisma as any).user.create({
        data: {
          email: cleanEmail,
          googleId: googleId || null,
          name: name || cleanEmail.split('@')[0],
          username: candidateUsername,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
          isDev: Boolean(isDev),
          lastLogin: new Date(),
        },
      });
    }

    const needsUsernameSetup = !user.username;

    res.json({
      success: true,
      user,
      needsUsernameSetup,
    });
  } catch (error: any) {
    console.error('Error syncing auth user in DB (using fallback):', error);
    // Graceful fallback: return user object so the client is never locked out
    const fallbackUser = {
      id: googleId || `user-${Date.now()}`,
      email: cleanEmail,
      name: name || cleanEmail.split('@')[0],
      username: generateSuggestedUsername(cleanEmail, name),
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail)}`,
      isDev: Boolean(isDev),
      lastLogin: new Date(),
    };

    res.json({
      success: true,
      user: fallbackUser,
      needsUsernameSetup: false,
      isFallback: true,
    });
  }
});

// POST /api/auth/google-dev - Quick development Google Sign-In Simulation
authRouter.post('/google-dev', async (req, res) => {
  const { email = 'shalya@example.com', name = 'Shalya Gaonkar', avatarUrl } = req.body;
  const cleanEmail = email.toLowerCase().trim();
  const simulatedGoogleId = `google-dev-${cleanEmail.replace(/[^a-z0-9]/g, '')}`;

  try {
    let user = await (prisma as any).user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      const baseUser = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '');
      user = await (prisma as any).user.create({
        data: {
          email: cleanEmail,
          googleId: simulatedGoogleId,
          name,
          username: baseUser,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          isDev: true,
          lastLogin: new Date(),
        },
      });
    } else {
      user = await (prisma as any).user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          googleId: simulatedGoogleId,
        },
      });
    }

    res.json({
      success: true,
      user,
      needsUsernameSetup: !user.username,
    });
  } catch (error: any) {
    console.error('Error in google-dev sign in (using fallback):', error);
    const fallbackUser = {
      id: `dev-${Date.now()}`,
      email: cleanEmail,
      googleId: simulatedGoogleId,
      name,
      username: cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, ''),
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      isDev: true,
      lastLogin: new Date(),
    };

    res.json({
      success: true,
      user: fallbackUser,
      needsUsernameSetup: false,
      isFallback: true,
    });
  }
});
