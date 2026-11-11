/**
 * Central logger for StyleScent using Pino.
 *
 * What: Exports a configured Pino logger instance.
 * Why: Provides structured JSON logging across modules, adhering to the configured LOG_LEVEL
 * and enabling trace logging for judging and debugging without leaking sensitive information.
 */

import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
});
