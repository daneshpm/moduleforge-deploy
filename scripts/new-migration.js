#!/usr/bin/env node
/**
 * Offline "migrate dev" equivalent (no shadow database needed).
 * Diffs the schema.prisma committed at git HEAD against your working-tree schema.prisma and writes
 * the SQL to server/prisma/migrations/<timestamp>_<name>/migration.sql.
 *   node scripts/new-migration.js add_widget_table
 * Run it BEFORE committing the schema change (HEAD must hold the previous schema). Review the SQL!
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.resolve(__dirname, '..');
const name = (process.argv[2] || '').replace(/[^a-zA-Z0-9_]/g, '_');
if (!name) { console.error('usage: node scripts/new-migration.js <name>'); process.exit(2); }
const old = execFileSync('git', ['show', 'HEAD:server/prisma/schema.prisma'], { cwd: root, encoding: 'utf8' });
const oldFile = path.join(os.tmpdir(), `schema-head-${process.pid}.prisma`);
fs.writeFileSync(oldFile, old);
try {
  const sql = execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'diff',
    '--from-schema-datamodel', oldFile,
    '--to-schema-datamodel', path.join(root, 'server', 'prisma', 'schema.prisma'), '--script',
  ], { cwd: root, encoding: 'utf8' });
  if (/-- This is an empty migration/.test(sql)) { console.log('No schema changes vs HEAD; nothing written.'); process.exit(0); }
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const dir = path.join(root, 'server', 'prisma', 'migrations', `${stamp}_${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'migration.sql'), sql);
  console.log('wrote ' + path.relative(root, dir) + '/migration.sql — review it, then also run: npm run db:sqlite-schema');
} finally { try { fs.unlinkSync(oldFile); } catch {} }
