import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, decodeJwt, errors as joseErrors } from 'jose';
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
  /** Firebase project id the token was issued for (its `aud`); set by the real verifier. */
  projectId?: string;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Evaluated lazily so tests / runtime env changes are respected. */
export function isEnforced(): boolean {
  const v = process.env.ENFORCE_AUTH;
  // Fail closed: in production auth is enforced unless explicitly disabled with ENFORCE_AUTH=false.
  if (process.env.NODE_ENV === 'production') return v !== 'false';
  return v === 'true';
}

export type TokenVerifier = (token: string) => Promise<TokenClaims>;

/** FIREBASE_PROJECT_ID may be a comma-separated list (for zero-downtime Firebase project migration). */
export function getFirebaseProjectIds(): string[] {
  return (process.env.FIREBASE_PROJECT_ID || '').split(',').map((p) => p.trim()).filter(Boolean);
}

/** Thrown for issuer/audience mismatches so the middleware can respond 401 with a diagnosable log. */
export class AudienceMismatchError extends Error {}

function describeMismatch(token: string, ids: string[]): string {
  let aud: unknown = '<undecodable>';
  try {
    aud = decodeJwt(token).aud; // aud is public (the Firebase project id)
  } catch (_) {}
  return `token aud=${JSON.stringify(aud)} does not match configured FIREBASE_PROJECT_ID(s)=${JSON.stringify(ids)}`;
}

/** Test hook: replace the JWKS key resolver used by the real Firebase verifier. */
export function setJwksForTest(k: any) {
  jwks = k;
}

export async function firebaseVerifier(token: string): Promise<TokenClaims> {
  const projectIds = getFirebaseProjectIds();
  if (projectIds.length === 0) throw new Error('FIREBASE_PROJECT_ID is not configured');
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  let payload: any;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: projectIds.map((id) => `https://securetoken.google.com/${id}`),
      audience: projectIds,
      algorithms: ['RS256'],
    }));
  } catch (e: any) {
    if (e instanceof joseErrors.JWTClaimValidationFailed && (e.claim === 'aud' || e.claim === 'iss')) {
      const msg = describeMismatch(token, projectIds);
      console.error(`[auth] 401: ${msg} (failed claim: ${e.claim})`);
      throw new AudienceMismatchError(msg);
    }
    throw e;
  }
  if (!payload.sub) throw new Error('Token has no subject');
  return {
    uid: payload.sub,
    projectId: typeof payload.aud === 'string' ? payload.aud : Array.isArray(payload.aud) ? payload.aud.find((a: string) => projectIds.includes(a)) : undefined,
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

/**
 * Resolve the account for token claims: googleId (uid) first; otherwise link-by-email is only
 * honoured for a VERIFIED email and only when the row has no googleId yet (or the same one).
 */
/**
 * Firebase project migration: a token with a VERIFIED email whose project id is one of the configured
 * FIREBASE_PROJECT_ID values may re-point an existing email-matched row at its (new) uid.
 * Never true for unverified emails or tokens whose project id is unknown/not configured.
 */
export function canRelinkByEmail(c: TokenClaims): boolean {
  return !!c.email && c.emailVerified === true && !!c.projectId && getFirebaseProjectIds().includes(c.projectId);
}

export async function findUserForClaims(c: TokenClaims) {
  const byUid = await (prisma as any).user.findUnique({ where: { googleId: c.uid }, select: { id: true, email: true } });
  if (byUid) return byUid;
  if (c.email && c.emailVerified === true) {
    const byEmail = await (prisma as any).user.findUnique({
      where: { email: c.email.toLowerCase().trim() },
      select: { id: true, email: true, googleId: true },
    });
    if (byEmail && (!byEmail.googleId || byEmail.googleId === c.uid)) return { id: byEmail.id, email: byEmail.email };
    if (byEmail && canRelinkByEmail(c)) {
      try {
        await (prisma as any).user.update({ where: { id: byEmail.id }, data: { googleId: c.uid } });
        console.warn(`[auth] relinked user ${byEmail.id} to new uid (verified email, token project ${c.projectId})`);
        return { id: byEmail.id, email: byEmail.email };
      } catch (e: any) {
        console.error('[auth] relink failed:', e?.message);
      }
    }
  }
  return null;
}

/** A token carrying an email that the identity provider has not verified must not be trusted. */
export function hasUnverifiedEmail(c: TokenClaims): boolean {
  return !!c.email && c.emailVerified !== true;
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

    if (claims && hasUnverifiedEmail(claims)) {
      return res.status(403).json({ error: 'Email address is not verified. Verify your email and sign in again.', code: 'EMAIL_NOT_VERIFIED' });
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
    if (claims && hasUnverifiedEmail(claims)) {
      /* unverified identity: treated as anonymous */
    } else if (claims) {
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
    console.warn('!!!!!! SECURITY WARNING: ENFORCE_AUTH=false in production. The API trusts client-supplied user ids (x-user-id / userId). Remove ENFORCE_AUTH=false and set FIREBASE_PROJECT_ID. !!!!!!');
  }
  const ids = getFirebaseProjectIds();
  if (isEnforced() && ids.length === 0) {
    console.error('!!!!!! ENFORCE_AUTH=true but FIREBASE_PROJECT_ID is not set: ALL authenticated requests will be rejected. !!!!!!');
  }
  if (process.env.NODE_ENV === 'production') {
    if (ids.length === 0) {
      console.error('!!!!!! FIREBASE_PROJECT_ID is MISSING in production: ALL authenticated requests will be rejected with 401. Set it (comma-separated for several projects). !!!!!!');
    } else {
      console.log(`[auth] accepting Firebase ID tokens for project id(s): ${ids.join(', ')}`);
    }
  }
}
