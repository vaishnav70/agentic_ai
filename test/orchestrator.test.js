/**
 * Unit tests for StyleScent orchestrator (Milestone M0).
 *
 * What: Verifies that the orchestrator produces a friendly "Hello from StyleScent" response
 * that repeats the user's text when running in echo mode.
 * Why: Ensures the core contract between NormalizedRequest and NormalizedResponse is satisfied
 * and the baseline interaction pipeline works before integrating specialist agents and tools.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/agent/orchestrator.js';

describe('Orchestrator (Echo Mode)', () => {
  test('returns a friendly greeting and repeats the user text', async () => {
    const input = 'outfit and perfume for a college fest evening';
    const request = {
      text: input,
      userId: 'test-user-1',
      channel: 'room-general',
    };

    const response = await handleRequest(request);

    assert.ok(response);
    assert.equal(typeof response.text, 'string');
    assert.match(response.text, /Hello from StyleScent/i);
    assert.match(response.text, /outfit and perfume for a college fest evening/);
    assert.ok(Array.isArray(response.files));
    assert.ok(Array.isArray(response.images));
    assert.ok(Array.isArray(response.progress));
    assert.ok(response.progress.length > 0);
  });

  test('handles empty input gracefully', async () => {
    const request = {
      text: '',
      userId: 'test-user-2',
    };

    const response = await handleRequest(request);

    assert.ok(response);
    assert.match(response.text, /Hello from StyleScent/i);
    assert.match(response.text, /""/);
  });
});
