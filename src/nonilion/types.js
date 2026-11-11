/**
 * Nonilion Normalized Data Contracts.
 *
 * What: Defines standard JSDoc types for incoming requests and outgoing responses.
 * Why: Isolates all Nonilion-specific messaging formats from the agent core so the core
 * orchestrator operates on a clean, consistent interface regardless of external platform changes.
 */

/**
 * @typedef {object} AttachmentItem
 * @property {string} [name] - File name.
 * @property {string} [mime] - MIME type of the file.
 * @property {Buffer} [buffer] - Raw file buffer content.
 */

/**
 * Normalized input request representation delivered to the agent orchestrator.
 *
 * @typedef {object} NormalizedRequest
 * @property {string} text - The text message sent by the user.
 * @property {AttachmentItem[]} [images] - Optional images attached to the message.
 * @property {string} [userId] - Identifier of the sending user.
 * @property {string} [channel] - Channel or room identifier where the message originated.
 */

/**
 * Normalized output response representation returned by the agent orchestrator.
 *
 * @typedef {object} NormalizedResponse
 * @property {string} text - Markdown formatted text message to send back.
 * @property {AttachmentItem[]} [files] - Generated file attachments (e.g. CSV shopping list, MD plan).
 * @property {AttachmentItem[]} [images] - Generated image attachments (e.g. mood-board PNG).
 * @property {string[]} [progress] - Step-by-step progress updates recorded during planning/execution.
 * @property {object} [trace] - Execution trace metadata (intent, slots, assumptions, plan, toolCalls, relaxed, clarification, llmCalls, totalMs).
 */

export {};
