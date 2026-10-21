/**
 * Firebase project migration: relink an existing email-matched user to a new uid only for a
 * VERIFIED email on a token from a configured project id.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

const dbFile = path.join(os.tmpdir(), `mf-relink-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.ENFORCE_AUTH = 'true';
process.env.FIREBASE_PROJECT_ID = 'modulefodge,modulefodge-a14fa';
process.env.NODE_ENV = 'test';

let server: any;
let base = '';
let prisma: any;

/** token: tok:<uid>:<email>:<verified 1|0>:<projectId> */
const tok = (uid: string, email: string, verified: boolean, proj: string) => `tok:${uid}:${email}:${verified ? 1 : 0}:${proj}`;

async function call(method: string, url: string, token: string) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

before(async () => {
  execSync('npx prisma db push --schema prisma/schema.sqlite.prisma --skip-generate --accept-data-loss', { cwd: path.join(__dirname, '..', '..'), env: process.env, stdio: 'ignore' });
  ({ prisma } = require('../prisma'));
  require('../middleware/auth').setTokenVerifier(async (t: string) => {
    const p = t.split(':');
    return { uid: p[1], email: p[2], emailVerified: p[3] === '1', projectId: p[4] };
  });
  const app = require('../index').default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) { try { fs.unlinkSync(f); } catch (_) {} }
});

test('relink (a): verified email + configured project, new uid -> same user id/data, googleId updated', async () => {
  const u = await prisma.user.create({ data: { email: 'old@example.com', googleId: 'old-uid', username: 'olduser', name: 'Old Name' } });
  const r = await call('POST', '/api/auth/sync', tok('new-uid', 'old@example.com', true, 'modulefodge-a14fa'));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.user.id, u.id);
  const after = await prisma.user.findUnique({ where: { id: u.id } });
  assert.equal(after.googleId, 'new-uid');
  assert.equal(after.username, 'olduser');
  assert.equal(after.name, 'Old Name');
  assert.equal(await prisma.user.count({ where: { email: 'old@example.com' } }), 1);
  assert.equal((await call('GET', '/api/teams', tok('new-uid', 'old@example.com', true, 'modulefodge-a14fa'))).status, 200);
});

test('relink (a2): authenticated route (without prior /sync) also relinks', async () => {
  const u = await prisma.user.create({ data: { email: 'nosync@example.com', googleId: 'ns-old', username: 'nosync', name: 'N' } });
  const r = await call('GET', '/api/teams', tok('ns-new', 'nosync@example.com', true, 'modulefodge-a14fa'));
  assert.equal(r.status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).googleId, 'ns-new');
});

test('relink (b): unverified email never relinks (sync + routes)', async () => {
  const u = await prisma.user.create({ data: { email: 'vic@example.com', googleId: 'vic-uid', username: 'vic', name: 'V' } });
  const t = tok('attacker', 'vic@example.com', false, 'modulefodge-a14fa');
  const s = await call('POST', '/api/auth/sync', t);
  assert.equal(s.status, 403);
  assert.equal(s.json.code, 'EMAIL_NOT_VERIFIED');
  assert.equal((await call('GET', '/api/teams', t)).status, 403);
  assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).googleId, 'vic-uid');
});

test('relink (c): verified email but token project id NOT configured -> 409, no relink', async () => {
  const u = await prisma.user.create({ data: { email: 'c@example.com', googleId: 'c-uid', username: 'cuser', name: 'C' } });
  const r = await call('POST', '/api/auth/sync', tok('c-new', 'c@example.com', true, 'some-other-project'));
  assert.equal(r.status, 409);
  assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).googleId, 'c-uid');
});
