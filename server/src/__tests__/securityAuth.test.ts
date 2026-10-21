/**
 * Security regression tests: invitations / join codes, email-verified identity linking,
 * member status exemption, dependency-check membership, fail-closed production defaults.
 * Real routers on the real app; fake token verifier ("<uid>|<email>|<verified>" tokens).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

const dbFile = path.join(os.tmpdir(), `mf-secauth-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.ENFORCE_AUTH = 'true';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.NODE_ENV = 'test';

let server: any;
let base = '';
let prisma: any;
let O: any, X: any, V: any, M: any;
let project: any, ownerRow: any, rejectedRow: any, inviteRow: any, teamInv: any, team: any, mod: any;

/** token format: tok:<uid>:<email>:<verified 1|0> */
const tok = (uid: string, email: string, verified = true) => `tok:${uid}:${email}:${verified ? 1 : 0}`;

async function call(method: string, url: string, opts: { token?: string; body?: any; headers?: any } = {}) {
  const headers: any = { 'content-type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + url, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json, headers: res.headers };
}

before(async () => {
  execSync('npx prisma db push --schema prisma/schema.sqlite.prisma --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  ({ prisma } = require('../prisma'));
  const mw = require('../middleware/auth');
  mw.setTokenVerifier(async (t: string) => {
    const p = t.split(':');
    if (p[0] !== 'tok') throw new Error('bad token');
    return { uid: p[1], email: p[2], emailVerified: p[3] === '1' };
  });

  O = await prisma.user.create({ data: { email: 'owner@example.com', googleId: 'o', username: 'owner', name: 'Owner' } });
  X = await prisma.user.create({ data: { email: 'x@example.com', googleId: 'x', username: 'xx', name: 'X' } });
  V = await prisma.user.create({ data: { email: 'victim@example.com', googleId: 'v-uid', username: 'victim', name: 'V' } });
  M = await prisma.user.create({ data: { email: 'm@example.com', googleId: 'm', username: 'mm', name: 'M' } });
  project = await prisma.project.create({ data: { name: 'P', userId: O.id, joinCode: 'MF-ABC123' } });
  ownerRow = await prisma.projectMember.create({
    data: { projectId: project.id, userId: O.id, email: O.email, role: 'owner', status: 'accepted' },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: M.id, email: M.email, role: 'developer', status: 'accepted' },
  });
  rejectedRow = await prisma.projectMember.create({
    data: { projectId: project.id, email: 'rej@example.com', role: 'developer', status: 'rejected' },
  });
  inviteRow = await prisma.projectMember.create({
    data: { projectId: project.id, email: 'invitee@example.com', role: 'viewer', status: 'pending', inviteToken: 'secret-invite-token' },
  });
  team = await prisma.team.create({ data: { name: 'T', ownerId: O.id, members: { create: { userId: O.id, role: 'owner' } } } });
  teamInv = await prisma.teamInvitation.create({
    data: {
      teamId: team.id, inviterId: O.id, inviteeEmail: 'invitee@example.com', role: 'member',
      token: 'secret-team-token', status: 'pending', expiresAt: new Date(Date.now() + 86400000),
    },
  });
  await prisma.category.create({ data: { name: 'Accounting', slug: 'accounting' } });
  mod = await prisma.module.create({
    data: { name: 'm1', slug: 'dep-mod', description: 'd', author: 'a', categoryName: 'Accounting', sourceType: 'upload' },
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

const memberCount = (email: string) => prisma.projectMember.count({ where: { projectId: project.id, email } });

// ── Finding 1 / 6: invitations ──────────────────────────────────────────────
test('F1: accept by project id does NOT join the project', async () => {
  const r = await call('POST', `/api/invitations/${project.id}/accept`, { token: tok('x', 'x@example.com') });
  assert.equal(r.status, 404);
  assert.equal(await memberCount('x@example.com'), 0);
});

test('F1: accept by ProjectMember id cannot flip rejected/owner rows', async () => {
  for (const row of [rejectedRow, ownerRow]) {
    const r = await call('POST', `/api/invitations/${row.id}/accept`, { token: tok('x', 'x@example.com') });
    assert.equal(r.status, 404);
  }
  const rej = await prisma.projectMember.findUnique({ where: { id: rejectedRow.id } });
  assert.equal(rej.status, 'rejected');
  const own = await prisma.projectMember.findUnique({ where: { id: ownerRow.id } });
  assert.equal(own.role, 'owner');
  assert.equal(own.userId, O.id);
});

test('F1: accept by team invitation id is rejected (token only)', async () => {
  const r = await call('POST', `/api/invitations/${teamInv.id}/accept`, { token: tok('x', 'x@example.com') });
  assert.equal(r.status, 404);
});

test('F1: joinCode via accept creates a PENDING member, never accepted', async () => {
  const r = await call('POST', `/api/invitations/MF-ABC123/accept`, { token: tok('x', 'x@example.com') });
  assert.equal(r.status, 200);
  const row = await prisma.projectMember.findFirst({ where: { projectId: project.id, email: 'x@example.com' } });
  assert.equal(row.status, 'pending');
  assert.equal(row.role, 'developer');
});

test('F1: joinCode accept by the owner / an existing member does not change their row', async () => {
  await call('POST', `/api/invitations/MF-ABC123/accept`, { token: tok('o', 'owner@example.com') });
  const own = await prisma.projectMember.findUnique({ where: { id: ownerRow.id } });
  assert.equal(own.role, 'owner');
  assert.equal(own.status, 'accepted');
  assert.equal(await memberCount('owner@example.com'), 1);
});

test('F1: invite token is bound to the invitee email', async () => {
  const wrong = await call('POST', `/api/invitations/secret-invite-token/accept`, { token: tok('x', 'x@example.com') });
  assert.equal(wrong.status, 403);
  assert.equal((await prisma.projectMember.findUnique({ where: { id: inviteRow.id } })).status, 'pending');
  const wrongTeam = await call('POST', `/api/invitations/secret-team-token/accept`, { token: tok('x', 'x@example.com') });
  assert.equal(wrongTeam.status, 403);
  assert.equal(await prisma.teamMember.count({ where: { teamId: team.id, userId: X.id } }), 0);

  const inv = await prisma.user.create({ data: { email: 'invitee@example.com', googleId: 'inv', username: 'invitee', name: 'I' } });
  const ok = await call('POST', `/api/invitations/secret-invite-token/accept`, { token: tok('inv', 'invitee@example.com') });
  assert.equal(ok.status, 200);
  const row = await prisma.projectMember.findUnique({ where: { id: inviteRow.id } });
  assert.equal(row.status, 'accepted');
  assert.equal(row.role, 'viewer');
  assert.equal(row.userId, inv.id);
});

test('F1: legacy /projects/invites/accept is bound to the invitee email too', async () => {
  const row = await prisma.projectMember.create({
    data: { projectId: project.id, email: 'm2@example.com', role: 'viewer', status: 'pending', inviteToken: 'secret-invite-2' },
  });
  const wrong = await call('POST', '/api/projects/invites/accept', { token: tok('x', 'x@example.com'), body: { token: 'secret-invite-2' } });
  assert.equal(wrong.status, 403);
  assert.equal((await prisma.projectMember.findUnique({ where: { id: row.id } })).status, 'pending');
  await prisma.user.create({ data: { email: 'm2@example.com', googleId: 'm2', username: 'm2', name: 'M2' } });
  const ok = await call('POST', '/api/projects/invites/accept', { token: tok('m2', 'm2@example.com'), body: { token: 'secret-invite-2' } });
  assert.equal(ok.status, 200);
  assert.equal((await prisma.projectMember.findUnique({ where: { id: row.id } })).status, 'accepted');
});

test('F1: team accept never downgrades an existing owner', async () => {
  const inv2 = await prisma.teamInvitation.create({
    data: { teamId: team.id, inviterId: O.id, inviteeUserId: O.id, role: 'member', token: 'own-team-token', status: 'pending', expiresAt: new Date(Date.now() + 86400000) },
  });
  const r = await call('POST', `/api/invitations/${inv2.token}/accept`, { token: tok('o', 'owner@example.com') });
  assert.equal(r.status, 200);
  const tm = await prisma.teamMember.findFirst({ where: { teamId: team.id, userId: O.id } });
  assert.equal(tm.role, 'owner');
});

test('F6: GET /api/invitations/:token matches secret tokens only, not ids', async () => {
  for (const id of [project.id, ownerRow.id, teamInv.id]) {
    assert.equal((await call('GET', `/api/invitations/${id}`)).status, 404, id);
  }
  assert.equal((await call('GET', `/api/invitations/secret-team-token`)).status, 200);
  assert.equal((await call('GET', `/api/invitations/MF-ABC123`)).status, 200);
});

test('F1: GET /api/projects/by-code/:code matches joinCode only', async () => {
  const byId = await call('GET', `/api/projects/by-code/${project.id}`, { token: tok('x', 'x@example.com') });
  assert.equal(byId.status, 404);
  const byCode = await call('GET', `/api/projects/by-code/MF-ABC123`, { token: tok('x', 'x@example.com') });
  assert.equal(byCode.status, 200);
});

test('F1: join-by-code does not accept a project id', async () => {
  const r = await call('POST', `/api/projects/join-by-code`, { token: tok('x', 'x@example.com'), body: { code: project.id, email: 'x2@example.com' } });
  assert.equal(r.status, 404);
});

// ── Finding 2: email verification / account takeover ────────────────────────
test('F2: unverified email session is rejected on protected routes and /sync', async () => {
  const t = tok('attacker', 'victim@example.com', false);
  const sync = await call('POST', '/api/auth/sync', { token: t });
  assert.ok(sync.status === 401 || sync.status === 403, `sync ${sync.status}`);
  const teams = await call('GET', '/api/teams', { token: t });
  assert.ok(teams.status === 401 || teams.status === 403, `teams ${teams.status}`);
  assert.equal((await prisma.user.findUnique({ where: { id: V.id } })).googleId, 'v-uid');
});

test('F2: verified email never overwrites a different existing googleId, and is not authenticated as that user', async () => {
  const t = tok('other-uid', 'victim@example.com', true);
  const sync = await call('POST', '/api/auth/sync', { token: t });
  assert.equal(sync.status, 409);
  assert.equal((await prisma.user.findUnique({ where: { id: V.id } })).googleId, 'v-uid');
  const teams = await call('GET', '/api/teams', { token: t });
  assert.equal(teams.status, 401);
});

test('F2: verified email links a legacy row whose googleId is null; googleId match wins', async () => {
  const legacy = await prisma.user.create({ data: { email: 'legacy@example.com', username: 'legacy', name: 'L' } });
  const t = tok('legacy-uid', 'legacy@example.com', true);
  const sync = await call('POST', '/api/auth/sync', { token: t });
  assert.equal(sync.status, 200);
  assert.equal((await prisma.user.findUnique({ where: { id: legacy.id } })).googleId, 'legacy-uid');
  assert.equal((await call('GET', '/api/teams', { token: t })).status, 200);
  // same uid, changed email still resolves by googleId
  assert.equal((await call('GET', '/api/teams', { token: tok('legacy-uid', 'changed@example.com', true) })).status, 200);
});

// ── Finding 7 ───────────────────────────────────────────────────────────────
test('F7: members/status requires membership or being the email owner', async () => {
  const url = `/api/projects/${project.id}/members/status?email=m@example.com`;
  const outsider = await call('GET', url, { token: tok('x', 'x@example.com') });
  assert.equal(outsider.status, 404);
  const self = await call('GET', url, { token: tok('m', 'm@example.com') });
  assert.equal(self.status, 200);
  const ownerView = await call('GET', url, { token: tok('o', 'owner@example.com') });
  assert.equal(ownerView.status, 200);
  const none = await call('GET', url);
  assert.equal(none.status, 401);
});

test('F7: dependency-check requires project membership', async () => {
  const url = `/api/modules/${mod.id}/dependency-check?projectId=${project.id}`;
  assert.equal((await call('GET', url)).status, 401);
  assert.equal((await call('GET', url, { token: tok('x', 'x@example.com') })).status, 404);
  assert.equal((await call('GET', url, { token: tok('m', 'm@example.com') })).status, 200);
});

// ── Finding 8: fail closed ─────────────────────────────────────────────────
test('F8: production enforces auth unless ENFORCE_AUTH is explicitly "false"', () => {
  const { isEnforced } = require('../middleware/auth');
  const prevN = process.env.NODE_ENV, prevE = process.env.ENFORCE_AUTH;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ENFORCE_AUTH;
    assert.equal(isEnforced(), true);
    process.env.ENFORCE_AUTH = 'false';
    assert.equal(isEnforced(), false);
    process.env.NODE_ENV = 'test';
    delete process.env.ENFORCE_AUTH;
    assert.equal(isEnforced(), false);
  } finally {
    process.env.NODE_ENV = prevN;
    process.env.ENFORCE_AUTH = prevE;
  }
});

test('F8: production with ENFORCE_AUTH unset rejects legacy x-user-id and anonymous access', async () => {
  const prevN = process.env.NODE_ENV, prevE = process.env.ENFORCE_AUTH;
  process.env.NODE_ENV = 'production';
  delete process.env.ENFORCE_AUTH;
  try {
    assert.equal((await call('GET', '/api/teams', { headers: { 'x-user-id': M.id } })).status, 401);
    assert.equal((await call('GET', `/api/teams?userId=${M.id}`)).status, 401);
    assert.equal((await call('GET', '/api/teams', { token: tok('m', 'm@example.com') })).status, 200);
  } finally {
    process.env.NODE_ENV = prevN;
    process.env.ENFORCE_AUTH = prevE;
  }
});

test('F8: unset NODE_ENV is not development (no google-dev, no runner/git, no wildcard CORS)', async () => {
  const prevN = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  let srv: any;
  try {
    for (const k of Object.keys(require.cache)) if (/[\\/]src[\\/]index\.(ts|js)$/.test(k)) delete require.cache[k];
    const app2 = require('../index').default;
    srv = app2.listen(0);
    const b2 = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const g = await fetch(b2 + '/api/auth/google-dev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"email":"b@example.com"}' });
    assert.equal(g.status, 404);
    const r = await fetch(b2 + '/api/runner/x', { headers: { origin: 'https://evil.example' } });
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    const gt = await fetch(b2 + '/api/git/x');
    assert.equal(gt.status, 503);
  } finally {
    srv?.close();
    process.env.NODE_ENV = prevN;
  }
});
