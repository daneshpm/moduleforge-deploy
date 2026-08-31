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

// Adjust schema provider based on DATABASE_URL
const schemaPath = path.join(root, 'server', 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath) && process.env.DATABASE_URL) {
  try {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    const isPostgres = process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://');
    const isMysql = process.env.DATABASE_URL.startsWith('mysql://');
    const targetProvider = isPostgres ? 'postgresql' : isMysql ? 'mysql' : 'sqlite';
    schema = schema.replace(/provider\s*=\s*"(postgresql|sqlite|mysql)"/, `provider = "${targetProvider}"`);
    fs.writeFileSync(schemaPath, schema, 'utf8');
    console.log(`✓ Schema datasource provider configured as: ${targetProvider}`);
  } catch (err) {
    console.warn('Could not auto-configure schema provider:', err.message);
  }
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

// Step 2 — push schema to database (creates all tables if they don't exist)
if (process.env.DATABASE_URL) {
  try {
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
  } catch (e) {
    console.warn('prisma db push warning:', e.message);
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
