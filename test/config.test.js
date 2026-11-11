/**
 * Unit tests for environment configuration validation.
 *
 * What: Validates that valid environment variables pass validation and invalid variables
 * fail fast with clean, informative error messages, without leaking secrets.
 * Why: Guarantees deployment and runtime stability by catching misconfigurations early.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config.js';

describe('Configuration Validation', () => {
  test('valid minimal environment passes with default echo mode', () => {
    const rawEnv = {
      NODE_ENV: 'test',
    };

    const cfg = validateConfig(rawEnv);
    assert.equal(cfg.NODE_ENV, 'test');
    assert.equal(cfg.PORT, 3000);
    assert.equal(cfg.LOG_LEVEL, 'info');
    assert.equal(cfg.isEchoMode, true);
  });

  test('valid environment with LLM key disables echo mode', () => {
    const rawEnv = {
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      LLM_API_KEY: 'secret-key-12345',
      LLM_MODEL: 'gemini-2.5-flash',
    };

    const cfg = validateConfig(rawEnv);
    assert.equal(cfg.NODE_ENV, 'production');
    assert.equal(cfg.PORT, 8080);
    assert.equal(cfg.LOG_LEVEL, 'debug');
    assert.equal(cfg.isEchoMode, false);
    assert.equal(cfg.LLM_MODEL, 'gemini-2.5-flash');
  });

  test('invalid PORT fails validation', () => {
    const rawEnv = {
      PORT: 'invalid-port',
    };

    assert.throws(
      () => validateConfig(rawEnv),
      (err) => {
        assert.match(err.message, /PORT/);
        return true;
      }
    );
  });

  test('out-of-range PORT fails validation', () => {
    const rawEnv = {
      PORT: '999999',
    };

    assert.throws(
      () => validateConfig(rawEnv),
      (err) => {
        assert.match(err.message, /PORT/);
        return true;
      }
    );
  });

  test('invalid LOG_LEVEL fails validation', () => {
    const rawEnv = {
      LOG_LEVEL: 'super-verbose',
    };

    assert.throws(
      () => validateConfig(rawEnv),
      (err) => {
        assert.match(err.message, /LOG_LEVEL/);
        return true;
      }
    );
  });

  test('error message never prints secret values', () => {
    const secret = 'super-secret-token-value';
    const rawEnv = {
      PORT: 'bad-port',
      NONILION_WEBHOOK_SECRET: secret,
    };

    try {
      validateConfig(rawEnv);
      assert.fail('Should have thrown an error');
    } catch (err) {
      assert.equal(err.message.includes(secret), false);
    }
  });
});
