/**
 * Vercel serverless entrypoint for StyleScent.
 *
 * What: Re-exports the Express app from src/index.js as a Vercel Function.
 * Why: Vercel does not run a long-lived `node src/index.js` server; each
 * request is handled by this function instead. src/index.js only calls
 * app.listen() when run directly as the main script, so importing it here
 * is safe — no server is started at import time.
 * Routing: vercel.json rewrites every path to this function.
 */
import app from '../src/index.js';

export default app;
