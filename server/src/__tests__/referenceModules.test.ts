import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { validateManifestText } from '../validator';

const root = path.resolve(__dirname, '../../../reference-modules');
const dirs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'module.json')))
  .map((d) => d.name);

test('reference modules directory is discovered', () => {
  assert.ok(dirs.length >= 3, `expected at least 3 reference modules, found ${dirs.join(', ')}`);
});

for (const name of dirs) {
  test(`reference module "${name}" module.json satisfies the contract`, () => {
    const r = validateManifestText(fs.readFileSync(path.join(root, name, 'module.json'), 'utf8'));
    assert.deepEqual(r.errors, []);
    assert.equal(r.valid, true);
  });
}
