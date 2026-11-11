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

// Nonilion webhook endpoint (stub for M0)
app.post('/webhook/nonilion', (req, res) => {
  // TODO(NONILION_GUIDE): Implement authentication verification and request dispatching
  // once the official Nonilion developer guide is provided.
  logger.info({ body: req.body }, 'Received request on /webhook/nonilion stub');
  res.status(501).json({
    status: 'not_implemented',
    message: 'Webhook handler is not implemented. Waiting for official Nonilion developer guide.',
  });
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
