/**
 * Security regression tests: repo path confinement (.git, root, prefix siblings), git hardening,
 * zip bombs, marketplace re-install bypass, module id/slug precedence, concurrent publish.
 * Real routers on a small express app; the caller is chosen with the x-test-user header.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import JSZip from 'jszip';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';

const dbFile = path.join(os.tmpdir(), `mf-secrepo-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.NODE_ENV = 'test';
delete process.env.ENFORCE_AUTH;

let server: any;
let base = '';
let prisma: any;
let owner: any, member: any, attacker: any, victim: any;
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const created: string[] = [];
let gitService: any;

const manifest = (id: string, version: string) => ({
  contractVersion: '1', id, name: id, version, description: `${id} module`, type: 'backend', category: 'Accounting',
  permissions: [`${id}.thing.read`], events: { publishes: [`${id.replace(/-/g, '_')}.created`] }, compatibility: { moduleforge: '>=1.0.0' },
});

async function zipBuf(files: Record<string, string | Buffer>): Promise<Buffer> {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function zipFile(name: string, files: Record<string, string | Buffer>): Promise<string> {
  const buf = await zipBuf(files);
  fs.mkdirSync(uploadsDir, { recursive: true });
  const p = path.join(uploadsDir, `sectest-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}-${name}.zip`);
  fs.writeFileSync(p, buf);
  created.push(p);
  return p;
}
const moduleZip = (id: string, version: string, body: Record<string, string> = {}) =>
  zipFile(`${id}-${version}`, { 'module.json': JSON.stringify(manifest(id, version)), ...body });

async function call(method: string, url: string, body?: any, who: any = owner) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', 'x-test-user': who.id },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}
async function upload(url: string, buf: Buffer, fields: Record<string, string> = {}, who: any = owner) {
  const fd = new FormData();
  fd.append('file', new Blob([buf]), 'm.zip');
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(base + url, { method: 'POST', headers: { 'x-test-user': who.id }, body: fd });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

let pid = '';
let repoDir = '';
async function newProject(name: string) {
  const p = await prisma.project.create({ data: { name, userId: owner.id, projectType: 'individual' } });
  await prisma.projectMember.create({ data: { projectId: p.id, userId: owner.id, email: owner.email, role: 'owner', status: 'accepted' } });
  await prisma.projectMember.create({ data: { projectId: p.id, userId: member.id, email: member.email, role: 'developer', status: 'accepted' } });
  return p.id as string;
}

before(async () => {
  execSync('npx prisma db push --skip-generate --accept-data-loss', { cwd: path.join(__dirname, '..', '..'), env: process.env, stdio: 'ignore' });
  ({ prisma } = require('../prisma'));
  ({ gitService } = require('../services/gitService'));
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}@test.local`, name: n, username: n } });
  owner = await mk('owner'); member = await mk('member'); attacker = await mk('attacker'); victim = await mk('victim');
  const express = require('express');
  const { modulesRouter } = require('../routes/modules');
  const { projectsRouter } = require('../routes/projects');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (id) req.user = { id, email: '' };
    next();
  });
  app.use('/api/modules', modulesRouter);
  app.use('/api/projects', projectsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  pid = await newProject('repo-sec');
  // materialise the repo
  assert.equal((await call('GET', `/api/projects/${pid}/repository`)).status, 200);
  repoDir = await gitService.getProjectRepoDir(pid);
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
  for (const f of created) { try { fs.unlinkSync(f); } catch (_) {} }
  for (const f of [dbFile, dbFile + '-journal']) { try { fs.unlinkSync(f); } catch (_) {} }
});

// ── Finding 3: path confinement ─────────────────────────────────────────────
test('F3: resolveInsideRepo rejects .git, root, absolute and prefix-sibling paths', () => {
  const { resolveInsideRepo } = require('../services/gitService');
  const root = path.join(os.tmpdir(), 'repo-root');
  for (const bad of ['', '.', './', '/', '.git/config', '.GIT/config', 'a/.git/hooks/x', 'a\\.git\\config', '.git\\config',
    '../x', '..\\x', 'a/../../x', '../repo-root-evil/f', 'C:\\Windows\\x', '/etc/passwd', '.git ', '.git.', 'a/.git./x']) {
    assert.throws(() => resolveInsideRepo(root, bad), /Access denied|Invalid/, JSON.stringify(bad));
  }
  assert.throws(() => resolveInsideRepo(root, null as any));
  assert.equal(resolveInsideRepo(root, 'modules/a/b.js'), path.join(root, 'modules', 'a', 'b.js'));
  assert.equal(resolveInsideRepo(root, 'modules\\a\\b.js'), path.join(root, 'modules', 'a', 'b.js'));
  assert.equal(resolveInsideRepo(root, '.gitignore'), path.join(root, '.gitignore'));
  assert.equal(resolveInsideRepo(root, '', { allowRoot: true }), root);
});

test('F3: POST /repository/file cannot write inside .git and GET cannot read it', async () => {
  const before = fs.readFileSync(path.join(repoDir, '.git', 'config'), 'utf-8');
  for (const p of ['.git/config', '.GIT/config', 'modules/.git/config', '.git\\config', '../escape.txt', `../${path.basename(repoDir)}-evil/x`]) {
    const r = await call('POST', `/api/projects/${pid}/repository/file`, { path: p, content: '[core]\n fsmonitor = evil' });
    assert.equal(r.status, 400, p);
  }
  assert.equal(fs.readFileSync(path.join(repoDir, '.git', 'config'), 'utf-8'), before);
  assert.equal(fs.existsSync(`${repoDir}-evil`), false);
  const read = await call('GET', `/api/projects/${pid}/repository/file?path=${encodeURIComponent('.git/config')}`);
  assert.equal(read.status, 400);
  const ok = await call('POST', `/api/projects/${pid}/repository/file`, { path: 'modules/safe/a.txt', content: 'hi' });
  assert.equal(ok.status, 200);
});

test('F3: ingest destinationPath must live under modules/ (no root, .git, or other dirs)', async () => {
  const manifestBefore = fs.readFileSync(path.join(repoDir, 'moduleforge.json'), 'utf-8');
  const zip = await zipBuf({ 'moduleforge.json': '{"pwned":true}', 'a.txt': 'x', '.git/config': '[core]\nfsmonitor=evil', 'sub/.git/hooks/pre-commit': 'evil' });
  for (const dest of ['.', './', '/', '.git/hooks', 'src', '../x', 'modules/../../x', 'modules', 'modules\\..\\x']) {
    const r = await upload(`/api/projects/${pid}/repository/modules/ingest-zip`, zip, { destinationPath: dest, moduleName: 'evil' });
    assert.equal(r.status, 400, `${dest} -> ${r.status} ${JSON.stringify(r.json)}`);
  }
  assert.equal(fs.readFileSync(path.join(repoDir, 'moduleforge.json'), 'utf-8'), manifestBefore);
  // a legitimate destination works, but .git entries inside the archive are skipped
  const ok = await upload(`/api/projects/${pid}/repository/modules/ingest-zip`, zip, { destinationPath: 'modules/okmod', moduleName: 'okmod' });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(fs.existsSync(path.join(repoDir, 'modules', 'okmod', 'a.txt')), true);
  assert.equal(fs.existsSync(path.join(repoDir, 'modules', 'okmod', '.git')), false);
  assert.equal(fs.existsSync(path.join(repoDir, 'modules', 'okmod', 'sub', '.git')), false);
  assert.equal(fs.readFileSync(path.join(repoDir, '.git', 'config'), 'utf-8').includes('evil'), false);
});

test('F3: git is run with fsmonitor/hooks neutralised even if .git/config is hostile', async () => {
  const marker = path.join(os.tmpdir(), `mf-fsmon-${process.pid}.marker`);
  const script = path.join(os.tmpdir(), `mf-fsmon-${process.pid}.js`);
  fs.writeFileSync(script, `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`);
  created.push(script);
  const cfg = path.join(repoDir, '.git', 'config');
  const saved = fs.readFileSync(cfg, 'utf-8');
  try {
    fs.appendFileSync(cfg, `\n[core]\n\tfsmonitor = node ${script.split(path.sep).join('/')}\n`);
    await gitService.getStatus(repoDir);
    assert.equal(fs.existsSync(marker), false, 'core.fsmonitor command must not run');
  } finally {
    fs.writeFileSync(cfg, saved);
    try { fs.unlinkSync(marker); } catch (_) {}
  }
});

// ── Finding 5: zip bombs ────────────────────────────────────────────────────
test('F5: too many entries is rejected with 413 by validateZipBuffer and the upload routes', async () => {
  const { validateZipBuffer } = require('../validator');
  const files: Record<string, string> = {};
  for (let i = 0; i < 5001; i++) files[`f${i}.txt`] = 'x';
  const buf = await zipBuf(files);
  const v = await validateZipBuffer(buf);
  assert.equal(v.valid, false);
  assert.equal(v.status, 413);
  const r = await upload('/api/modules/upload', buf);
  assert.equal(r.status, 413);
  const r2 = await upload(`/api/projects/${pid}/repository/modules/ingest-zip`, buf, { moduleName: 'bomb' });
  assert.equal(r2.status, 413);
});

test('F5: an entry larger than the per-file limit is rejected before extraction (real default limits)', async () => {
  const { validateZipBuffer } = require('../validator');
  const { extractZipFiles, contentHashOfBuffer } = require('../services/moduleInstall');
  const buf = await zipBuf({ 'module.json': '{}', 'big.bin': Buffer.alloc(26 * 1024 * 1024) });
  assert.ok(buf.length < 1024 * 1024, `bomb should compress well (${buf.length})`);
  const v = await validateZipBuffer(buf);
  assert.equal(v.valid, false);
  assert.equal(v.status, 413);
  await assert.rejects(() => contentHashOfBuffer(buf), /too large|limit/i);
  await assert.rejects(async () => extractZipFiles(await require('../services/zipLimits').loadZip(buf)), /too large|limit/i);
  const r = await upload(`/api/projects/${pid}/repository/modules/ingest-zip`, buf, { moduleName: 'bomb2' });
  assert.equal(r.status, 413);
});

test('F5: total uncompressed size limit and lying metadata are enforced while reading', async () => {
  const { ZIP_LIMITS, loadZip } = require('../services/zipLimits');
  const { extractZipFiles } = require('../services/moduleInstall');
  const saved = { ...ZIP_LIMITS };
  try {
    ZIP_LIMITS.maxTotalBytes = 3 * 1024 * 1024;
    const four = await zipBuf({ 'a.bin': Buffer.alloc(1024 * 1024), 'b.bin': Buffer.alloc(1024 * 1024), 'c.bin': Buffer.alloc(1024 * 1024), 'd.bin': Buffer.alloc(1024 * 1024) });
    await assert.rejects(() => loadZip(four), /too large|limit/i);

    Object.assign(ZIP_LIMITS, saved);
    ZIP_LIMITS.maxFileBytes = 1024 * 1024;
    const big = await zipBuf({ 'liar.bin': Buffer.alloc(3 * 1024 * 1024) });
    const JSZip2 = require('jszip');
    const zip = await JSZip2.loadAsync(big); // bypass the metadata check, then lie about the size
    (zip.files['liar.bin'] as any)._data.uncompressedSize = 10;
    require('../services/zipLimits').assertZipWithinLimits(zip); // passes thanks to the lie
    await assert.rejects(() => extractZipFiles(zip), /limit/i);
  } finally {
    Object.assign(ZIP_LIMITS, saved);
  }
});

// ── Finding 4: marketplace re-install ──────────────────────────────────────
test('F4: ingest-marketplace over an installed module is 409 (use upgrade) and downloads count once', async () => {
  const sp = await moduleZip('reinst-mod', '1.0.0', { 'src/i.js': 'v1' });
  const pub = await call('POST', '/api/modules', { name: 'reinst-mod display', description: 'd', category: 'Accounting', storagePath: sp }, owner);
  assert.equal(pub.status, 201, JSON.stringify(pub.json));
  const sp2 = await moduleZip('reinst-mod', '2.0.0', { 'src/i.js': 'v2' });
  assert.equal((await call('PUT', '/api/modules/reinst-mod', { storagePath: sp2 }, owner)).status, 200);
  const mod = await prisma.module.findUnique({ where: { slug: 'reinst-mod' } });

  const first = await call('POST', `/api/projects/${pid}/repository/modules/ingest-marketplace`, { moduleId: mod.id, version: '1.0.0' }, member);
  assert.equal(first.status, 200, JSON.stringify(first.json));
  const again = await call('POST', `/api/projects/${pid}/repository/modules/ingest-marketplace`, { moduleId: mod.id, version: '2.0.0' }, member);
  assert.equal(again.status, 409, JSON.stringify(again.json));
  assert.match(JSON.stringify(again.json), /upgrade/i);
  const pm = await prisma.projectModule.findFirst({ where: { projectId: pid, moduleId: mod.id } });
  assert.equal(pm.moduleVersion, '1.0.0');
  assert.equal((await prisma.module.findUnique({ where: { id: mod.id } })).downloads, 1);

  // the owner can still upgrade through the upgrade endpoint
  const up = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, { toVersion: '2.0.0' }, owner);
  assert.equal(up.status, 200, JSON.stringify(up.json));
});

test('F4: a second project installing the same module increments downloads', async () => {
  const p2 = await newProject('second');
  const mod = await prisma.module.findUnique({ where: { slug: 'reinst-mod' } });
  const r = await call('POST', `/api/projects/${p2}/repository/modules/ingest-marketplace`, { moduleId: mod.id, version: '2.0.0' }, member);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await prisma.module.findUnique({ where: { id: mod.id } })).downloads, 2);
});

// ── Finding 10: id first, then slug ─────────────────────────────────────────
test('F10: a module whose slug equals another module id cannot shadow it', async () => {
  await prisma.category.upsert({ where: { name: 'Accounting' }, update: {}, create: { name: 'Accounting', slug: 'accounting' } });
  const base = { description: 'd', categoryName: 'Accounting', sourceType: 'upload' };
  // the shadowing row is inserted FIRST so a plain findFirst(OR) hits it before the real owner's module
  const A = await prisma.module.create({ data: { ...base, name: 'attacker mod', slug: 'vic-id-1', author: 'a', authorId: attacker.id } });
  const V = await prisma.module.create({ data: { ...base, id: 'vic-id-1', name: 'victim mod', slug: 'victim-mod', author: 'v', authorId: victim.id } });

  const get = await call('GET', `/api/modules/${V.id}`, undefined, attacker);
  assert.equal(get.status, 200);
  assert.equal(get.json.id, V.id);

  const patch = await call('PATCH', `/api/modules/${V.id}`, { name: 'pwned' }, attacker);
  assert.equal(patch.status, 403);
  assert.equal((await prisma.module.findUnique({ where: { id: V.id } })).name, 'victim mod');
  assert.equal((await prisma.module.findUnique({ where: { id: A.id } })).name, 'attacker mod');
  const del = await call('DELETE', `/api/modules/${V.id}`, undefined, attacker);
  assert.equal(del.status, 403);
});

// ── Finding 11: concurrent publish ──────────────────────────────────────────
test('F11: concurrent publish of the same manifest id yields 201 + 409, never 500', async () => {
  const sps = await Promise.all([1, 2, 3, 4, 5].map((i) => moduleZip('race-mod', '1.0.0', { [`f${i}.txt`]: String(i) })));
  const rs = await Promise.all(sps.map((storagePath) =>
    call('POST', '/api/modules', { name: 'race-mod', description: 'd', category: 'Accounting', storagePath }, owner)));
  const statuses = rs.map((r) => r.status).sort();
  assert.ok(statuses.every((s) => s === 201 || s === 409), `statuses ${statuses}`);
  assert.equal(statuses.filter((s) => s === 201).length, 1, `statuses ${statuses}`);
  assert.equal(await prisma.module.count({ where: { slug: 'race-mod' } }), 1);
});
