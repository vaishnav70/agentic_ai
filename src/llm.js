/**
 * LLM Client Module for StyleScent using @google/genai.
 *
 * What: Lightweight wrapper providing `generateText` and `generateJson` with timeout enforcement,
 * transient error retry, and structured JSON parsing.
 * Why: Encapsulates all LLM provider details, enables clean dependency injection for unit tests,
 * and ensures robust error handling with dedicated LlmError and LlmJsonError types.
 */

import { GoogleGenAI } from '@google/genai';
import { config as defaultConfig } from './config.js';

/**
 * Error thrown when an LLM call fails due to network, timeout, or API status.
 */
export class LlmError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'LlmError';
    this.status = options.status;
    this.cause = options.cause;
  }
}

/**
 * Error thrown when LLM text generation succeeds but output cannot be parsed as JSON.
 */
export class LlmJsonError extends LlmError {
  constructor(message, rawText, options = {}) {
    super(message, options);
    this.name = 'LlmJsonError';
    this.rawText = rawText;
  }
}

/**
 * Helper to execute a promise with a timeout in milliseconds.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new LlmError(`LLM call timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Factory creating an LLM client instance with generateText and generateJson.
 * Returns null if LLM_API_KEY or LLM_MODEL is missing.
 *
 * @param {object} [cfg]
 * @returns {{ generateText: Function, generateJson: Function } | null}
 */
export function createLlm(cfg = defaultConfig) {
  if (!cfg.LLM_API_KEY || !cfg.LLM_MODEL) {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: cfg.LLM_API_KEY });
  const timeoutMs = cfg.LLM_TIMEOUT_MS || 20000;

  /**
   * Internal execution with single retry for transient failures.
   *
   * @param {object} params
   * @returns {Promise<string>}
   */
  async function executeCall(params) {
    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      try {
        const callPromise = ai.models.generateContent(params);
        const response = await withTimeout(callPromise, timeoutMs);
        return response.text ?? '';
      } catch (err) {
        if (attempt >= 2) {
          if (err instanceof LlmError) throw err;
          throw new LlmError(`LLM call failed: ${err.message}`, { cause: err });
        }
        // Short backoff before retry (500ms)
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw new LlmError('LLM call failed after retries.');
  }

  /**
   * Generates raw text response.
   *
   * @param {string} prompt
   * @param {object} [options]
   * @param {string} [options.system]
   * @param {number} [options.temperature]
   * @returns {Promise<string>}
   */
  async function generateText(prompt, { system, temperature } = {}) {
    /** @type {import('@google/genai').GenerateContentParameters} */
    const params = {
      model: cfg.LLM_MODEL,
      contents: prompt,
    };

    if (system || temperature !== undefined) {
      params.config = {};
      if (system) params.config.systemInstruction = system;
      if (temperature !== undefined) params.config.temperature = temperature;
    }

    return executeCall(params);
  }

  /**
   * Generates and parses a JSON response from the LLM.
   *
   * @param {string} prompt
   * @param {object} [options]
   * @param {string} [options.system]
   * @param {number} [options.temperature=0.1]
   * @returns {Promise<any>}
   */
  async function generateJson(prompt, { system, temperature = 0.1 } = {}) {
    /** @type {import('@google/genai').GenerateContentParameters} */
    const params = {
      model: cfg.LLM_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature,
      },
    };

    if (system) {
      params.config.systemInstruction = system;
    }

    const rawText = await executeCall(params);

    // Strip optional markdown fences if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      throw new LlmJsonError(
        `Failed to parse LLM response as JSON: ${err.message}`,
        rawText,
        { cause: err }
      );
    }
  }

  return {
    generateText,
    generateJson,
  };
}

// Global default wrapper for backwards compatibility with M0
const defaultClient = createLlm(defaultConfig);

export async function generateText(prompt, options = {}) {
  if (!defaultClient) {
    throw new Error('LLM is not configured (missing LLM_API_KEY or LLM_MODEL).');
  }
  return defaultClient.generateText(prompt, options);
}
