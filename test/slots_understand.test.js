/**
 * Unit Tests for Slots Schema, Merge, and Understand Repair (Milestone M3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { slotsSchema, mergeSlots, understand } from '../src/agent/slots.js';

describe('Slots Schema & Understanding', () => {
  describe('slotsSchema validation', () => {
    test('accepts valid slots fixture', () => {
      const valid = {
        intent: 'full_look',
        unsupported: [],
        occasion: 'college_fest',
        season: 'autumn',
        timeOfDay: 'evening',
        tone: 'dark',
        colourPrefs: ['navy', 'black'],
        vibe: ['bold', 'confident'],
        projection: 'strong',
        minLongevityHours: 8,
        budgetInrMax: 5000,
        budget: 'mid',
        marketedFor: 'men',
        avoidNotes: ['vanilla', 'musk'],
        requireNotes: ['bergamot'],
        garments: [
          { type: 'top', colourName: 'navy blue', colourHex: '#001f3f', pattern: 'stripes', formality: 'casual' },
        ],
        acknowledgeConflict: false,
      };

      const parsed = slotsSchema.safeParse(valid);
      assert.equal(parsed.success, true);
    });

    test('rejects invalid intent and invalid occasion', () => {
      const invalid = {
        intent: 'invalid_intent',
        occasion: 'space_party',
      };

      const parsed = slotsSchema.safeParse(invalid);
      assert.equal(parsed.success, false);
    });
  });

  describe('mergeSlots', () => {
    test('keeps previous values where next is null or empty', () => {
      const prev = {
        intent: 'full_look',
        occasion: 'college_fest',
        season: 'winter',
        budget: 'mid',
        garments: [{ type: 'top', colourName: 'black', colourHex: '#000000', pattern: 'solid', formality: 'casual' }],
      };

      const next = {
        season: null,
        budget: 'budget', // overridden
        timeOfDay: 'night',
      };

      const merged = mergeSlots(prev, next);
      assert.equal(merged.occasion, 'college_fest');
      assert.equal(merged.season, 'winter');
      assert.equal(merged.budget, 'budget');
      assert.equal(merged.timeOfDay, 'night');
      assert.equal(merged.garments.length, 1);
    });

    test('unions arrays with lowercase deduping, and replaces garments only when next has items', () => {
      const prev = {
        avoidNotes: ['Vanilla', 'musk'],
        colourPrefs: ['blue'],
        garments: [{ type: 'top', colourName: 'blue', colourHex: '#0000ff' }],
      };

      const next = {
        avoidNotes: ['vanilla', 'amber'],
        colourPrefs: ['BLUE', 'grey'],
        garments: [{ type: 'bottom', colourName: 'black', colourHex: '#000000' }],
      };

      const merged = mergeSlots(prev, next);
      assert.deepEqual(merged.avoidNotes.sort(), ['amber', 'musk', 'vanilla']);
      assert.deepEqual(merged.colourPrefs.sort(), ['blue', 'grey']);
      // Garments replaced because next.garments.length > 0
      assert.equal(merged.garments.length, 1);
      assert.equal(merged.garments[0].type, 'bottom');

      // If next garments is empty, keep previous garments
      const mergedNoGarments = mergeSlots(prev, { garments: [] });
      assert.equal(mergedNoGarments.garments.length, 1);
      assert.equal(mergedNoGarments.garments[0].type, 'top');
    });
  });

  describe('understand with 1 repair turn', () => {
    test('succeeds when first call fails validation and second call (repair) is valid', async () => {
      let callCount = 0;
      const fakeLlm = {
        async generateJson() {
          callCount++;
          if (callCount === 1) {
            // Invalid slots (bad intent)
            return { intent: 'bogus_intent' };
          }
          // Repaired valid slots
          return {
            intent: 'full_look',
            occasion: 'college_fest',
            unsupported: [],
          };
        },
      };

      const res = await understand('fest outfit', {}, fakeLlm);
      assert.equal(res.ok, true);
      assert.equal(callCount, 2);
      assert.equal(res.slots.intent, 'full_look');
      assert.equal(res.slots.occasion, 'college_fest');
    });

    test('returns { ok: false } when both initial and repair calls fail', async () => {
      let callCount = 0;
      const fakeLlm = {
        async generateJson() {
          callCount++;
          return { intent: 'bad_intent_' + callCount };
        },
      };

      const res = await understand('something confusing', {}, fakeLlm);
      assert.equal(res.ok, false);
      assert.equal(callCount, 2);
    });
  });
});
