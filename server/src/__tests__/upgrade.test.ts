/**
 * Versioned install + upgrade tests (node:test). Uses a throwaway local SQLite file and the real routers
 * mounted on a small express app (no auth enforcement; a fixed test user is injected).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import JSZip from 'jszip';
import { execSync } from 'child_process';
import type { AddressInfo } from 'net';
import { validateContractInBuffer, validateModuleJsonText, LEGACY_WARNING } from '../validator';
import { selectVersion, summarizeUpdate, planUpgrade, resolveRange } from '../services/moduleInstall';

const dbFile = path.join(os.tmpdir(), `mf-upgrade-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.split(path.sep).join('/')}`;
process.env.NODE_ENV = 'test';
delete process.env.ENFORCE_AUTH;

let server: any;
let base = '';
let prisma: any;
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const created: string[] = [];

function manifest(id: string, version: string, extra: any = {}) {
  return {
    contractVersion: '1',
    id,
    name: id,
    version,
    description: `${id} module`,
    type: 'backend',
    category: 'Accounting',
    permissions: [`${id}.thing.read`],
    events: { publishes: [`${id.replace(/-/g, '_')}.created`] },
    compatibility: { moduleforge: '>=1.0.0' },
    ...extra,
  };
}

async function zipFile(name: string, files: Record<string, string>): Promise<string> {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  const buf = await z.generateAsync({ type: 'nodebuffer' });
  fs.mkdirSync(uploadsDir, { recursive: true });
  const p = path.join(uploadsDir, `test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}-${name}.zip`);
  fs.writeFileSync(p, buf);
  created.push(p);
  return p;
}

async function moduleZip(id: string, version: string, body: Record<string, string> = {}, extra: any = {}) {
  return zipFile(`${id}-${version}`, { 'module.json': JSON.stringify(manifest(id, version, extra)), ...body });
}

async function call(method: string, url: string, body?: any) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

const publish = (id: string, version: string, body: Record<string, string> = {}, extra: any = {}) =>
  moduleZip(id, version, body, extra).then((storagePath) =>
    call('POST', '/api/modules', { name: `${id} display`, description: 'd', category: 'Accounting', storagePath }));

const publishNew = (idOrSlug: string, version: string, body: Record<string, string> = {}, extra: any = {}, more: any = {}) =>
  moduleZip(idOrSlug, version, body, extra).then((storagePath) =>
    call('PUT', `/api/modules/${idOrSlug}`, { storagePath, ...more }));

let userId = '';
async function newProject(name: string) {
  const p = await prisma.project.create({ data: { name, userId, projectType: 'individual' } });
  return p.id as string;
}

before(async () => {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  ({ prisma } = require('../prisma'));
  const user = await prisma.user.create({ data: { email: `u-${Date.now()}@test.local`, name: 'Tester' } });
  userId = user.id;
  const express = require('express');
  const { modulesRouter } = require('../routes/modules');
  const { projectsRouter } = require('../routes/projects');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => { req.user = { id: userId, email: user.email }; next(); });
  app.use('/api/modules', modulesRouter);
  app.use('/api/projects', projectsRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server?.close();
  await prisma?.$disconnect();
  for (const f of created) { try { fs.unlinkSync(f); } catch (_) {} }
  for (const f of [dbFile, dbFile + '-journal']) { try { fs.unlinkSync(f); } catch (_) {} }
});

// ── Pure semver / planning logic ────────────────────────────────────────────

test('semver: range resolution picks the highest satisfying published version', () => {
  const versions = ['1.0.0', '1.2.0', '1.10.0', '2.0.0', '2.1.0-beta.1'];
  assert.equal(resolveRange(versions, '^1.0.0'), '1.10.0');
  assert.equal(resolveRange(versions, '~1.2.0'), '1.2.0');
  assert.equal(resolveRange(versions, '>=1.0.0 <2.0.0'), '1.10.0');
  assert.equal(resolveRange(versions, '^2.0.0'), '2.0.0'); // prerelease excluded
  assert.equal(resolveRange(versions, '^3.0.0'), null);
  assert.deepEqual(selectVersion(versions, { range: '^1.0.0' }), { version: '1.10.0' });
  assert.deepEqual(selectVersion(versions, { version: '1.2.0' }), { version: '1.2.0' });
  assert.equal(selectVersion(versions, { version: '9.9.9' }).status, 404);
  assert.equal(selectVersion(versions, { range: 'not a range' }).status, 400);
  assert.equal(selectVersion(versions, { range: '^3.0.0' }).status, 404);
  assert.deepEqual(selectVersion(['1.0.0', '1.1.0'], {}), { version: '1.1.0' });
});

test('semver: update summary flags breaking (major) bumps and honours the pinned range', () => {
  const versions = ['1.0.0', '1.1.0', '2.0.0'];
  const s = summarizeUpdate('1.0.0', versions, '^1.0.0');
  assert.equal(s.latest, '2.0.0');
  assert.equal(s.latestSatisfyingPinnedRange, '1.1.0');
  assert.equal(s.updateAvailable, true);
  assert.equal(s.breaking, true);
  const minor = summarizeUpdate('1.0.0', ['1.0.0', '1.1.0'], null);
  assert.equal(minor.breaking, false);
  assert.equal(minor.latestSatisfyingPinnedRange, '1.1.0'); // defaults to ^installed
  assert.equal(summarizeUpdate('1.1.0', ['1.0.0', '1.1.0'], null).updateAvailable, false);
});

test('planUpgrade: conflicts only for local edits the upgrade would overwrite; untouched edits are preserved', () => {
  const baseline = { a: 'h1', b: 'h2', c: 'h3', gone: 'h4' };
  const local = { a: 'h1', b: 'EDIT', c: 'EDIT2', extra: 'x' }; // b, c edited, gone deleted
  const next = { a: 'n1', b: 'h2', c: 'n3', d: 'n4' }; // b untouched upstream, c changed upstream
  const plan = planUpgrade(baseline, local, next);
  assert.deepEqual(plan.preserved, ['b']);
  assert.deepEqual(plan.conflicts, [{ path: 'c', kind: 'modified' }]);
  assert.deepEqual(plan.added, ['d']);
  assert.ok(plan.changed.includes('a') && !plan.changed.includes('b'));
  assert.deepEqual(plan.removed, []); // 'gone' was already deleted locally, nothing to remove
  assert.equal(planUpgrade(baseline, { ...baseline }, next).conflicts.length, 0);
  assert.equal(planUpgrade(null, { a: 'x' }, { a: 'y' }).conflicts[0].kind, 'unknown-baseline');
});

// ── Legacy module.json ──────────────────────────────────────────────────────

test('legacy module.json (old slug/technologies shape) is accepted with a warning, not rejected', async () => {
  const r = validateModuleJsonText(JSON.stringify({ name: 'Old', slug: 'old-mod', technologies: ['React'], version: '1.0.0' }));
  assert.equal(r.valid, true);
  assert.equal(r.hasContract, false);
  assert.equal(r.contractVersion, null);
  assert.ok(r.warnings.includes(LEGACY_WARNING));
  assert.ok(r.warnings.some((w) => /not manifest v1/.test(w)));

  const z = new JSZip();
  z.file('module.json', JSON.stringify({ name: 'Old', slug: 'old-mod', technologies: ['React'] }));
  const viaZip = await validateContractInBuffer(await z.generateAsync({ type: 'nodebuffer' }));
  assert.equal(viaZip.valid, true);
  assert.equal(viaZip.hasContract, false);
});

test('a module.json declaring v1 that fails validation is still rejected', async () => {
  const bad1 = validateModuleJsonText(JSON.stringify({ contractVersion: '1', name: 'x' }));
  assert.equal(bad1.valid, false);
  const bad2 = validateModuleJsonText(JSON.stringify({ id: 'x', type: 'backend', name: 'x' })); // id + type, missing the rest
  assert.equal(bad2.valid, false);
  assert.equal(validateModuleJsonText('{ nope').valid, false);

  const res = await publishBadV1();
  assert.equal(res.status, 400);
  assert.ok(res.json.errors.length > 0);
});

async function publishBadV1() {
  const storagePath = await zipFile('bad-v1', { 'module.json': JSON.stringify({ contractVersion: '1', id: 'bad-v1', name: 'x' }) });
  return call('POST', '/api/modules', { name: 'bad v1', description: 'd', storagePath });
}

test('publishing a legacy archive works: no contract columns, warning returned', async () => {
  const storagePath = await zipFile('legacy', { 'module.json': JSON.stringify({ name: 'Legacy Thing', slug: 'legacy-thing', technologies: ['Node'] }), 'index.js': '1' });
  const r = await call('POST', '/api/modules', { name: 'Legacy Thing', description: 'd', storagePath });
  assert.equal(r.status, 201);
  assert.equal(r.json.module.contractVersion, null);
  assert.ok(r.json.warnings.includes(LEGACY_WARNING));
});

// ── slug == manifest id ─────────────────────────────────────────────────────

test('slug is forced to the manifest id, and a second publish of the same id is a clear 409', async () => {
  const first = await publish('slug-force-a', '1.0.0');
  assert.equal(first.status, 201);
  assert.equal(first.json.module.slug, 'slug-force-a'); // not derived from the display name "slug-force-a display"

  const dup = await publish('slug-force-a', '1.0.1');
  assert.equal(dup.status, 409);
  assert.match(dup.json.error, /already published/);
  assert.match(dup.json.error, /PUT \/api\/modules\/slug-force-a/);
  assert.equal(dup.json.slug, 'slug-force-a');
});

test('a name-derived slug that collides with a manifest id cannot steal it (manifest id wins, 409 on dup)', async () => {
  // legacy module whose name-derived slug is "taken-id"
  const legacy = await zipFile('l2', { 'index.js': '1' });
  const l = await call('POST', '/api/modules', { name: 'Taken Id', description: 'd', storagePath: legacy });
  assert.equal(l.json.module.slug, 'taken-id');
  // a v1 module whose id is "taken-id" collides
  const clash = await publish('taken-id', '1.0.0');
  assert.equal(clash.status, 409);
});

test('PUT with an archive whose manifest id belongs to another module is a 409', async () => {
  await publish('slug-owner-x', '1.0.0');
  await publish('slug-owner-y', '1.0.0');
  const r = await publishNew('slug-owner-y', '1.1.0', {}, {}, {});
  assert.equal(r.status, 200);
  const storagePath = await moduleZip('slug-owner-x', '2.0.0');
  const clash = await call('PUT', '/api/modules/slug-owner-y', { storagePath });
  assert.equal(clash.status, 409);
});

// ── Version re-publish rules + contract refresh ─────────────────────────────

test('PUT with a new archive refreshes contract columns and creates a ModuleVersion row; same content is idempotent; different content under the same version is 409', async () => {
  await publish('ver-rules', '1.0.0', { 'a.txt': 'one' });
  const dep = [{ id: 'other-thing', versionRange: '^1.0.0' }];
  const up = await publishNew('ver-rules', '1.1.0', { 'a.txt': 'two' }, { dependsOn: dep }, { changelog: 'second' });
  assert.equal(up.status, 200);
  assert.equal(up.json.versionCreated, true);
  assert.equal(up.json.module.version, '1.1.0');
  assert.deepEqual(JSON.parse(up.json.module.dependsOn), dep); // contract columns refreshed from the archive

  const rows = await prisma.moduleVersion.findMany({ where: { module: { slug: 'ver-rules' } }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(rows.map((r: any) => r.version), ['1.0.0', '1.1.0']);
  assert.equal(rows[1].changelog, 'second');
  assert.ok(rows[1].contentHash);
  assert.equal(rows[0].dependsOn, '[]');

  // identical content re-published (different zip bytes/timestamps) -> accepted, no new row
  const same = await publishNew('ver-rules', '1.1.0', { 'a.txt': 'two' }, { dependsOn: dep });
  assert.equal(same.status, 200);
  assert.equal(same.json.versionCreated, false);
  assert.equal(await prisma.moduleVersion.count({ where: { module: { slug: 'ver-rules' } } }), 2);

  // different content, same version -> 409
  const diff = await publishNew('ver-rules', '1.1.0', { 'a.txt': 'CHANGED' }, { dependsOn: dep });
  assert.equal(diff.status, 409);
  assert.match(diff.json.error, /already published with different content/);

  // publishing an older patch does not move Module.version backwards
  const older = await publishNew('ver-rules', '1.0.5', { 'a.txt': 'patch' });
  assert.equal(older.status, 200);
  const mod = await prisma.module.findUnique({ where: { slug: 'ver-rules' } });
  assert.equal(mod.version, '1.1.0');
  assert.equal(await prisma.moduleVersion.count({ where: { module: { slug: 'ver-rules' } } }), 3);
});

test('PUT with an invalid v1 manifest is rejected and changes nothing', async () => {
  await publish('ver-bad', '1.0.0');
  const storagePath = await zipFile('vb', { 'module.json': JSON.stringify({ contractVersion: '1', id: 'ver-bad', name: 'x', version: 'nope' }) });
  const r = await call('PUT', '/api/modules/ver-bad', { storagePath });
  assert.equal(r.status, 400);
  assert.equal(await prisma.moduleVersion.count({ where: { module: { slug: 'ver-bad' } } }), 1);
});

// ── Install records, upgrade flow ───────────────────────────────────────────

async function moduleId(slug: string) {
  return (await prisma.module.findUnique({ where: { slug } })).id as string;
}
const install = (projectId: string, modId: string, body: any = {}) =>
  call('POST', `/api/projects/${projectId}/repository/modules/ingest-marketplace`, { moduleId: modId, ...body });
const fileOf = (projectId: string, rel: string) => call('GET', `/api/projects/${projectId}/repository/file?path=${encodeURIComponent(rel)}`);

test('marketplace install records exact version, manifest id and pin; supports version and range', async () => {
  await publish('inst-rec', '1.0.0', { 'src/i.js': 'v1' });
  await publishNew('inst-rec', '1.2.0', { 'src/i.js': 'v1.2' });
  await publishNew('inst-rec', '2.0.0', { 'src/i.js': 'v2' });
  const mid = await moduleId('inst-rec');

  const p1 = await newProject('inst-range');
  const r1 = await install(p1, mid, { range: '^1.0.0' });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.equal(r1.json.installedVersion, '1.2.0');
  const pm1 = await prisma.projectModule.findFirst({ where: { projectId: p1 } });
  assert.equal(pm1.moduleVersion, '1.2.0');
  assert.equal(pm1.installedContractId, 'inst-rec');
  assert.equal(pm1.pinnedRange, '^1.0.0');
  assert.ok(pm1.installedAt && pm1.installedHash);
  assert.equal(Object.keys(JSON.parse(pm1.installedFiles)).includes('src/i.js'), true);
  assert.equal((await fileOf(p1, 'modules/inst-rec/src/i.js')).json.content, 'v1.2');

  const p2 = await newProject('inst-exact');
  const r2 = await install(p2, mid, { version: '1.0.0' });
  assert.equal(r2.json.installedVersion, '1.0.0');
  assert.equal((await fileOf(p2, 'modules/inst-rec/src/i.js')).json.content, 'v1');

  assert.equal((await install(await newProject('x1'), mid, { version: '3.0.0' })).status, 404);
  assert.equal((await install(await newProject('x2'), mid, { range: '^9.0.0' })).status, 404);
  // no version/range -> latest
  const p3 = await newProject('inst-latest');
  assert.equal((await install(p3, mid)).json.installedVersion, '2.0.0');
});

test('GET /updates reports installed/latest/pinned-range/breaking/changelog', async () => {
  await publish('upd-feed', '1.0.0', { 'f.txt': '1' });
  const mid = await moduleId('upd-feed');
  const pid = await newProject('upd-feed-proj');
  await install(pid, mid, { range: '^1.0.0' });
  await publishNew('upd-feed', '1.1.0', { 'f.txt': '1.1' }, {}, { changelog: 'minor stuff' });
  await publishNew('upd-feed', '2.0.0', { 'f.txt': '2' }, {}, { changelog: 'big rewrite' });
  const r = await call('GET', `/api/projects/${pid}/updates`);
  assert.equal(r.status, 200);
  const u = r.json.updates[0];
  assert.equal(u.moduleId, mid);
  assert.equal(u.installed, '1.0.0');
  assert.equal(u.latest, '2.0.0');
  assert.equal(u.latestSatisfyingPinnedRange, '1.1.0');
  assert.equal(u.breaking, true);
  assert.equal(u.updateAvailable, true);
  assert.equal(u.changelog, 'big rewrite');
  assert.deepEqual(u.changelogs.map((c: any) => c.version), ['1.1.0', '2.0.0']);
});

test('upgrade: dryRun returns the plan and writes nothing; real upgrade re-ingests, records version, commit and activity', async () => {
  await publish('upg-ok', '1.0.0', { 'src/a.js': 'a1', 'old.txt': 'old' });
  const mid = await moduleId('upg-ok');
  const pid = await newProject('upg-ok-proj');
  await install(pid, mid, { range: '^1.0.0' });
  await publishNew('upg-ok', '1.1.0', { 'src/a.js': 'a2', 'src/new.js': 'n' }, {}, { changelog: 'added new.js' });
  const pm = await prisma.projectModule.findFirst({ where: { projectId: pid } });

  const commitsBefore = await call('GET', `/api/projects/${pid}/repository/commits`);
  const dry = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, { dryRun: true });
  assert.equal(dry.status, 200, JSON.stringify(dry.json));
  assert.equal(dry.json.dryRun, true);
  assert.equal(dry.json.from, '1.0.0');
  assert.equal(dry.json.to, '1.1.0');
  assert.equal(dry.json.breaking, false);
  assert.ok(dry.json.files.changed.includes('src/a.js'));
  assert.ok(dry.json.files.added.includes('src/new.js'));
  assert.ok(dry.json.files.removed.includes('old.txt'));
  assert.deepEqual(dry.json.conflicts, []);

  // nothing written
  const after = await prisma.projectModule.findUnique({ where: { id: pm.id } });
  assert.equal(after.moduleVersion, '1.0.0');
  assert.equal(after.installedHash, pm.installedHash);
  assert.equal((await fileOf(pid, 'modules/upg-ok/src/a.js')).json.content, 'a1');
  assert.equal((await fileOf(pid, 'modules/upg-ok/src/new.js')).status, 500); // does not exist
  const commitsAfterDry = await call('GET', `/api/projects/${pid}/repository/commits`);
  assert.equal(commitsAfterDry.json.history.length, commitsBefore.json.history.length);
  assert.equal(await prisma.moduleCommit.count({ where: { projectModuleId: pm.id } }), 0);

  const real = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, {});
  assert.equal(real.status, 200, JSON.stringify(real.json));
  assert.equal(real.json.applied, true);
  const up = await prisma.projectModule.findUnique({ where: { id: pm.id } });
  assert.equal(up.moduleVersion, '1.1.0');
  assert.notEqual(up.installedHash, pm.installedHash);
  assert.equal((await fileOf(pid, 'modules/upg-ok/src/a.js')).json.content, 'a2');
  assert.equal((await fileOf(pid, 'modules/upg-ok/src/new.js')).json.content, 'n');
  assert.equal((await fileOf(pid, 'modules/upg-ok/old.txt')).status, 500); // removed by the new version
  assert.equal(await prisma.moduleCommit.count({ where: { projectModuleId: pm.id } }), 1);
  assert.ok(await prisma.projectActivity.findFirst({ where: { projectId: pid, action: 'module_upgraded' } }));

  const again = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, {});
  assert.equal(again.json.upToDate, true);
});

test('upgrade is blocked (409 + details) when an installed module depends on the old range of this module', async () => {
  await publish('blk-base', '1.0.0', { 'b.txt': '1' });
  await publishNew('blk-base', '2.0.0', { 'b.txt': '2' });
  await publish('blk-user', '1.0.0', { 'u.txt': '1' }, { dependsOn: [{ id: 'blk-base', versionRange: '^1.0.0' }] });
  const baseId = await moduleId('blk-base');
  const userId2 = await moduleId('blk-user');
  const pid = await newProject('blk-proj');
  assert.equal((await install(pid, baseId, { version: '1.0.0' })).status, 200);
  assert.equal((await install(pid, userId2)).status, 200);
  const pm = await prisma.projectModule.findFirst({ where: { projectId: pid, moduleId: baseId } });

  const r = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, { toVersion: '2.0.0', dryRun: true });
  assert.equal(r.status, 409);
  assert.equal(r.json.blocked, true);
  assert.equal(r.json.conflicts.length, 1);
  assert.equal(r.json.conflicts[0].requiredBy, 'blk-user');
  assert.match(r.json.details[0], /requires blk-base \^1\.0\.0/);
  assert.equal((await prisma.projectModule.findUnique({ where: { id: pm.id } })).moduleVersion, '1.0.0');
});

test('upgrade is blocked when the new version depends on a module that is not in the project', async () => {
  await publish('miss-mod', '1.0.0', { 'm.txt': '1' });
  await publishNew('miss-mod', '1.1.0', { 'm.txt': '2' }, { dependsOn: [{ id: 'not-installed', versionRange: '^1.0.0' }] });
  const mid = await moduleId('miss-mod');
  const pid = await newProject('miss-proj');
  await install(pid, mid, { version: '1.0.0' });
  const pm = await prisma.projectModule.findFirst({ where: { projectId: pid } });
  const r = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, {});
  assert.equal(r.status, 409);
  assert.equal(r.json.missing[0].id, 'not-installed');
});

test('local edits: conflict list (409) unless force; untouched local edits are preserved', async () => {
  await publish('loc-ed', '1.0.0', { 'edited.js': 'orig', 'kept.js': 'orig-kept' });
  const mid = await moduleId('loc-ed');
  const pid = await newProject('loc-proj');
  await install(pid, mid);
  await publishNew('loc-ed', '1.1.0', { 'edited.js': 'upstream', 'kept.js': 'orig-kept' });
  const pm = await prisma.projectModule.findFirst({ where: { projectId: pid } });

  // user edits both files in the project repo
  await call('POST', `/api/projects/${pid}/repository/file`, { path: 'modules/loc-ed/edited.js', content: 'LOCAL EDIT' });
  await call('POST', `/api/projects/${pid}/repository/file`, { path: 'modules/loc-ed/kept.js', content: 'LOCAL KEPT' });

  const blocked = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, {});
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.json.conflicts, [{ path: 'edited.js', kind: 'modified' }]);
  assert.deepEqual(blocked.json.files.preserved, ['kept.js']);
  assert.equal((await fileOf(pid, 'modules/loc-ed/edited.js')).json.content, 'LOCAL EDIT');
  assert.equal((await prisma.projectModule.findUnique({ where: { id: pm.id } })).moduleVersion, '1.0.0');

  const dry = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, { dryRun: true });
  assert.equal(dry.status, 409); // dry run reports the same conflicts without writing

  const forced = await call('POST', `/api/projects/${pid}/modules/${pm.id}/upgrade`, { force: true });
  assert.equal(forced.status, 200, JSON.stringify(forced.json));
  assert.equal(forced.json.forced, true);
  assert.equal((await fileOf(pid, 'modules/loc-ed/edited.js')).json.content, 'upstream');
  assert.equal((await fileOf(pid, 'modules/loc-ed/kept.js')).json.content, 'LOCAL KEPT');
  assert.equal((await prisma.projectModule.findUnique({ where: { id: pm.id } })).moduleVersion, '1.1.0');
});
