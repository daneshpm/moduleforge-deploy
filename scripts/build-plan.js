/**
 * Pure decision logic for the DB step of scripts/vercel-build.js (unit-tested in build-plan.test.js).
 * Never includes the DATABASE_URL in its output.
 */
function planDbStep(env, migrationsDirExists) {
  const url = env.DATABASE_URL;
  if (!url) {
    return { provider: null, schema: 'schema.prisma', action: 'skip', reason: 'DATABASE_URL not set' };
  }
  let provider;
  if (/^postgres(ql)?:\/\//.test(url)) provider = 'postgresql';
  else if (/^file:/.test(url)) provider = 'sqlite';
  else return { provider: null, schema: null, action: 'error', reason: 'DATABASE_URL must be postgres(ql):// or file: (mysql etc. unsupported)' };

  const schema = provider === 'sqlite' ? 'schema.sqlite.prisma' : 'schema.prisma';
  const wantMigrate = String(env.USE_MIGRATE || '').toLowerCase() === 'true';
  if (wantMigrate) {
    if (provider !== 'postgresql') return { provider, schema, action: 'error', reason: 'USE_MIGRATE=true requires a postgres DATABASE_URL (migrations are Postgres SQL)' };
    if (!migrationsDirExists) return { provider, schema, action: 'error', reason: 'USE_MIGRATE=true but server/prisma/migrations does not exist' };
    return { provider, schema, action: 'migrate-deploy', reason: 'USE_MIGRATE=true and migrations folder present' };
  }
  return { provider, schema, action: 'db-push', reason: 'USE_MIGRATE not "true" (default: strict db push, no --accept-data-loss)' };
}
module.exports = { planDbStep };
