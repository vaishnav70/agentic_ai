/**
 * In-Memory Session Store for StyleScent AI.
 *
 * What: Manages multi-turn conversation memory keyed by channel and userId.
 * Why: Allows users to provide follow-up answers (e.g., answering clarification questions,
 * adding constraints like "no vanilla", or changing preferences) across multiple turns
 * while enforcing TTL expiry and memory bounds (LRU/oldest-first eviction).
 */

import { SESSION_TTL_MS, SESSION_MAX } from './rules.js';

/**
 * Creates an in-memory session store.
 *
 * @param {Object} [options]
 * @param {number} [options.ttlMs] Time-to-live in milliseconds
 * @param {number} [options.maxSessions] Maximum allowed sessions before eviction
 * @param {() => number} [options.clock] Clock function returning timestamp in ms
 */
export function createSessionStore({
  ttlMs = SESSION_TTL_MS,
  maxSessions = SESSION_MAX,
  clock = () => Date.now(),
} = {}) {
  /** @type {Map<string, { slots: any, lastQuestion: string|null, updatedAt: number }>} */
  const sessions = new Map();

  /**
   * Helper to format composite session key.
   * @param {string} channel
   * @param {string} userId
   * @returns {string}
   */
  function makeKey(channel, userId) {
    return `${channel || 'default'}:${userId || 'anonymous'}`;
  }

  /**
   * Purges expired sessions.
   */
  function purgeExpired() {
    const now = clock();
    for (const [key, entry] of sessions.entries()) {
      if (now - entry.updatedAt > ttlMs) {
        sessions.delete(key);
      }
    }
  }

  return {
    /**
     * Gets a session if present and not expired.
     * @param {string} channel
     * @param {string} userId
     * @returns {{ slots: any, lastQuestion: string|null, updatedAt: number } | null}
     */
    get(channel, userId) {
      const key = makeKey(channel, userId);
      const entry = sessions.get(key);
      if (!entry) return null;

      if (clock() - entry.updatedAt > ttlMs) {
        sessions.delete(key);
        return null;
      }

      return {
        slots: entry.slots ? JSON.parse(JSON.stringify(entry.slots)) : null,
        lastQuestion: entry.lastQuestion,
        updatedAt: entry.updatedAt,
      };
    },

    /**
     * Sets or updates a session. Evicts expired and oldest sessions if capacity is exceeded.
     * @param {string} channel
     * @param {string} userId
     * @param {{ slots?: any, lastQuestion?: string|null }} data
     */
    set(channel, userId, data) {
      purgeExpired();

      const key = makeKey(channel, userId);

      // If at capacity and adding a new key, evict oldest
      if (sessions.size >= maxSessions && !sessions.has(key)) {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [k, v] of sessions.entries()) {
          if (v.updatedAt < oldestTime) {
            oldestTime = v.updatedAt;
            oldestKey = k;
          }
        }
        if (oldestKey) {
          sessions.delete(oldestKey);
        }
      }

      const entry = {
        slots: data.slots ? JSON.parse(JSON.stringify(data.slots)) : null,
        lastQuestion: data.lastQuestion !== undefined ? data.lastQuestion : null,
        updatedAt: clock(),
      };

      sessions.set(key, entry);
      return entry;
    },

    /**
     * Clears a specific session.
     * @param {string} channel
     * @param {string} userId
     */
    clear(channel, userId) {
      const key = makeKey(channel, userId);
      sessions.delete(key);
    },

    /**
     * Clears all sessions.
     */
    clearAll() {
      sessions.clear();
    },

    /**
     * Returns the active session count (purging expired first).
     * @returns {number}
     */
    size() {
      purgeExpired();
      return sessions.size;
    },
  };
}

export const defaultSessionStore = createSessionStore();
