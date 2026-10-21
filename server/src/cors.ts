import cors from 'cors';
import type { Request } from 'express';

/** Parse the comma-separated ALLOWED_ORIGINS env var (evaluated per call so env changes are respected). */
export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** The deployment's own origins from Vercel-provided env vars (when set). */
function selfOriginsFromEnv(): string[] {
  const out: string[] = [];
  for (const v of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (v && v.trim()) out.push(`https://${v.trim().replace(/^https?:\/\//, '')}`);
  }
  return out;
}

/**
 * Decide whether an Origin may call the API.
 *  - no Origin: allowed (curl, webhooks, same-origin GET)
 *  - listed in ALLOWED_ORIGINS
 *  - same-origin: the Origin's host equals the request's own Host header (a browser
 *    can't forge Origin, and a cross-site page always has a different host)
 *  - the deployment's own VERCEL_URL / VERCEL_BRANCH_URL
 * No blanket *.vercel.app allowance.
 */
export function isOriginAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/+$/, '');
  if (getAllowedOrigins().includes(normalized)) return true;
  if (selfOriginsFromEnv().includes(normalized)) return true;
  if (host) {
    try {
      const u = new URL(normalized);
      if ((u.protocol === 'https:' || u.protocol === 'http:') && u.host.toLowerCase() === host.toLowerCase()) return true;
    } catch {
      /* malformed Origin: reject */
    }
  }
  return false;
}

export function buildCors(isDev: boolean) {
  return cors((req: Request, callback) => {
    const allowed = isDev ? true : isOriginAllowed(req.headers.origin as string | undefined, req.headers.host);
    callback(null, { origin: allowed, credentials: true });
  });
}
