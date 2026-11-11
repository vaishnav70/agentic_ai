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
    // Highly restrictive query that forces relaxation. Note: the women's
    // pool is now too broad to force it — Fantasy and Club de Nuit Woman
    // (budget, soft, long-lasting) match almost any women+budget
    // combination exactly, and longevity is only a scoring dimension, not
    // a hard filter, so raising it alone never forces relaxation. The
    // unisex+budget pool is tiny (only unisex entries at budget price),
    // so office/spring/day/soft/bold/12h has no >=40 match until the
    // matcher relaxes projection, season and budget (Cedrat Boise, mid).
    // marketedFor is never relaxed. Also note: two relaxation steps
    // ('drop_min_longevity', 'drop_time_of_day') were silently dead
    // until Nov 2026 because fragrance.js compared against the wrong
    // step names; they are now aligned with RELAXATION_ORDER.
    const query = {
      occasion: 'office',
      season: 'spring',
      timeOfDay: 'day',
      projection: 'soft',
      vibe: ['bold'],
      minLongevityHours: 12,
      budget: 'budget',
      marketedFor: 'unisex',
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
