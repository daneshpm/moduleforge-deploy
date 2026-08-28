/**
 * Vercel Serverless Function entry point.
 */
import 'dotenv/config';
import app from '../server/src/index';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Unhandled serverless function error:', err);
    if (!res.headersSent) {
      res.status(200).json({ success: false, error: err.message, isFallback: true });
    }
  }
}
