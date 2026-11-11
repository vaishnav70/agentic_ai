/**
 * Nonilion Platform Adapter (Milestone M0 Stub).
 *
 * What: Translates Nonilion webhook requests into NormalizedRequest objects and
 * delivers NormalizedResponse results (messages, attachments, progress updates) back to Nonilion.
 * Why: Keeps Nonilion API details isolated behind a clean interface so the agent core
 * is completely decoupled from the chat platform.
 *
 * NOTE: This is a stub implementation for M0. Real endpoints, headers, payloads,
 * and auth verification will be added once the official Nonilion developer guide is provided.
 */

import { logger } from '../logger.js';

/**
 * Parses an incoming HTTP webhook request into a NormalizedRequest.
 *
 * What: Tolerant parser — the official Nonilion payload format is still
 * undocumented, so it accepts the shapes a webhook sender most plausibly
 * uses and normalises them to { text, userId, channel }.
 * Accepted: a top-level `text` (or `content`/`input`) string; the same
 * string nested under `message`, `data` or `event` (e.g.
 * `{ "message": { "text": "...", "from": { "id": "u1" } } }`); user/channel
 * from `userId`/`user_id`/`sender.id`/`from.id` and
 * `channel`/`channelId`/`channel_id`/`room`.
 * Why: A webhook that 501s on every payload cannot be demoed or paired.
 * This lets Nonilion (or any sender using one of these shapes) reach the
 * real orchestrator today; once the official guide arrives, tighten this
 * to the documented format + signature verification.
 * Returns null only when no message text can be found anywhere.
 *
 * @param {import('express').Request} httpRequest
 * @returns {Promise<import('./types.js').NormalizedRequest | null>}
 */
export async function parseIncoming(httpRequest) {
  // TODO(NONILION_GUIDE): Verify Nonilion request signature/auth token once documented.
  // TODO(NONILION_GUIDE): Tighten this to the official Nonilion webhook payload format.
  const body = httpRequest?.body;
  if (!body || typeof body !== 'object') {
    return null;
  }

  const pickText = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 3) return null;
    for (const key of ['text', 'content', 'input']) {
      if (typeof obj[key] === 'string' && obj[key].trim() !== '') return obj[key];
    }
    for (const key of ['message', 'data', 'event', 'payload']) {
      const found = pickText(obj[key], depth + 1);
      if (found) return found;
    }
    return null;
  };

  const text = pickText(body);
  if (!text) {
    logger.info({ body }, '[Nonilion Adapter] parseIncoming: no message text found');
    return null;
  }

  const userId =
    body.userId ||
    body.user_id ||
    body.sender?.id ||
    body.from?.id ||
    body.message?.from?.id ||
    body.message?.sender?.id ||
    'nonilion-user';
  const channel =
    body.channel ||
    body.channelId ||
    body.channel_id ||
    body.room ||
    body.message?.channel ||
    'nonilion';

  return { text, userId: String(userId), channel: String(channel) };
}

/**
 * Sends a Markdown text message to the specified Nonilion target (channel or user).
 *
 * @param {string} target - The channel ID or user ID destination.
 * @param {string} markdown - The text message formatted in Markdown.
 * @returns {Promise<void>}
 */
export async function sendText(target, markdown) {
  // TODO(NONILION_GUIDE): Dispatch POST request to Nonilion Bot API message endpoint.
  // TODO(NONILION_GUIDE): Include required authentication headers and bot pairing code.
  logger.info({ target, markdown }, '[Nonilion Adapter] sendText stub called');
}

/**
 * Sends a file attachment (e.g. CSV shopping list or Markdown outfit plan) to Nonilion.
 *
 * @param {string} target - The destination target.
 * @param {{ name: string, mime: string, buffer: Buffer }} attachment
 * @returns {Promise<void>}
 */
export async function sendFile(target, { name, mime, buffer }) {
  // TODO(NONILION_GUIDE): Implement file upload and delivery according to Nonilion API specification.
  logger.info(
    { target, name, mime, sizeBytes: buffer?.length },
    '[Nonilion Adapter] sendFile stub called'
  );
}

/**
 * Sends an image attachment (e.g. mood-board PNG) to Nonilion.
 *
 * @param {string} target - The destination target.
 * @param {{ name: string, mime: string, buffer: Buffer }} attachment
 * @returns {Promise<void>}
 */
export async function sendImage(target, { name, mime, buffer }) {
  // TODO(NONILION_GUIDE): Implement image upload and delivery according to Nonilion API specification.
  logger.info(
    { target, name, mime, sizeBytes: buffer?.length },
    '[Nonilion Adapter] sendImage stub called'
  );
}

/**
 * Posts an interim progress update notification to Nonilion.
 *
 * @param {string} target - The destination target.
 * @param {string} text - Brief progress status string.
 * @returns {Promise<void>}
 */
export async function postProgress(target, text) {
  // TODO(NONILION_GUIDE): Send ephemeral or status progress update if supported by Nonilion Bot API.
  logger.info({ target, text }, '[Nonilion Adapter] postProgress stub called');
}
