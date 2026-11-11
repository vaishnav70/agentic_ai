/**
 * Unit Tests for Agent Rules and Slot Normalisation (Milestone M3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSeason, BUDGET_BANDS_INR } from '../src/agent/rules.js';
import { normaliseSlots } from '../src/agent/slots.js';

describe('Rules & Slot Normalisation', () => {
  describe('defaultSeason table', () => {
    test('maps months to correct seasons', () => {
      // Dec-Feb -> winter
      assert.equal(defaultSeason(new Date(2026, 11, 15)), 'winter'); // Dec (month 11)
      assert.equal(defaultSeason(new Date(2026, 0, 15)), 'winter');  // Jan (month 0)
      assert.equal(defaultSeason(new Date(2026, 1, 15)), 'winter');  // Feb (month 1)

      // Mar-Apr -> spring
      assert.equal(defaultSeason(new Date(2026, 2, 15)), 'spring');  // Mar (month 2)
      assert.equal(defaultSeason(new Date(2026, 3, 15)), 'spring');  // Apr (month 3)

      // May-Aug -> summer
      assert.equal(defaultSeason(new Date(2026, 4, 15)), 'summer');  // May (month 4)
      assert.equal(defaultSeason(new Date(2026, 7, 15)), 'summer');  // Aug (month 7)

      // Sep-Nov -> autumn
      assert.equal(defaultSeason(new Date(2026, 8, 15)), 'autumn');  // Sep (month 8)
      assert.equal(defaultSeason(new Date(2026, 10, 15)), 'autumn'); // Nov (month 10)
    });
  });

  describe('INR budget band edges', () => {
    const colourRulesFixture = {
      named_colours: [
        { name: 'Navy Blue', hex: '#001f3f' },
        { name: 'Burgundy', hex: '#800020' },
      ],
      neutrals: ['Navy Blue'],
    };

    test('maps INR amounts at band edges 3000 and 8000 correctly', () => {
      // 3000 -> budget
      const r1 = normaliseSlots(
        { budgetInrMax: 3000 },
        { colourRules: colourRulesFixture, clock: () => new Date(2026, 10, 1).getTime() }
      );
      assert.equal(r1.slots.budget, 'budget');

      // 3001 -> mid
      const r2 = normaliseSlots(
        { budgetInrMax: 3001 },
        { colourRules: colourRulesFixture, clock: () => new Date(2026, 10, 1).getTime() }
      );
      assert.equal(r2.slots.budget, 'mid');

      // 8000 -> mid
      const r3 = normaliseSlots(
        { budgetInrMax: 8000 },
        { colourRules: colourRulesFixture, clock: () => new Date(2026, 10, 1).getTime() }
      );
      assert.equal(r3.slots.budget, 'mid');

      // 8001 -> premium
      const r4 = normaliseSlots(
        { budgetInrMax: 8001 },
        { colourRules: colourRulesFixture, clock: () => new Date(2026, 10, 1).getTime() }
      );
      assert.equal(r4.slots.budget, 'premium');
    });
  });

  describe('Colour Name and Defaults Normalisation', () => {
    const colourRulesFixture = {
      named_colours: [
        { name: 'Navy Blue', hex: '#001f3f' },
        { name: 'Burgundy', hex: '#800020' },
      ],
      neutrals: ['Navy Blue'],
    };

    test('exact colour-name matches table hex, and defaults produce assumptions', () => {
      const fixedTime = new Date(2026, 10, 11).getTime(); // Nov 11 -> autumn
      const rawSlots = {
        occasion: 'college_fest',
        garments: [
          { type: 'top', colourName: 'navy blue', pattern: 'solid' },
        ],
      };

      const result = normaliseSlots(rawSlots, {
        colourRules: colourRulesFixture,
        clock: () => fixedTime,
      });

      // Check colour resolution
      assert.equal(result.slots.garments[0].colourHex, '#001f3f');

      // Check season default (autumn)
      assert.equal(result.slots.season, 'autumn');
      assert.ok(result.assumptions.some((a) => a.includes('autumn')));

      // Check timeOfDay default for college_fest (evening)
      assert.equal(result.slots.timeOfDay, 'evening');
      assert.ok(result.assumptions.some((a) => a.includes('evening')));

      // Check garment formality default (casual for college_fest)
      assert.equal(result.slots.garments[0].formality, 'casual');
    });
  });
});
