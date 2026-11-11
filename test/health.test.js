/**
 * HTTP integration tests for server endpoints.
 *
 * What: Validates GET /health, POST /dev/chat, and POST /webhook/nonilion endpoints.
 * Why: Proves the Express application binds and listens on arbitrary ports, responds correctly
 * to monitoring probes (required for Render deployment), handles dev chats, and safely stubs
 * unreleased Nonilion endpoints with HTTP 501.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../src/index.js';

describe('Server Endpoints', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Start server on port 0 to bind to an available random port
    server = await startServer(0);
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('GET /health returns 200 with status "ok" and dataset counts', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0);
    assert.equal(typeof body.version, 'string');
    assert.ok(body.data, 'Health check should include data counts');
    assert.equal(typeof body.data.perfumes, 'number');
    assert.ok(body.data.perfumes > 0);
    assert.equal(typeof body.data.colour_rules, 'number');
    assert.equal(typeof body.data.patterns, 'number');
    assert.equal(typeof body.data.pairing_rules, 'number');
    assert.equal(typeof body.data.tone_mappings, 'number');
  });

  test('POST /dev/chat returns orchestrator response in development', async () => {
    const res = await fetch(`${baseUrl}/dev/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello from automated test' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.text, /Hello from StyleScent/i);
    assert.match(body.text, /Hello from automated test/);
  });

  test('POST /dev/chat rejects missing text property with 400', async () => {
    const res = await fetch(`${baseUrl}/dev/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
  });

  test('POST /webhook/nonilion returns 501 Not Implemented', async () => {
    const res = await fetch(`${baseUrl}/webhook/nonilion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'ping' }),
    });

    assert.equal(res.status, 501);
    const body = await res.json();
    assert.equal(body.status, 'not_implemented');
    assert.match(body.message, /Waiting for official Nonilion developer guide/i);
  });
});
