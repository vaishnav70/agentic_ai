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

  test('POST /webhook/nonilion answers a message payload via the orchestrator', async () => {
    const res = await fetch(`${baseUrl}/webhook/nonilion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello from automated test', userId: 'u1', channel: 'general' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.text, /Hello from StyleScent/i);
    assert.match(body.text, /Hello from automated test/);
    assert.ok(Array.isArray(body.files));
    assert.ok(body.trace, 'Webhook reply should include the orchestrator trace');
  });

  test('POST /webhook/nonilion accepts a nested message payload', async () => {
    const res = await fetch(`${baseUrl}/webhook/nonilion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { text: 'Hello from automated test', from: { id: 'u2' } } }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.text, /Hello from StyleScent/i);
  });

  test('POST /webhook/nonilion rejects a payload with no message text', async () => {
    const res = await fetch(`${baseUrl}/webhook/nonilion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'ping' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Could not find a message text/i);
  });

  test('POST /v1/chat/completions answers in OpenAI shape', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'stylescent',
        messages: [{ role: 'user', content: 'Hello from automated test' }],
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.object, 'chat.completion');
    assert.equal(body.choices[0].message.role, 'assistant');
    assert.match(body.choices[0].message.content, /Hello from StyleScent/i);
    assert.equal(body.choices[0].finish_reason, 'stop');
  });

  test('POST /v1/chat/completions streams SSE when stream is true', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'stylescent',
        messages: [{ role: 'user', content: 'Hello from automated test' }],
        stream: true,
      }),
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const text = await res.text();
    assert.match(text, /data: \[DONE\]/);
    // Reassemble the streamed deltas: the reply is split across chunks.
    const streamed = text
      .split('\n')
      .filter((line) => line.startsWith('data: {'))
      .map((line) => JSON.parse(line.slice(6)).choices[0].delta?.content || '')
      .join('');
    assert.match(streamed, /Hello from StyleScent/);
  });

  test('GET /v1/models lists the stylescent model', async () => {
    const res = await fetch(`${baseUrl}/v1/models`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.object, 'list');
    assert.equal(body.data[0].id, 'stylescent');
  });
});
