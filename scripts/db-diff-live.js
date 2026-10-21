#!/usr/bin/env node
/**
 * READ-ONLY comparison of the live database against server/prisma/schema.prisma.
 * Prints the SQL that would bring the live DB up to the current schema. Executes NOTHING against the DB
 * (prisma migrate diff only introspects). The URL is read from an env var you supply and never printed.
 *
 *   LIVE_DATABASE_URL="postgresql://..." node scripts/db-diff-live.js [--out diff.sql]
 *   (use a Neon BRANCH copy URL if you can; env var name override: DIFF_URL_VAR=OTHER_NAME)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const varName = process.env.DIFF_URL_VAR || 'LIVE_DATABASE_URL';
const url = process.env[varName];
if (!url) {
  console.error(`Set ${varName} to the live Postgres URL first (it is never printed).`);
  process.exit(2);
}
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error(`${varName} must be a postgres:// or postgresql:// URL.`);
  process.exit(2);
}
const outIdx = process.argv.indexOf('--out');
const outFile = outIdx > -1 ? process.argv[outIdx + 1] : null;

// The URL is passed through the child's environment (--from-url takes a literal, so use schema-less env form):
// we write a throwaway datasource schema reference via env, keeping the URL out of argv/process listings.
const tmpSchema = path.join(require('os').tmpdir(), `live-introspect-${process.pid}.prisma`);
fs.writeFileSync(tmpSchema, 'datasource db {\n  provider = "postgresql"\n  url = env("DIFF_LIVE_URL")\n}\n');
try {
  const res = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
      'migrate', 'diff',
      '--from-schema-datasource', tmpSchema,
      '--to-schema-datamodel', path.join(root, 'server', 'prisma', 'schema.prisma'),
      '--script',
    ],
    { cwd: root, env: { ...process.env, DIFF_LIVE_URL: url }, encoding: 'utf8' }
  );
  const scrub = (s) => (s || '').split(url).join('<redacted>');
  if (res.status !== 0) {
    console.error(scrub(res.stderr) || 'prisma migrate diff failed');
    process.exit(res.status || 1);
  }
  const sql = scrub(res.stdout);
  if (outFile) { fs.writeFileSync(outFile, sql); console.log(`Diff written to ${outFile} (${sql.split('\n').length} lines). Review before applying.`); }
  else process.stdout.write(sql);
} finally {
  try { fs.unlinkSync(tmpSchema); } catch {}
}
