import { Router } from 'express';
import { prisma } from '../prisma';
import { isEnforced, verifyRequestToken, hasUnverifiedEmail, canRelinkByEmail, TokenClaims } from '../middleware/auth';

export const authRouter = Router();

// Helper to generate a clean username from name/email
function generateSuggestedUsername(email: string, name?: string): string {
  const base = (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')) || 'user';
  return base.slice(0, 15);
}

// POST /api/auth/sync - Sync Google / external session with ModuleForge DB
authRouter.post('/sync', async (req, res) => {
  let { email, name, avatarUrl, googleId, isDev } = req.body || {};

  // Identity must come from a verified Firebase ID token. When ENFORCE_AUTH is off we
  // still prefer a valid token if one is sent, otherwise fall back to the legacy body.
  let claims: TokenClaims | null = null;
  try {
    claims = await verifyRequestToken(req);
  } catch (e: any) {
    if (isEnforced()) return res.status(401).json({ error: 'Invalid or expired token' });
    console.warn(`[auth] /sync: invalid token ignored (ENFORCE_AUTH off): ${e?.message}`);
  }
  if (!claims && isEnforced()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (claims) {
    if (!claims.email) return res.status(400).json({ error: 'Token has no email' });
    if (hasUnverifiedEmail(claims)) {
      return res.status(403).json({ error: 'Email address is not verified. Verify your email and sign in again.', code: 'EMAIL_NOT_VERIFIED' });
    }
    email = claims.email;
    googleId = claims.uid;
    name = name || claims.name;
    avatarUrl = avatarUrl || claims.picture;
  } else {
    console.warn('[auth] /sync trusting request body identity (ENFORCE_AUTH off)');
  }
  // Never let a client self-declare dev accounts in production.
  if (process.env.NODE_ENV !== 'development') isDev = false;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // Resolve by googleId first; fall back to email (claims are verified above). Never take over a
    // row that is already bound to a different googleId.
    let user = googleId ? await (prisma as any).user.findUnique({ where: { googleId } }) : null;
    if (!user) {
      user = await (prisma as any).user.findUnique({ where: { email: cleanEmail } });
      if (user && user.googleId && googleId && user.googleId !== googleId) {
        // Firebase project migration: verified email + token from a configured project id => relink to the new uid.
        if (claims && canRelinkByEmail(claims)) {
          console.warn(`[auth] /sync relinking user ${user.id} to new uid (verified email, project ${claims.projectId})`);
          user = await (prisma as any).user.update({ where: { id: user.id }, data: { googleId } });
        } else return res.status(409).json({ error: 'This email is already linked to a different account.' });
      }
    }

    if (user) {
      // Update existing user's latest details
      user = await (prisma as any).user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleId || null,
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
    console.error('Error syncing auth user in DB:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// POST /api/auth/google-dev - Quick development Google Sign-In Simulation
authRouter.post('/google-dev', async (req, res) => {
  // Development-only: lets anyone sign in as any email, so it must never exist in production.
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const { email = 'shalya@example.com', name = 'Shalya Gaonkar', avatarUrl } = req.body || {};
  const cleanEmail = String(email).toLowerCase().trim();
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
    console.error('Error in google-dev sign in:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});
