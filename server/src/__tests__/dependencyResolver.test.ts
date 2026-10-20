import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, parseDependsOn } from '../services/dependencyResolver';

const invoice = { id: 'invoice', version: '1.2.0', dependsOn: [{ id: 'payment-method', versionRange: '^1.0.0' }] };

test('no dependencies -> nothing missing', () => {
  assert.deepEqual(resolve([], { id: 'x', version: '1.0.0' }), { missing: [], conflicts: [] });
});

test('missing dependency is reported', () => {
  const r = resolve([], invoice);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].id, 'payment-method');
  assert.equal(r.conflicts.length, 0);
});

test('satisfied dependency (matched by alias) is fine', () => {
  const r = resolve([{ id: 'pm-slug-1234', aliases: ['payment-method'], version: '1.4.2' }], invoice);
  assert.deepEqual(r, { missing: [], conflicts: [] });
});

test('version outside range is a conflict', () => {
  const r = resolve([{ id: 'payment-method', version: '2.0.0' }], invoice);
  assert.equal(r.missing.length, 0);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].installedVersion, '2.0.0');
});

test('reverse conflict: installed module requires a different version of the new one', () => {
  const installed = [{ id: 'checkout', version: '1.0.0', dependsOn: [{ id: 'payment-method', versionRange: '^1.0.0' }] }];
  const r = resolve(installed, { id: 'payment-method', version: '2.0.0' });
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].requiredBy, 'checkout');
});

test('legacy modules (no dependsOn) never conflict', () => {
  assert.deepEqual(resolve([{ id: 'old', version: '1.0.0' }], { id: 'new', version: '1.0.0' }), { missing: [], conflicts: [] });
});

test('parseDependsOn tolerates null, garbage and JSON strings', () => {
  assert.deepEqual(parseDependsOn(null), []);
  assert.deepEqual(parseDependsOn('{bad'), []);
  assert.deepEqual(parseDependsOn('[{"id":"a","versionRange":"*"}]'), [{ id: 'a', versionRange: '*' }]);
});
