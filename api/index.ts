/**
 * Vercel Serverless Function entry point.
 *
 * Vercel routes all /api/* requests here (see vercel.json rewrites).
 * The Express app defined in server/src/index.ts handles the actual routing.
 *
 * NOTE: Vercel serverless functions are stateless — each invocation may run
 * in a fresh container. This means:
 *  - In-memory state is NOT shared between requests.
 *  - The SQLite database (server/prisma/dev.db) is LOCAL only; use a
 *    cloud-hosted Postgres/MySQL/PlanetScale DB in production by updating
 *    DATABASE_URL in the Vercel environment variables.
 *  - File uploads (server/uploads/) are ephemeral; use an object store
 *    (e.g. AWS S3, Cloudflare R2) for persistent file storage.
 *  - SSE (Server-Sent Events) connections for real-time updates will NOT
 *    work reliably on Vercel serverless. Use a managed pub-sub service
 *    (e.g. Pusher, Ably, or Supabase Realtime) for production SSE.
 */

// Load environment variables when running locally via `vercel dev`
import 'dotenv/config';

// Re-export the Express app as the default Vercel handler
export { default } from '../server/src/index';
