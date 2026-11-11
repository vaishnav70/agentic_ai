/**
 * Unit Tests for Fragrance Specialist (Milestone M3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatasets } from '../src/data/load.js';
import { createTools } from '../src/tools/index.js';
import { buildQuery, findFragrances, condenseCaveats } from '../src/agent/fragrance.js';

describe('Fragrance Specialist', () => {
  const data = loadDatasets();
  const tools = createTools(data);

  test('vibe union prioritises user vibes and caps at 4', () => {
    const slots = {
      occasion: 'party',
      vibe: ['playful', 'bold'],
    };
    const mockLook = {
      items: [
        { type: 'top', colourHex: '#800020', formality: 'formal' },
      ],
    };

    const query = buildQuery(slots, mockLook, data);
    assert.ok(query.vibe.length <= 4);
    assert.equal(query.vibe[0], 'playful');
    assert.equal(query.vibe[1], 'bold');
  });

  test('relaxation order activates sequentially and names relaxed fields', () => {
    // Highly restrictive query that forces relaxation. Note: the dataset
    // now HAS budget fragrances (8 since the Nov 2026 expansion), so the
    // old budget-only constraint no longer forces relaxation on its own —
    // the women's + soft-projection + 12h-longevity combination does.
    // marketedFor is never relaxed, so the matcher relaxes projection,
    // season and budget instead.
    const query = {
      occasion: 'college_fest',
      season: 'winter',
      timeOfDay: 'day',
      projection: 'soft',
      minLongevityHours: 12, // extremely high longevity
      budget: 'budget',
      marketedFor: 'women',
    };

    const match = findFragrances(query, data, tools);

    // It should relax (budget and/or longevity) to find matches
    assert.ok(match.results.length > 0);
    assert.equal(match.exact, false);
    assert.ok(match.relaxed.length > 0);
    assert.ok(match.relaxed.some((r) => r.includes('longevity') || r.includes('budget')));
  });

  test('never relaxes avoidNotes, requireNotes, or marketedFor', () => {
    const query = {
      occasion: 'party',
      avoidNotes: ['vanilla'],
      requireNotes: ['non_existent_impossible_note_xyz'],
      marketedFor: 'women', // dataset now has women entries, but the impossible requireNotes still blocks every match
    };

    const match = findFragrances(query, data, tools);
    // Must return empty results, cannot relax requireNotes or marketedFor!
    assert.equal(match.results.length, 0);
    assert.equal(match.reason, 'no close match');
  });

  test('impossible requireNotes returns results [] and "no close match"', () => {
    const query = {
      occasion: 'date_night',
      requireNotes: ['unobtainium_note_12345'],
    };

    const match = findFragrances(query, data, tools);
    assert.equal(match.results.length, 0);
    assert.equal(match.reason, 'no close match');
  });

  test('condenseCaveats dedupes and folds time_of_day and vibe inferences', () => {
    const results = [
      { caveats: ['time_of_day inferred from heuristic table', 'unverified data'] },
      { caveats: ['vibe inferred from heuristic table', 'unverified data'] },
    ];

    const condensed = condenseCaveats(results);
    assert.ok(condensed.length <= 3);
    assert.ok(condensed.some((c) => c.includes('time_of_day and vibe inferred')));
    // 'unverified data' appears only once
    const unverifiedCount = condensed.filter((c) => c.includes('unverified')).length;
    assert.equal(unverifiedCount, 1);
  });
});
