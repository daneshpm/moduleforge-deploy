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
  try {
    const { email, name, avatarUrl, googleId, isDev } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

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
      const existingUserWithUsername = await (prisma as any).user.findUnique({
        where: { username: candidateUsername },
      });

      if (existingUserWithUsername) {
        candidateUsername = `${candidateUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
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
    console.error('Error syncing auth user:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user session' });
  }
});

// POST /api/auth/google-dev - Quick development Google Sign-In Simulation
authRouter.post('/google-dev', async (req, res) => {
  try {
    const { email = 'shalya@example.com', name = 'Shalya Gaonkar', avatarUrl } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    const simulatedGoogleId = `google-dev-${cleanEmail.replace(/[^a-z0-9]/g, '')}`;

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
    console.error('Error in google-dev sign in:', error);
    res.status(500).json({ error: error.message || 'Failed to sign in with dev Google account' });
  }
});
