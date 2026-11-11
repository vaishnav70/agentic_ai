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
      chat_completions: 'POST /v1/chat/completions (OpenAI-compatible, for Nonilion Import)',
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

// OpenAI-compatible chat completions endpoint — added 2026-11-11 so Nonilion
// can import StyleScent via Hire an agent → IMPORT → Other, which only speaks
// OpenAI-compatible APIs ({baseUrl}/chat/completions). The robot-button
// "Connect a bot" flow in the room did nothing when clicked, so this is the
// working route into Nonilion. No auth required: any Authorization header is
// accepted and ignored. Nonilion's Import form refuses an empty API key
// (client-side "Paste your API key"), so the documented placeholder key for
// that form is `stylescent-demo` — it is not a secret and grants nothing.
// Any model name is accepted and ignored. Supports both plain JSON replies
// and SSE streaming.
app.post('/v1/chat/completions', async (req, res, next) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: { message: 'Request body must include a non-empty "messages" array', type: 'invalid_request_error' },
      });
    }
    const lastUser = [...messages].reverse().find((m) => m?.role === 'user');
    const rawContent = lastUser?.content;
    const text = typeof rawContent === 'string'
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent.filter((p) => p?.type === 'text').map((p) => p.text).join('\n')
        : '';
    if (!text || text.trim() === '') {
      return res.status(400).json({
        error: { message: 'The last user message must contain text', type: 'invalid_request_error' },
      });
    }
    const model = typeof req.body?.model === 'string' && req.body.model ? req.body.model : 'stylescent';
    const response = await handleRequest({
      text,
      userId: typeof req.body?.user === 'string' ? req.body.user : 'nonilion-user',
      channel: 'nonilion',
    });
    const completion = {
      id: `chatcmpl-${Date.now().toString(36)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: response.text },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
    if (req.body?.stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const words = response.text.split(/(?<=\s)/);
      for (const word of words) {
        res.write(`data: ${JSON.stringify({
          id: completion.id, object: 'chat.completion.chunk', created: completion.created, model,
          choices: [{ index: 0, delta: { role: 'assistant', content: word }, finish_reason: null }],
        })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({
        id: completion.id, object: 'chat.completion.chunk', created: completion.created, model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    res.status(200).json(completion);
  } catch (err) {
    next(err);
  }
});

// Some OpenAI-compatible clients probe the model list before chatting.
app.get('/v1/models', (req, res) => {
  res.status(200).json({
    object: 'list',
    data: [{ id: 'stylescent', object: 'model', created: 1794405600, owned_by: 'stylescent' }],
  });
});

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
