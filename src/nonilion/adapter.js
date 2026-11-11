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
 * @param {import('express').Request} httpRequest
 * @returns {Promise<import('./types.js').NormalizedRequest | null>}
 */
export async function parseIncoming(httpRequest) {
  // TODO(NONILION_GUIDE): Verify Nonilion request signature/auth token once documented.
  // TODO(NONILION_GUIDE): Parse official Nonilion webhook payload format into NormalizedRequest.
  logger.info({ body: httpRequest?.body }, '[Nonilion Adapter] parseIncoming stub called');
  return null;
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
