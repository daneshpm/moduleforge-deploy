import { createHmac, timingSafeEqual } from 'node:crypto';

/** Stripe-compatible webhook signature scheme: header `t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<rawBody>">`. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureResult = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'mismatch' };

const hmac = (secret: string, t: string, body: Buffer | string) =>
  createHmac('sha256', secret).update(`${t}.`).update(body).digest('hex');

/** Build a header for `rawBody` (used by tests, the mock provider and the demo). */
export function signPayload(rawBody: Buffer | string, secret: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
  return `t=${timestampSeconds},v1=${hmac(secret, String(timestampSeconds), rawBody)}`;
}

export function verifySignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): SignatureResult {
  if (!secret || !header) return { ok: false, reason: 'missing' };
  let t = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  if (!/^\d{1,12}$/.test(t) || v1.length === 0) return { ok: false, reason: 'malformed' };
  if (Math.abs(nowSeconds - Number(t)) > toleranceSeconds) return { ok: false, reason: 'stale' };
  const expected = Buffer.from(hmac(secret, t, rawBody), 'hex');
  // Check every candidate (no early exit) with constant-time comparison.
  let match = false;
  for (const cand of v1) {
    const got = /^[0-9a-f]{64}$/i.test(cand) ? Buffer.from(cand, 'hex') : null;
    if (got && got.length === expected.length && timingSafeEqual(got, expected)) match = true;
  }
  return match ? { ok: true } : { ok: false, reason: 'mismatch' };
}
