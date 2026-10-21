/**
 * CORS same-origin handling + multi-project FIREBASE_PROJECT_ID verification.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import type { AddressInfo } from 'net';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';

process.env.NODE_ENV = 'test';
delete process.env.VERCEL_URL;
delete process.env.VERCEL_BRANCH_URL;

const { buildCors, isOriginAllowed } = require('../cors');
const auth = require('../middleware/auth');

// ── CORS ─────────────────────────────────────────────────────────────────────
let server: http.Server;
let port = 0;

before(async () => {
  const app = express();
  app.use(buildCors(false));
  app.post('/api/x', (_req, res) => res.json({ ok: true }));
  server = app.listen(0);
  port = (server.address() as AddressInfo).port;
});
after(() => server.close());

/** Raw http so we can set Host and Origin freely (fetch forbids both). */
function raw(origin: string | undefined, host: string): Promise<{ status: number; acao: string | undefined }> {
  return new Promise((resolve, reject) => {
    const headers: any = { host };
    if (origin) headers.origin = origin;
    const req = http.request({ port, method: 'POST', path: '/api/x', headers }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode || 0, acao: res.headers['access-control-allow-origin'] as string | undefined }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('cors: same-origin POST (Origin host == Host) is allowed without ALLOWED_ORIGINS', async () => {
  delete process.env.ALLOWED_ORIGINS;
  const r = await raw('https://my-app-git-feat-team.vercel.app', 'my-app-git-feat-team.vercel.app');
  assert.equal(r.acao, 'https://my-app-git-feat-team.vercel.app');
});

test('cors: cross-origin not in ALLOWED_ORIGINS gets no ACAO header', async () => {
  delete process.env.ALLOWED_ORIGINS;
  const r = await raw('https://evil.example.com', 'my-app.vercel.app');
  assert.equal(r.acao, undefined);
});

test('cors: arbitrary *.vercel.app origin is NOT allowed', async () => {
  const r = await raw('https://attacker.vercel.app', 'my-app.vercel.app');
  assert.equal(r.acao, undefined);
});

test('cors: ALLOWED_ORIGINS entries still work (trailing slash tolerated)', async () => {
  process.env.ALLOWED_ORIGINS = 'https://app.example.com/, https://b.example.com';
  assert.equal((await raw('https://app.example.com', 'api.internal')).acao, 'https://app.example.com');
  assert.equal((await raw('https://b.example.com', 'api.internal')).acao, 'https://b.example.com');
  delete process.env.ALLOWED_ORIGINS;
});

test('cors: VERCEL_URL / VERCEL_BRANCH_URL origins allowed when set', () => {
  process.env.VERCEL_URL = 'proj-abc123.vercel.app';
  process.env.VERCEL_BRANCH_URL = 'proj-git-branch.vercel.app';
  assert.equal(isOriginAllowed('https://proj-abc123.vercel.app', 'other'), true);
  assert.equal(isOriginAllowed('https://proj-git-branch.vercel.app', 'other'), true);
  assert.equal(isOriginAllowed('https://proj-zzz.vercel.app', 'other'), false);
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_BRANCH_URL;
});

test('cors: no Origin header passes; malformed Origin rejected', () => {
  assert.equal(isOriginAllowed(undefined, 'x'), true);
  assert.equal(isOriginAllowed('not a url', 'x'), false);
  assert.equal(isOriginAllowed('null', 'x'), false);
});

// ── Firebase project ids ─────────────────────────────────────────────────────
let privateKey: any;

async function mint(aud: string, iss = `https://securetoken.google.com/${aud}`) {
  return new SignJWT({ email: 'a@b.com', email_verified: true })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setSubject('uid-1')
    .setAudience(aud)
    .setIssuer(iss)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

test('firebase ids: list parsing', () => {
  process.env.FIREBASE_PROJECT_ID = ' old-proj , new-proj ,,';
  assert.deepEqual(auth.getFirebaseProjectIds(), ['old-proj', 'new-proj']);
});

test('firebase ids: tokens from either listed project verify; others are rejected with aud logged', async () => {
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey;
  const jwk = { ...(await exportJWK(kp.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  auth.setJwksForTest(createLocalJWKSet({ keys: [jwk] }));
  process.env.FIREBASE_PROJECT_ID = 'old-proj,new-proj';

  assert.equal((await auth.firebaseVerifier(await mint('old-proj'))).uid, 'uid-1');
  assert.equal((await auth.firebaseVerifier(await mint('new-proj'))).uid, 'uid-1');

  const logs: string[] = [];
  const orig = console.error;
  console.error = (...a: any[]) => { logs.push(a.join(' ')); };
  try {
    await assert.rejects(auth.firebaseVerifier(await mint('third-proj')), (e: any) => e instanceof auth.AudienceMismatchError);
    // right audience, wrong issuer
    await assert.rejects(auth.firebaseVerifier(await mint('old-proj', 'https://securetoken.google.com/other')));
  } finally {
    console.error = orig;
  }
  assert.ok(logs.some((l) => l.includes('third-proj') && l.includes('old-proj') && l.includes('new-proj')), logs.join('\n'));
});

test('firebase ids: authenticate() returns 401 for audience mismatch when enforced', async () => {
  process.env.ENFORCE_AUTH = 'true';
  process.env.FIREBASE_PROJECT_ID = 'old-proj';
  auth.setTokenVerifier(null);
  const orig = console.error;
  console.error = () => {};
  try {
    const app = express();
    app.get('/p', auth.authenticate, (_req: any, res: any) => res.json({ ok: true }));
    const s = app.listen(0);
    const p = (s.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${p}/p`, { headers: { authorization: `Bearer ${await mint('wrong-proj')}` } });
    assert.equal(res.status, 401);
    s.close();
  } finally {
    console.error = orig;
    delete process.env.ENFORCE_AUTH;
  }
});

test('firebase ids: missing FIREBASE_PROJECT_ID in production logs a loud error (does not throw)', () => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.FIREBASE_PROJECT_ID;
  const errs: string[] = [];
  const logs: string[] = [];
  const oe = console.error, ol = console.log, ow = console.warn;
  console.error = (...a: any[]) => { errs.push(a.join(' ')); };
  console.log = (...a: any[]) => { logs.push(a.join(' ')); };
  console.warn = () => {};
  try {
    auth.logAuthStartupWarnings();
    assert.ok(errs.some((e) => /FIREBASE_PROJECT_ID is MISSING/.test(e)));
    process.env.FIREBASE_PROJECT_ID = 'a,b';
    auth.logAuthStartupWarnings();
    assert.ok(logs.some((l) => l.includes('a, b')));
  } finally {
    console.error = oe; console.log = ol; console.warn = ow;
    process.env.NODE_ENV = prevEnv;
  }
});
