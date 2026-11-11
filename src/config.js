/**
 * Configuration module for StyleScent.
 *
 * What: Centralizes environment variable reading and validation using Zod.
 * Why: Fails fast on misconfiguration at startup, ensures sensitive credentials
 * are never leaked in error logs, and sets up echo mode for Milestone M0 when
 * LLM credentials are absent.
 */

import { z } from 'zod';

// Load .env file natively if present (Node >= 20.6)
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch (err) {
  if (err && err.code !== 'ENOENT') {
    // Re-throw errors other than missing file (e.g., syntax or permission errors)
    throw err;
  }
}

/**
 * Zod schema for environment variables.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  LLM_PROVIDER: z.string().default('gemini'),
  LLM_API_KEY: z.string().optional().transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
  LLM_MODEL: z.string().optional().transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  // Nonilion bot connection variables (to be completed when developer guide arrives)
  NONILION_BASE_URL: z.string().optional().transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
  NONILION_PAIRING_CODE: z.string().optional().transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
  NONILION_WEBHOOK_SECRET: z.string().optional().transform((v) => (v && v.trim() !== '' ? v.trim() : undefined)),
});

/**
 * Validates the provided environment object against envSchema.
 * Throws a clean, safe Error if validation fails without exposing secret values.
 *
 * @param {Record<string, unknown>} rawEnv
 * @returns {z.infer<typeof envSchema> & { isEchoMode: boolean }}
 */
export function validateConfig(rawEnv = process.env) {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${errorDetails}\n(Check your .env file or environment variables. Secrets are redacted.)`
    );
  }

  const data = result.data;
  return {
    ...data,
    isEchoMode: !data.LLM_API_KEY,
  };
}

export const config = validateConfig(process.env);
