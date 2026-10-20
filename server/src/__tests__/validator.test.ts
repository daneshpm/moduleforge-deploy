import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { validateManifestObject, validateManifestText, validateZipBuffer, validateContractInTree, LEGACY_WARNING } from '../validator';
import { validManifest } from './fixtures';

const clone = () => JSON.parse(JSON.stringify(validManifest));

async function zipOf(files: Record<string, string>) {
  const z = new JSZip();
  for (const [k, v] of Object.entries(files)) z.file(k, v);
  return z.generateAsync({ type: 'nodebuffer' });
}

test('valid manifest passes with contractVersion 1', () => {
  const r = validateManifestObject(validManifest);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
  assert.equal(r.contractVersion, '1');
});

test('missing required fields are reported', () => {
  const r = validateManifestObject({ name: 'x' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.length >= 4);
  assert.equal(r.contractVersion, null);
});

test('bad slug, semver, type and category are rejected', () => {
  const m = clone();
  m.id = 'Bad Id';
  m.version = '1.0';
  m.type = 'mobile';
  m.category = 'Nope';
  const r = validateManifestObject(m);
  const paths = r.errors.map((e) => e.path);
  for (const p of ['/id', '/version', '/type', '/category']) assert.ok(paths.includes(p), p);
});

test('unknown top-level keys are rejected', () => {
  assert.equal(validateManifestObject({ ...clone(), slug: 'invoice' }).valid, false);
});

test('permissions and events must be namespaced with the module id', () => {
  const m = clone();
  m.permissions = ['other.invoice.read'];
  m.events.publishes = ['other.created'];
  const r = validateManifestObject(m);
  assert.deepEqual(r.errors.map((e) => e.path).sort(), ['/events/publishes/0', '/permissions/0']);
});

test('invalid semver ranges and self dependency are rejected', () => {
  const m = clone();
  m.dependsOn = [{ id: 'invoice', versionRange: 'not-a-range' }];
  m.compatibility.moduleforge = 'garbage';
  const r = validateManifestObject(m);
  assert.ok(r.errors.some((e) => e.message.includes('itself')));
  assert.ok(r.errors.some((e) => e.path === '/dependsOn/0/versionRange'));
  assert.ok(r.errors.some((e) => e.path === '/compatibility/moduleforge'));
});

test('table names must honour the declared prefix; unknown host service warns', () => {
  const m = clone();
  m.requires.database.tables = ['users'];
  const r = validateManifestObject(m);
  assert.ok(r.errors.some((e) => e.path === '/requires/database/tables/0'));
  const ok = clone();
  ok.requires.hostServices = ['teleport'];
  const r2 = validateManifestObject(ok);
  assert.equal(r2.valid, true);
  assert.ok(r2.warnings.some((w) => w.includes('teleport')));
});

test('non-JSON module.json gives a structured error', () => {
  const r = validateManifestText('{ nope');
  assert.equal(r.valid, false);
  assert.equal(r.errors[0].path, '/');
});

test('zip with valid module.json (inside a root folder) is validated', async () => {
  const buf = await zipOf({ 'repo-abc/module.json': JSON.stringify(validManifest), 'repo-abc/index.js': '1' });
  const r = await validateZipBuffer(buf);
  assert.equal(r.valid, true);
  assert.equal(r.contract?.valid, true);
  assert.equal(r.contract?.contractVersion, '1');
  assert.equal(r.extractedMetadata?.slug, 'invoice');
});

test('zip with invalid module.json is still a valid zip but contract has errors', async () => {
  const buf = await zipOf({ 'module.json': JSON.stringify({ name: 'x' }) });
  const r = await validateZipBuffer(buf);
  assert.equal(r.valid, true);
  assert.equal(r.contract?.hasContract, true);
  assert.equal(r.contract?.valid, false);
});

test('legacy zip without module.json imports with warning and null contractVersion', async () => {
  const buf = await zipOf({ 'index.js': 'console.log(1)' });
  const r = await validateZipBuffer(buf);
  assert.equal(r.valid, true);
  assert.equal(r.contract?.hasContract, false);
  assert.equal(r.contract?.contractVersion, null);
  assert.ok(r.warnings?.includes(LEGACY_WARNING));
});

test('corrupt and empty zips still fail as before', async () => {
  assert.equal((await validateZipBuffer(Buffer.from('not a zip'))).valid, false);
  assert.equal((await validateZipBuffer(await zipOf({}))).valid, false);
});

test('github-style file tree validation', () => {
  assert.equal(validateContractInTree({ 'a/module.json': JSON.stringify(validManifest) }).valid, true);
  assert.equal(validateContractInTree({ 'a/readme.md': 'x' }).warnings[0], LEGACY_WARNING);
});
