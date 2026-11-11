/**
 * Unit Tests for In-Memory Session Store (Milestone M3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../src/agent/session.js';

describe('Session Store', () => {
  test('expires entries after TTL using injected clock', () => {
    let now = 100000;
    const store = createSessionStore({
      ttlMs: 5000,
      clock: () => now,
    });

    store.set('ch1', 'user1', { slots: { occasion: 'office' }, lastQuestion: 'occasion' });
    assert.ok(store.get('ch1', 'user1'));

    // Advance clock past TTL
    now += 6000;
    assert.equal(store.get('ch1', 'user1'), null);
  });

  test('isolates sessions by user and channel', () => {
    const store = createSessionStore();
    store.set('ch1', 'userA', { slots: { occasion: 'wedding' } });
    store.set('ch1', 'userB', { slots: { occasion: 'casual' } });
    store.set('ch2', 'userA', { slots: { occasion: 'date_night' } });

    assert.equal(store.get('ch1', 'userA')?.slots?.occasion, 'wedding');
    assert.equal(store.get('ch1', 'userB')?.slots?.occasion, 'casual');
    assert.equal(store.get('ch2', 'userA')?.slots?.occasion, 'date_night');
  });

  test('evicts oldest session when maxSessions cap is reached', () => {
    let now = 1000;
    const store = createSessionStore({
      maxSessions: 2,
      ttlMs: 100000,
      clock: () => now,
    });

    // Insert user1 at t=1000
    store.set('ch', 'u1', { slots: { id: 1 } });
    now += 10;
    // Insert user2 at t=1010
    store.set('ch', 'u2', { slots: { id: 2 } });
    now += 10;
    // Insert user3 at t=1020 -> should evict u1 (oldest)
    store.set('ch', 'u3', { slots: { id: 3 } });

    assert.equal(store.get('ch', 'u1'), null); // Evicted!
    assert.ok(store.get('ch', 'u2'));
    assert.ok(store.get('ch', 'u3'));
  });
});
