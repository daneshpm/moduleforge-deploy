import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../prisma';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Verified token claims (set when a valid Firebase ID token was presented). */
      tokenClaims?: TokenClaims;
    }
  }
}

export interface TokenClaims {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Evaluated lazily so tests / runtime env changes are respected. */
export function isEnforced(): boolean {
  return process.env.ENFORCE_AUTH === 'true';
}

export type TokenVerifier = (token: string) => Promise<TokenClaims>;

async function firebaseVerifier(token: string): Promise<TokenClaims> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured');
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (!payload.sub) throw new Error('Token has no subject');
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

let verifier: TokenVerifier = firebaseVerifier;
/** Test hook: replace the token verifier. */
export function setTokenVerifier(v: TokenVerifier | null) {
  verifier = v || firebaseVerifier;
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') {
    // EventSource cannot set headers: allow ?access_token= on SSE endpoints only.
    const q = req.query?.access_token;
    if (req.method === 'GET' && typeof q === 'string' && /\/(stream|events)\/?$/.test(req.path)) return q;
    return null;
  }
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/** Verify the bearer token. Returns null if none present; throws if invalid. */
export async function verifyRequestToken(req: Request): Promise<TokenClaims | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  return verifier(token);
}

function legacyUserId(req: Request): string | undefined {
  const raw =
    (req.headers['x-user-id'] as string | undefined) ||
    (req.query?.userId as string | undefined) ||
    (req.body && typeof req.body === 'object'
      ? ((req.body.userId || req.body.ownerId || req.body.inviterId || req.body.callerId || req.body.callerUserId) as string | undefined)
      : undefined);
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

async function findUserForClaims(c: TokenClaims) {
  const or: any[] = [{ googleId: c.uid }];
  if (c.email) or.push({ email: c.email.toLowerCase().trim() });
  return (prisma as any).user.findFirst({ where: { OR: or }, select: { id: true, email: true } });
}

/**
 * Authentication middleware.
 *  - ENFORCE_AUTH=true: a valid Firebase ID token is required (401 otherwise).
 *  - otherwise: a valid token is used if present; else falls back to the legacy
 *    x-user-id / userId identity and logs a warning.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const enforced = isEnforced();
    let claims: TokenClaims | null = null;
    try {
      claims = await verifyRequestToken(req);
    } catch (e: any) {
      if (enforced) return res.status(401).json({ error: 'Invalid or expired token' });
      console.warn(`[auth] invalid token ignored (ENFORCE_AUTH off): ${e?.message}`);
    }

    if (claims) {
      const user = await findUserForClaims(claims);
      if (user) {
        req.user = { id: user.id, email: user.email };
        req.tokenClaims = claims;
        return next();
      }
      if (enforced) return res.status(401).json({ error: 'No account for this token. Call /api/auth/sync first.' });
    } else if (enforced) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const legacy = legacyUserId(req);
    if (legacy) {
      console.warn(`[auth] LEGACY unauthenticated identity used for ${req.method} ${req.path} (set ENFORCE_AUTH=true)`);
      req.user = { id: legacy, email: '' };
    }
    return next();
  } catch (err: any) {
    console.error('[auth] middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Like authenticate but never rejects; used for public routes that may
 * optionally know the caller. Only sets req.user from a valid token.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const claims = await verifyRequestToken(req).catch(() => null);
    if (claims) {
      const user = await findUserForClaims(claims);
      if (user) req.user = { id: user.id, email: user.email };
    } else if (!isEnforced()) {
      const legacy = legacyUserId(req);
      if (legacy) req.user = { id: legacy, email: '' };
    }
  } catch (_) {
    /* ignore */
  }
  next();
}

/** Public for GET (marketplace reads); full authentication for any other method. */
export function authenticateUnlessGet(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return optionalAuth(req, res, next);
  return authenticate(req, res, next);
}

/** The authenticated caller's id (or undefined). Single source of identity for routes. */
export function getUserId(req: Request): string | undefined {
  return req.user?.id;
}

/** Same as getUserId but responds 401 and returns null when missing. */
export function requireUserId(req: Request, res: Response): string | null {
  const id = getUserId(req);
  if (!id) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return id;
}

export function logAuthStartupWarnings() {
  if (process.env.NODE_ENV === 'production' && !isEnforced()) {
    console.warn('!!!!!! SECURITY WARNING: ENFORCE_AUTH is not "true" in production. The API trusts client-supplied user ids (x-user-id / userId). Set ENFORCE_AUTH=true and FIREBASE_PROJECT_ID. !!!!!!');
  }
  if (isEnforced() && !process.env.FIREBASE_PROJECT_ID) {
    console.error('!!!!!! ENFORCE_AUTH=true but FIREBASE_PROJECT_ID is not set: every request will be rejected. !!!!!!');
  }
}
