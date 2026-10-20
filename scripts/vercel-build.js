/**
 * Vercel build script — runs entirely in Node.js to avoid shell path issues.
 * Steps:
 *   1. Run prisma generate (uses schema from server/prisma/schema.prisma)
 *   2. Run vite build (outputs to client/dist)
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

// Detect the DB provider from DATABASE_URL (never log the URL itself).
const schemaPath = path.join(root, 'server', 'prisma', 'schema.prisma');
console.log(`VERCEL_ENV=${process.env.VERCEL_ENV || '(unset)'}`);
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const isPostgres = url.startsWith('postgres://') || url.startsWith('postgresql://');
  const isMysql = url.startsWith('mysql://');
  const targetProvider = isPostgres ? 'postgresql' : isMysql ? 'mysql' : 'sqlite';
  const hostType = targetProvider === 'sqlite' ? 'local file' : 'remote server';
  console.log(`DB provider: ${targetProvider} (${hostType})`);
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const m = /provider\s*=\s*"(postgresql|sqlite|mysql)"/.exec(schema);
    if (m && m[1] === targetProvider) {
      console.log(`✓ schema.prisma provider already "${targetProvider}" (no change)`);
    } else if (m) {
      // Only rewrite when the provider actually differs.
      fs.writeFileSync(schemaPath, schema.replace(m[0], `provider = "${targetProvider}"`), 'utf8');
      console.log(`✓ schema.prisma provider switched "${m[1]}" -> "${targetProvider}"`);
    } else {
      console.error('✗ Could not find a datasource provider in schema.prisma');
      process.exit(1);
    }
  }
} else {
  console.log('DB provider: (DATABASE_URL not set)');
}

// Step 1 — generate Prisma client
try {
  run(
    'prisma generate',
    node,
    [
      path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
      'generate',
      '--schema', path.join(root, 'server', 'prisma', 'schema.prisma'),
    ],
    root
  );
} catch (e) {
  console.warn('prisma generate warning (proceeding if already generated):', e.message);
}

// Step 2 — push schema to database. NO --accept-data-loss: if Prisma would drop data or the push
// fails for any reason, the build FAILS so we never deploy code against a mismatched schema.
if (process.env.DATABASE_URL) {
  try {
    run(
      'prisma db push',
      node,
      [
        path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
        'db', 'push',
        '--schema', path.join(root, 'server', 'prisma', 'schema.prisma'),
        '--skip-generate',
      ],
      root
    );
  } catch (e) {
    console.error('\n✗ prisma db push FAILED — aborting build (schema would not match the code).');
    console.error('  If this is a destructive change, migrate the database deliberately; do not deploy.');
    process.exit(1);
  }
} else {
  console.log('\n⚠ DATABASE_URL not set — skipping prisma db push');
}

// Step 3 — Vite build (runs from client/ dir so vite.config.ts resolves correctly)
run(
  'vite build',
  node,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
  path.join(root, 'client')
);

console.log('\n✅ Vercel build complete → client/dist ready');
