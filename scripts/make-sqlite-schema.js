#!/usr/bin/env node
/**
 * Derives server/prisma/schema.sqlite.prisma (local dev + tests) from the committed source of truth,
 * server/prisma/schema.prisma (provider "postgresql"). Only the datasource provider is swapped, and
 * Postgres-only native type attributes (@db.*) are stripped.
 *
 *   node scripts/make-sqlite-schema.js          # write the file
 *   node scripts/make-sqlite-schema.js --stdout # print instead
 */
const fs = require('fs');
const path = require('path');

const prismaDir = path.resolve(__dirname, '..', 'server', 'prisma');
const SRC = path.join(prismaDir, 'schema.prisma');
const OUT = path.join(prismaDir, 'schema.sqlite.prisma');

const HEADER =
  '// AUTO-GENERATED from schema.prisma by scripts/make-sqlite-schema.js — DO NOT EDIT.\n' +
  '// Used for local dev and tests (SQLite). Edit schema.prisma, then run: npm run db:sqlite-schema\n';

function deriveSqliteSchema(source) {
  const re = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(postgresql|sqlite|mysql)"/;
  if (!re.test(source)) throw new Error('datasource provider not found in schema.prisma');
  let out = source.replace(re, '$1"sqlite"');
  out = out.replace(/[ \t]+@db\.\w+(\([^)]*\))?/g, '');
  return HEADER + out;
}

module.exports = { deriveSqliteSchema, SRC, OUT };

if (require.main === module) {
  const derived = deriveSqliteSchema(fs.readFileSync(SRC, 'utf8'));
  if (process.argv.includes('--stdout')) process.stdout.write(derived);
  else {
    fs.writeFileSync(OUT, derived, 'utf8');
    console.log('wrote ' + path.relative(process.cwd(), OUT));
  }
}
