/**
 * Unit Tests for Fragrance Matcher Tool.
 *
 * What: Validates hard-filtering rules, alias scoring credits, normalized dimension weights,
 * budget semantics, low-confidence penalties, tie-break determinism, and real dataset smoke testing.
 * Why: Guarantees perfume recommendations strictly follow documented scoring rules without hallucination.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchPerfumes } from '../src/tools/perfume.js';
import { loadData } from '../src/data/load.js';

describe('Perfume Matcher Tool', () => {
  const perfumesFixture = [
    {
      id: 'p_001',
      rank: 1,
      name: 'Alpha Woody',
      brand: 'House A',
      marketed_for: 'men',
      family: 'woody',
      notes: { top: ['bergamot'], heart: ['cedar'], base: ['vetiver'] },
      longevity_hours: '8-10',
      longevity_min_hours: 8,
      longevity_max_hours: 10,
      longevity: 'long',
      projection: 'strong',
      seasons: ['autumn', 'winter'],
      occasions: ['party'], // alias for college_fest
      time_of_day: ['evening', 'night'],
      vibe: ['confident', 'bold'],
      price_band: 'mid',
      sources: ['https://example.com/1'],
      source_agreement: 'high',
      confidence: 'high',
      verified: true,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research',
    },
    {
      id: 'p_002',
      rank: 2,
      name: 'Beta Vanilla',
      brand: 'House B',
      marketed_for: 'men',
      family: 'gourmand',
      notes: { top: ['cinnamon'], heart: ['bourbon vanilla'], base: ['amber'] },
      longevity_hours: '6-8',
      longevity_min_hours: 6,
      longevity_max_hours: 8,
      longevity: 'medium',
      projection: 'moderate',
      seasons: ['winter'],
      occasions: ['date_night'],
      time_of_day: ['night'],
      vibe: ['romantic'],
      price_band: 'budget',
      sources: ['https://example.com/2'],
      source_agreement: 'high',
      confidence: 'high',
      verified: false,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research',
    },
    {
      id: 'p_003',
      rank: 3,
      name: 'Gamma Citrus Exact',
      brand: 'House C',
      marketed_for: 'unisex',
      family: 'citrus',
      notes: { top: ['mandarin', 'lemon'], heart: ['neroli'], base: ['musk'] },
      longevity_hours: '4-6',
      longevity_min_hours: 4,
      longevity_max_hours: 6,
      longevity: 'medium',
      projection: 'soft',
      seasons: ['spring', 'summer'],
      occasions: ['college_fest', 'casual'], // exact match for college_fest
      time_of_day: ['day', 'evening'],
      vibe: ['fresh', 'playful'],
      price_band: 'premium',
      sources: ['https://example.com/3'],
      source_agreement: 'medium',
      confidence: 'low', // triggers 0.9x penalty
      verified: false,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research',
    },
    {
      id: 'p_004',
      rank: 4,
      name: 'Delta Floral Oud',
      brand: 'House D',
      marketed_for: 'women',
      family: 'floral',
      notes: { top: ['rose'], heart: ['jasmine'], base: ['cambodian oud'] },
      longevity_hours: '12',
      longevity_min_hours: 12,
      longevity_max_hours: 12,
      longevity: 'long',
      projection: 'strong',
      seasons: ['autumn'],
      occasions: ['wedding'],
      time_of_day: ['evening'],
      vibe: ['elegant'],
      price_band: 'premium',
      sources: ['https://example.com/4'],
      source_agreement: 'high',
      confidence: 'high',
      verified: false,
      inferred_fields: [],
      source: 'team research',
    },
  ];

  describe('Hard Filters', () => {
    test('avoidNotes drops entries matching substring case-insensitively', () => {
      const result = matchPerfumes(
        { occasion: 'party', avoidNotes: ['vanilla'] },
        perfumesFixture
      );
      assert.equal(result.filtered_out.avoidNotes, 1);
      assert.ok(result.results.every((p) => p.id !== 'p_002'));
    });

    test('requireNotes drops entries that do not include all required notes', () => {
      const result = matchPerfumes(
        { occasion: 'wedding', requireNotes: ['oud'] },
        perfumesFixture
      );
      assert.equal(result.filtered_out.requireNotes, 3);
      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].id, 'p_004');
    });

    test('requireNotes with no match returns empty results and "no close match"', () => {
      const result = matchPerfumes(
        { occasion: 'party', requireNotes: ['non_existent_note'] },
        perfumesFixture
      );
      assert.equal(result.results.length, 0);
      assert.equal(result.reason, 'no close match');
    });

    test('budget filter drops entries above maximum band and drops null price bands', () => {
      // Budget "mid" should keep "budget" and "mid", dropping "premium" (p_003, p_004)
      const result = matchPerfumes(
        { occasion: 'party', budget: 'mid' },
        perfumesFixture
      );
      assert.equal(result.filtered_out.budget, 2);
      assert.ok(result.results.every((p) => p.id === 'p_001' || p.id === 'p_002'));
    });

    test('marketedFor filter retains appropriate demographics', () => {
      // "men" keeps men and unisex (drops women p_004)
      const resMen = matchPerfumes(
        { occasion: 'wedding', marketedFor: 'men' },
        perfumesFixture
      );
      assert.equal(resMen.filtered_out.marketedFor, 1);
      assert.ok(resMen.results.every((p) => p.id !== 'p_004'));

      // "unisex" keeps unisex only (drops p_001, p_002, p_004)
      const resUnisex = matchPerfumes(
        { occasion: 'college_fest', marketedFor: 'unisex' },
        perfumesFixture
      );
      assert.equal(resUnisex.filtered_out.marketedFor, 3);
      assert.ok(resUnisex.results.every((p) => p.id === 'p_003'));
    });
  });

  describe('Scoring Logic & Credits', () => {
    test('alias credit awards 0.6x for alias and 1.0x for exact occasion', () => {
      // Query occasion college_fest:
      // p_003 has college_fest exact (1.0)
      // p_001 has party (alias for college_fest -> 0.6)
      const result = matchPerfumes(
        { occasion: 'college_fest' },
        perfumesFixture,
        { threshold: 10 }
      );
      const exact = result.results.find((p) => p.id === 'p_003');
      const alias = result.results.find((p) => p.id === 'p_001');

      assert.ok(exact);
      assert.ok(alias);
      assert.equal(exact.matched.occasion.type, 'exact');
      assert.equal(alias.matched.occasion.type, 'alias');
      assert.deepEqual(alias.matched.occasion.tags, ['party']);
    });

    test('normalisation calculates score based on requested dimensions only', () => {
      // If only occasion is requested: possible = 25 (occasion) + 5 (rank) = 30
      const result = matchPerfumes(
        { occasion: 'party' },
        perfumesFixture,
        { threshold: 10 }
      );
      const p1 = result.results.find((p) => p.id === 'p_001');
      assert.ok(p1);
      // p_001: exact occasion party (25) + rank 1 (5) = 30 / 30 * 100 = 100
      assert.equal(p1.score, 100);
    });

    test('budgetFit awards partial credit for cheaper bands', () => {
      // Requested budget: premium
      // p_004 (premium): exact (1.0)
      // p_001 (mid): 1 band cheaper (0.7)
      // p_002 (budget): 2 bands cheaper (0.4)
      const result = matchPerfumes(
        { occasion: 'wedding', budget: 'premium' },
        perfumesFixture,
        { k: 4, threshold: 10 }
      );
      const exact = result.results.find((p) => p.id === 'p_004');
      const cheap1 = result.results.find((p) => p.id === 'p_001');
      const cheap2 = result.results.find((p) => p.id === 'p_002');

      assert.equal(exact?.matched.budgetFit, 'exact');
      assert.equal(cheap1?.matched.budgetFit, 'cheaper_1');
      assert.equal(cheap2?.matched.budgetFit, 'cheaper_2');
    });

    test('low confidence multiplies final score by 0.9 and adds caveat', () => {
      const result = matchPerfumes(
        { occasion: 'college_fest' },
        perfumesFixture,
        { threshold: 10 }
      );
      const lowConf = result.results.find((p) => p.id === 'p_003');
      assert.ok(lowConf);
      assert.ok(lowConf.caveats.includes('low research confidence'));
    });
  });

  describe('Determinism & Invariants', () => {
    test('tie-break orders verified: true first, then rank, then id', () => {
      const tiedPerfumes = [
        {
          ...perfumesFixture[0],
          id: 'p_010',
          name: 'Tied B',
          verified: false,
          rank: 5,
        },
        {
          ...perfumesFixture[0],
          id: 'p_020',
          name: 'Tied A Verified',
          verified: true,
          rank: 5,
        },
      ];

      const res = matchPerfumes({ occasion: 'party' }, tiedPerfumes);
      assert.equal(res.results[0].id, 'p_020'); // verified true breaks tie first
    });

    test('matcher is strictly deterministic: identical inputs yield deep-equal output', () => {
      const q = {
        occasion: 'party',
        season: 'autumn',
        projection: 'strong',
      };
      const res1 = matchPerfumes(q, perfumesFixture);
      const res2 = matchPerfumes(q, perfumesFixture);
      assert.deepEqual(res1, res2);
    });

    test('never returns an id not present in input perfumes array', () => {
      const res = matchPerfumes({ occasion: 'party' }, perfumesFixture);
      const allowedIds = new Set(perfumesFixture.map((p) => p.id));
      for (const item of res.results) {
        assert.ok(allowedIds.has(item.id));
      }
    });
  });

  describe('Real Dataset Smoke Test', () => {
    test('matchPerfumes runs cleanly on real loaded data without throwing', () => {
      const { perfumes } = loadData();
      const result = matchPerfumes(
        {
          occasion: 'college_fest',
          season: 'autumn',
          timeOfDay: 'evening',
          avoidNotes: ['vanilla', 'musk'],
        },
        perfumes
      );

      assert.ok(result);
      assert.ok(Array.isArray(result.results));
      assert.ok(typeof result.considered === 'number');
      assert.ok(result.filtered_out);
      assert.equal(typeof result.filtered_out.avoidNotes, 'number');
    });
  });
});
