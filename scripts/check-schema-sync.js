#!/usr/bin/env node
/**
 * CI check: fails if server/prisma/schema.sqlite.prisma has drifted from what
 * scripts/make-sqlite-schema.js derives from server/prisma/schema.prisma, or if schema.prisma
 * is not on provider "postgresql". Fix with: npm run db:sqlite-schema
 */
const fs = require('fs');
const { deriveSqliteSchema, SRC, OUT } = require('./make-sqlite-schema');

const norm = (s) => s.replace(/\r\n/g, '\n');
const source = fs.readFileSync(SRC, 'utf8');
if (!/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/.test(source)) {
  console.error('FAIL: server/prisma/schema.prisma must use provider "postgresql" (committed source of truth).');
  process.exit(1);
}
if (!fs.existsSync(OUT)) {
  console.error('FAIL: schema.sqlite.prisma missing. Run: npm run db:sqlite-schema');
  process.exit(1);
}
if (norm(fs.readFileSync(OUT, 'utf8')) !== norm(deriveSqliteSchema(source))) {
  console.error('FAIL: schema.sqlite.prisma is out of sync with schema.prisma. Run: npm run db:sqlite-schema and commit.');
  process.exit(1);
}
console.log('OK: schema.sqlite.prisma is in sync with schema.prisma');
