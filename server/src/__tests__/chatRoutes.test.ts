/**
 * Mounted chat/DM/calls/meetings routers (node:test). Run: npm test (from server/)
 * Local throwaway SQLite; fake token verifier replaces Firebase.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

const dbFile = path.join(os.tmpdir(), `mf-chat-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.ENFORCE_AUTH = 'true';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.NODE_ENV = 'test';

let server: any;
let base = '';
let prisma: any;
let A: any, B: any, C: any, teamA: any, teamB: any, chanA: any, chanB: any, chat: any, callAB: any, meetingA: any;

async function call(method: string, url: string, opts: { token?: string; body?: any } = {}) {
  const headers: any = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + url, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

before(async () => {
  execSync('npx prisma db push --schema prisma/schema.sqlite.prisma --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  ({ prisma } = require('../prisma'));
  require('../middleware/auth').setTokenVerifier(async (t: string) => {
    if (!t.startsWith('tok-')) throw new Error('bad token');
    const uid = t.slice(4);
    return { uid, email: `${uid}@example.com`, emailVerified: true };
  });

  const mk = (k: string) => prisma.user.create({ data: { email: `${k}@example.com`, googleId: k, username: `user${k}`, name: k.toUpperCase() } });
  A = await mk('a'); B = await mk('b'); C = await mk('c');
  teamA = await prisma.team.create({ data: { name: 'Team A', ownerId: A.id, members: { create: { userId: A.id, role: 'owner' } } } });
  teamB = await prisma.team.create({ data: { name: 'Team B', ownerId: B.id, members: { create: { userId: B.id, role: 'owner' } } } });
  chanA = await prisma.channel.create({ data: { name: 'general', teamId: teamA.id } });
  chanB = await prisma.channel.create({ data: { name: 'secret', teamId: teamB.id } });
  await prisma.channelMessage.create({ data: { channelId: chanB.id, senderId: B.id, text: 'secret-b-message' } });
  chat = await prisma.directChat.create({
    data: { participants: { create: [{ userId: A.id }, { userId: B.id }] } },
  });
  callAB = await prisma.callSession.create({ data: { callerId: A.id, receiverId: B.id, roomId: 'room-ab', status: 'ENDED' } });
  meetingA = await prisma.meeting.create({ data: { title: 'A meeting', roomId: 'room-meet-a', teamId: teamA.id, createdById: A.id } });

  const app = require('../index').default;
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
  for (const f of [dbFile, `${dbFile}-journal`]) { try { fs.unlinkSync(f); } catch (_) {} }
});

test('unauthenticated requests get 401 on every mounted router', async () => {
  for (const url of [
    `/api/channels?teamId=${teamA.id}`,
    `/api/channels/${chanA.id}/messages`,
    '/api/chats',
    `/api/chats/${chat.id}/messages`,
    '/api/calls/history',
    '/api/calls/active',
    '/api/meetings/active',
    `/api/meetings/team/${teamA.id}`,
  ]) {
    assert.equal((await call('GET', url)).status, 401, url);
  }
  assert.equal((await call('POST', '/api/calls/initiate', { body: { receiverId: B.id } })).status, 401);
});

test('each mounted router responds (not 404) for an authenticated member', async () => {
  const tokA = 'tok-a';
  const ch = await call('GET', `/api/channels?teamId=${teamA.id}`, { token: tokA });
  assert.equal(ch.status, 200);
  assert.equal((await call('GET', `/api/channels/${chanA.id}/messages`, { token: tokA })).status, 200);

  assert.equal((await call('GET', '/api/chats', { token: tokA })).status, 200);
  assert.equal((await call('GET', `/api/chats/${chat.id}/messages`, { token: tokA })).status, 200);

  const hist = await call('GET', '/api/calls/history', { token: tokA });
  assert.equal(hist.status, 200);
  assert.equal(hist.json.history.length, 1);
  assert.equal((await call('GET', '/api/calls/active', { token: tokA })).status, 200);
  assert.equal((await call('GET', `/api/calls/${callAB.id}`, { token: tokA })).status, 200);

  assert.equal((await call('GET', '/api/meetings/active', { token: tokA })).status, 200);
  assert.equal((await call('GET', `/api/meetings/team/${teamA.id}`, { token: tokA })).status, 200);
  assert.equal((await call('GET', `/api/meetings/${meetingA.id}`, { token: tokA })).status, 200);
});

test('non-member cannot read another team channel or its messages', async () => {
  const list = await call('GET', `/api/channels?teamId=${teamB.id}`, { token: 'tok-a' });
  assert.ok([403, 404].includes(list.status), `list status ${list.status}`);
  const r = await call('GET', `/api/channels/${chanB.id}/messages`, { token: 'tok-a' });
  assert.ok([403, 404].includes(r.status), `status ${r.status}`);
  assert.ok(!JSON.stringify(r.json).includes('secret-b-message'));
  const post = await call('POST', `/api/channels/${chanB.id}/messages`, { token: 'tok-a', body: { text: 'intrude' } });
  assert.ok([403, 404].includes(post.status));
  const ok = await call('GET', `/api/channels/${chanB.id}/messages`, { token: 'tok-b' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.messages.length, 1);
});

test('non-participant cannot read another user call, history, DM or meeting', async () => {
  const one = await call('GET', `/api/calls/${callAB.id}`, { token: 'tok-c' });
  assert.ok([403, 404].includes(one.status));
  const patch = await call('PATCH', `/api/calls/${callAB.id}/status`, { token: 'tok-c', body: { status: 'ENDED' } });
  assert.ok([403, 404].includes(patch.status));
  const hist = await call('GET', `/api/calls/history?userId=${A.id}`, { token: 'tok-c' });
  assert.equal(hist.status, 200);
  assert.equal(hist.json.history.length, 0, 'history must be scoped to the token user, not ?userId');
  const dm = await call('GET', `/api/chats/${chat.id}/messages`, { token: 'tok-c' });
  assert.ok([403, 404].includes(dm.status));
  const meet = await call('GET', `/api/meetings/${meetingA.id}`, { token: 'tok-c' });
  assert.ok([403, 404].includes(meet.status));
});

test('SSE stream accepts ?access_token; invalid token rejected', async () => {
  const bad = await call('GET', '/api/notifications/stream?access_token=garbage');
  assert.equal(bad.status, 401);
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/notifications/stream?access_token=tok-a`, { signal: ctrl.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  ctrl.abort();
});
