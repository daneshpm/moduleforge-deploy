/**
 * Auth tests (node:test, no extra deps). Run: npm test  (from server/)
 * Uses a throwaway local SQLite file; a fake token verifier replaces Firebase.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

const dbFile = path.join(os.tmpdir(), `mf-auth-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.ENFORCE_AUTH = 'true';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.NODE_ENV = 'test';

let server: any;
let base = '';
let prisma: any;
let setTokenVerifier: any;
let A: any, B: any, teamB: any;

async function call(method: string, url: string, opts: { token?: string; body?: any; headers?: any } = {}) {
  const headers: any = { 'content-type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + url, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

before(async () => {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  ({ prisma } = require('../prisma'));
  const mw = require('../middleware/auth');
  setTokenVerifier = mw.setTokenVerifier;
  // Tokens look like "tok-<uid>"; uid maps to googleId
  setTokenVerifier(async (t: string) => {
    if (!t.startsWith('tok-')) throw new Error('bad token');
    const uid = t.slice(4);
    return { uid, email: `${uid}@example.com` };
  });

  A = await prisma.user.create({ data: { email: 'a@example.com', googleId: 'a', username: 'usera', name: 'A' } });
  B = await prisma.user.create({ data: { email: 'b@example.com', googleId: 'b', username: 'userb', name: 'B' } });
  teamB = await prisma.team.create({
    data: { name: 'B-only team', ownerId: B.id, members: { create: { userId: B.id, role: 'owner' } } },
  });
  await prisma.notification.create({ data: { userId: B.id, type: 'system', title: 'secret-b', message: 'for B only' } });

  const app = require('../index').default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) { try { fs.unlinkSync(f); } catch (_) {} }
});

test('ENFORCE_AUTH=true: no token -> 401 on protected routes', async () => {
  for (const url of ['/api/teams', '/api/notifications', '/api/projects', '/api/users/search?q=a']) {
    const r = await call('GET', url);
    assert.equal(r.status, 401, url);
  }
  // legacy identity must NOT work when enforced
  const legacy = await call('GET', `/api/teams?userId=${B.id}`, { headers: { 'x-user-id': B.id } });
  assert.equal(legacy.status, 401);
  const bad = await call('GET', '/api/teams', { token: 'garbage' });
  assert.equal(bad.status, 401);
});

test('public routes stay public', async () => {
  assert.equal((await call('GET', '/api/health')).status, 200);
  assert.notEqual((await call('GET', '/api/modules')).status, 401);
});

test('POST /api/auth/sync requires a token when enforced and ignores body identity', async () => {
  assert.equal((await call('POST', '/api/auth/sync', { body: { email: 'x@example.com' } })).status, 401);
  const r = await call('POST', '/api/auth/sync', { token: 'tok-newbie', body: { email: 'victim@example.com', name: 'N' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.user.email, 'newbie@example.com'); // from token, not body
  assert.equal(await prisma.user.findUnique({ where: { email: 'victim@example.com' } }), null);
});

test('user A cannot read user B teams or notifications', async () => {
  const teams = await call('GET', `/api/teams?userId=${B.id}`, { token: 'tok-a' });
  assert.equal(teams.status, 200);
  assert.deepEqual(teams.json.teams, []);

  const detail = await call('GET', `/api/teams/${teamB.id}`, { token: 'tok-a' });
  assert.equal(detail.status, 404);

  const notifs = await call('GET', `/api/notifications?userId=${B.id}`, { token: 'tok-a' });
  assert.equal(notifs.status, 200);
  assert.equal(notifs.json.notifications.length, 0);

  // B sees their own data
  assert.equal((await call('GET', '/api/teams', { token: 'tok-b' })).json.teams.length, 1);
  assert.equal((await call('GET', '/api/notifications', { token: 'tok-b' })).json.notifications.length, 1);

  // A cannot modify B's team
  const patch = await call('PATCH', `/api/teams/${teamB.id}`, { token: 'tok-a', body: { name: 'pwned', userId: B.id } });
  assert.equal(patch.status, 403);
  const del = await call('DELETE', `/api/teams/${teamB.id}`, { token: 'tok-a' });
  assert.equal(del.status, 403);
});

test('POST /api/auth/google-dev returns 404 in production mode', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const r = await call('POST', '/api/auth/google-dev', { body: { email: 'b@example.com' } });
    assert.equal(r.status, 404);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('legacy mode (ENFORCE_AUTH off) still works via x-user-id', async () => {
  process.env.ENFORCE_AUTH = 'false';
  try {
    const r = await call('GET', '/api/teams', { headers: { 'x-user-id': B.id } });
    assert.equal(r.status, 200);
    assert.equal(r.json.teams.length, 1);
  } finally {
    process.env.ENFORCE_AUTH = 'true';
  }
});
