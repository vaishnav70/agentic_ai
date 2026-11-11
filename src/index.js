/**
 * Main application entrypoint for StyleScent server.
 *
 * What: Bootstraps the Express HTTP server with health and developer routes,
 * Nonilion webhook stub, JSON body parsing limits, Pino request logging, and global error handlers.
 * Why: Provides the HTTP interface required for Render deployment and local harness testing,
 * satisfying Milestone M0 requirements while keeping unreleased Nonilion features safely stubbed.
 */

import express from 'express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { logger } from './logger.js';
import { handleRequest } from './agent/orchestrator.js';
import { parseIncoming } from './nonilion/adapter.js';
import { loadData } from './data/load.js';

// Load and validate core datasets at startup (fails fast if corrupted or invalid)
const datasets = loadData();

// Read version safely from package.json
let version = '0.1.0';
try {
  const pkg = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  );
  if (pkg.version) {
    version = pkg.version;
  }
} catch {
  // Keep fallback version
}

const app = express();

// Body parser limited to 1 MB as specified in design doc
app.use(express.json({ limit: '1mb' }));

// Landing page: plain status + links, so the deployed URL shows something useful.
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'StyleScent',
    status: 'ok',
    version,
    mode: config.isEchoMode ? 'echo (set LLM_API_KEY + LLM_MODEL for the real agent)' : 'live',
    endpoints: {
      health: 'GET /health',
      chat: 'POST /dev/chat (non-production only)',
      webhook: 'POST /webhook/nonilion (live; tolerant parser until the official Nonilion guide arrives)',
    },
    data: { perfumes: datasets.perfumes.length },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    version,
    data: {
      perfumes: datasets.perfumes.length,
      colour_rules: datasets.colourRules.named_colours.length,
      patterns: datasets.patterns.patterns.length,
      pairing_rules: datasets.patterns.pairing_rules.length,
      tone_mappings: datasets.toneMap.length,
    },
  });
});

// Local dev chat endpoint (enabled only in non-production)
if (config.NODE_ENV !== 'production') {
  app.post('/dev/chat', async (req, res, next) => {
    try {
      const { text, userId, channel } = req.body || {};
      if (typeof text !== 'string') {
        return res
          .status(400)
          .json({ error: 'Request body must include a string "text" property' });
      }

      const response = await handleRequest({
        text,
        userId: userId || 'dev-user',
        channel: channel || 'dev-http',
      });

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  });
}

// Nonilion webhook endpoint — live since the Render deploy (2026-11-11).
// Parses the incoming payload tolerantly (see src/nonilion/adapter.js),
// runs it through the same orchestrator as /dev/chat, and replies inline
// as JSON. File/image attachments are summarised by name/size here — the
// HTTP reply carries no binary bodies. Official Nonilion auth/signature
// verification still waits on the developer guide (see adapter.js TODOs).
app.post('/webhook/nonilion', async (req, res, next) => {
  try {
    const normalized = await parseIncoming(req);
    if (!normalized) {
      return res.status(400).json({
        error: 'Could not find a message text in the webhook payload',
        accepted: 'JSON with a "text" field, e.g. {"text":"Outfit for a college fest","userId":"u1","channel":"general"}',
      });
    }
    const response = await handleRequest(normalized);
    const summarise = (items) =>
      (items || []).map((f) => ({
        name: f.name,
        mime: f.mime,
        sizeBytes: f.buffer ? f.buffer.length : 0,
      }));
    res.status(200).json({
      text: response.text,
      files: summarise(response.files),
      images: summarise(response.images),
      progress: response.progress,
      trace: response.trace,
    });
  } catch (err) {
    next(err);
  }
});

// Central Express error handling middleware
app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled Express error');
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// Global process error handlers to log and keep the server alive
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Global unhandledRejection captured');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Global uncaughtException captured');
});

/**
 * Starts the server on the specified port.
 *
 * @param {number} [port]
 * @returns {Promise<import('node:http').Server>}
 */
export function startServer(port = config.PORT) {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      logger.info(
        { port: actualPort, env: config.NODE_ENV, isEchoMode: config.isEchoMode },
        `StyleScent server running on port ${actualPort}`
      );
      resolve(server);
    });
  });
}

// Start automatically when invoked as the main script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer(config.PORT);
}

export { app };
export default app;
