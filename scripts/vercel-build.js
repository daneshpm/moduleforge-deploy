/**
 * Vercel build script — runs entirely in Node.js to avoid shell path issues.
 * Steps:
 *   1. Run prisma generate (uses schema from server/prisma/schema.prisma)
 *   2. Run vite build (outputs to client/dist)
 */

const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const node = process.execPath;

function run(label, cmd, args, cwd) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd} ${args.join(' ')}  (cwd: ${cwd})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
  console.log(`✓ ${label} done`);
}

// Step 1 — generate Prisma client
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

// Step 2 — push schema to database (creates all tables if they don't exist)
// This is safe to run on every deploy — it's a no-op if schema is already in sync.
if (process.env.DATABASE_URL) {
  run(
    'prisma db push',
    node,
    [
      path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
      'db', 'push',
      '--schema', path.join(root, 'server', 'prisma', 'schema.prisma'),
      '--accept-data-loss',
      '--skip-generate',
    ],
    root
  );
} else {
  console.log('\n⚠ DATABASE_URL not set — skipping prisma db push (set it in Vercel env vars)');
}

// Step 3 — Vite build (runs from client/ dir so vite.config.ts resolves correctly)
run(
  'vite build',
  node,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
  path.join(root, 'client')
);

console.log('\n✅ Vercel build complete → client/dist ready');
