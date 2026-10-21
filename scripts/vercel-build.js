/**
 * Vercel build script — runs entirely in Node.js to avoid shell path issues.
 * Steps:
 *   1. Run prisma generate (uses schema from server/prisma/schema.prisma)
 *   3. Run vite build (outputs to client/dist)
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const node = process.execPath;

function run(label, cmd, args, cwd) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd} ${args.join(' ')}  (cwd: ${cwd})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
  console.log(`✓ ${label} done`);
}

// Decide the DB path (never log the URL). schema.prisma is committed as "postgresql" and is never rewritten;
// sqlite URLs (local builds only) use the derived schema.sqlite.prisma.
const { planDbStep } = require('./build-plan');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const migrationsDir = path.join(root, 'server', 'prisma', 'migrations');
const plan = planDbStep(process.env, fs.existsSync(migrationsDir));
console.log(`VERCEL_ENV=${process.env.VERCEL_ENV || '(unset)'}`);
console.log(`DB provider: ${plan.provider || '(none)'} | schema: ${plan.schema || '(none)'} | step: ${plan.action} (${plan.reason})`);
if (plan.action === 'error') {
  console.error(`\n✗ ${plan.reason}`);
  process.exit(1);
}
if (plan.schema === 'schema.sqlite.prisma') {
  execFileSync(node, [path.join(__dirname, 'make-sqlite-schema.js')], { stdio: 'inherit' });
}
const schemaArg = path.join(root, 'server', 'prisma', plan.schema);

// Step 1 — generate Prisma client
try {
  run('prisma generate', node, [prismaCli, 'generate', '--schema', schemaArg], root);
} catch (e) {
  console.warn('prisma generate warning (proceeding if already generated):', e.message);
}

// Step 2 — bring the database to the current schema.
//  migrate-deploy: only when USE_MIGRATE=true (after the owner completed docs/MIGRATIONS.md).
//  db-push (default): NO --accept-data-loss; the build FAILS rather than deploy against a mismatched schema.
if (plan.action === 'migrate-deploy') {
  try {
    run('prisma migrate deploy', node, [prismaCli, 'migrate', 'deploy', '--schema', schemaArg], root);
  } catch (e) {
    console.error('\n✗ prisma migrate deploy FAILED — aborting build. See docs/MIGRATIONS.md (rollback / baseline sections).');
    process.exit(1);
  }
} else if (plan.action === 'db-push') {
  try {
    run('prisma db push', node, [prismaCli, 'db', 'push', '--schema', schemaArg, '--skip-generate'], root);
  } catch (e) {
    console.error('\n✗ prisma db push FAILED — aborting build (schema would not match the code).');
    console.error('  If this is a destructive change, migrate the database deliberately; do not deploy.');
    process.exit(1);
  }
} else {
  console.log('\n⚠ DATABASE_URL not set — skipping database step');
}

// Step 3 — Vite build (runs from client/ dir so vite.config.ts resolves correctly)
run(
  'vite build',
  node,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
  path.join(root, 'client')
);

console.log('\n✅ Vercel build complete → client/dist ready');
