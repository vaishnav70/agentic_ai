/**
 * Unit Tests for Dataset Schemas.
 *
 * What: Validates positive and negative fixtures for each domain Zod schema
 * (perfumeSchema, colourRulesSchema, patternsSchema, toneMapSchema).
 * Why: Guarantees schema enforcement catches malformed types, invalid enums,
 * uppercase notes, bad hex formats, and incomplete objects.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  perfumeSchema,
  colourRulesSchema,
  patternsSchema,
  toneMapSchema,
} from '../src/data/schemas.js';

describe('Dataset Schemas Validation', () => {
  describe('perfumeSchema', () => {
    const validPerfume = {
      id: 'p_001',
      rank: 1,
      name: 'Sample Scent',
      brand: 'Luxury House',
      marketed_for: 'unisex',
      family: 'woody',
      notes: {
        top: ['bergamot', 'lemon'],
        heart: ['cedarwood'],
        base: ['vetiver'],
      },
      longevity_hours: '6-8',
      longevity_min_hours: 6,
      longevity_max_hours: 8,
      longevity: 'medium',
      projection: 'moderate',
      seasons: ['spring', 'autumn'],
      occasions: ['office', 'casual'],
      time_of_day: ['day', 'evening'],
      vibe: ['confident', 'calm'],
      price_band: 'premium',
      sources: ['https://example.com/review'],
      source_agreement: 'high',
      confidence: 'high',
      verified: false,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research via web search',
    };

    test('valid perfume fixture passes validation', () => {
      const parsed = perfumeSchema.parse(validPerfume);
      assert.equal(parsed.name, 'Sample Scent');
    });

    test('rejects uppercase characters in notes', () => {
      const invalid = {
        ...validPerfume,
        notes: {
          ...validPerfume.notes,
          top: ['Bergamot'], // uppercase not allowed
        },
      };
      assert.throws(() => perfumeSchema.parse(invalid));
    });

    test('rejects invalid family enum', () => {
      const invalid = {
        ...validPerfume,
        family: 'aquatic_leather', // not in FAMILIES
      };
      assert.throws(() => perfumeSchema.parse(invalid));
    });

    test('rejects invalid projection enum', () => {
      const invalid = {
        ...validPerfume,
        projection: 'extreme_beast', // not in PROJECTION
      };
      assert.throws(() => perfumeSchema.parse(invalid));
    });

    test('rejects missing name or brand', () => {
      const invalidNoName = { ...validPerfume, name: '' };
      assert.throws(() => perfumeSchema.parse(invalidNoName));

      const invalidNoBrand = { ...validPerfume, brand: '' };
      assert.throws(() => perfumeSchema.parse(invalidNoBrand));
    });
  });

  describe('colourRulesSchema', () => {
    const validColourRules = {
      neutrals: ['black', 'white', 'grey'],
      named_colours: [
        { name: 'jet black', hex: '#0a0a0a', temperature: 'neutral' },
        { name: 'pure white', hex: '#ffffff', temperature: 'neutral' },
      ],
      season_palettes: {
        spring: ['#87ceeb', '#ffb6c1'],
        summer: ['#87ceeb', '#008080'],
        autumn: ['#800020', '#556b2f'],
        winter: ['#0a0a0a', '#ffffff'],
      },
      occasion_palettes: {
        college_fest: ['#0a0a0a', '#4169e1'],
        office: ['#191970', '#36454f'],
        date_night: ['#0a0a0a', '#800020'],
        wedding: ['#800020', '#e1ad01'],
        casual: ['#ffffff', '#708090'],
        interview: ['#191970', '#36454f'],
        party: ['#0a0a0a', '#800020'],
        festival_traditional: ['#990000', '#e1ad01'],
      },
      harmony_angles: {
        complementary: [180],
        analogous: [30, -30],
        triadic: [120, 240],
      },
      wearable_bounds: {
        s: [0.2, 0.9],
        l: [0.2, 0.85],
      },
    };

    test('valid colour rules fixture passes', () => {
      const parsed = colourRulesSchema.parse(validColourRules);
      assert.equal(parsed.neutrals.length, 3);
    });

    test('rejects invalid hex code format', () => {
      const invalid = {
        ...validColourRules,
        named_colours: [
          { name: 'bad hex', hex: '#12345Z', temperature: 'neutral' },
        ],
      };
      assert.throws(() => colourRulesSchema.parse(invalid));
    });

    test('rejects missing season in season_palettes', () => {
      const invalid = {
        ...validColourRules,
        season_palettes: {
          spring: ['#87ceeb'],
          summer: ['#87ceeb'],
          autumn: ['#800020'],
          // missing winter
        },
      };
      assert.throws(() => colourRulesSchema.parse(invalid));
    });
  });

  describe('patternsSchema', () => {
    const validPatterns = {
      patterns: ['solid', 'stripes', 'checks'],
      pairing_rules: [
        {
          a: 'solid',
          b: 'stripes',
          verdict: 'good',
          reason: 'Solid grounds linear stripes.',
        },
      ],
      scale_rule: 'Mix different scales and share a colour.',
    };

    test('valid patterns fixture passes', () => {
      const parsed = patternsSchema.parse(validPatterns);
      assert.equal(parsed.patterns.length, 3);
    });

    test('rejects invalid pattern name', () => {
      const invalid = {
        ...validPatterns,
        pairing_rules: [
          {
            a: 'polka_dots_custom', // not in PATTERNS
            b: 'stripes',
            verdict: 'good',
            reason: 'Invalid pattern.',
          },
        ],
      };
      assert.throws(() => patternsSchema.parse(invalid));
    });

    test('rejects invalid verdict', () => {
      const invalid = {
        ...validPatterns,
        pairing_rules: [
          {
            a: 'solid',
            b: 'stripes',
            verdict: 'disaster', // not in VERDICTS
            reason: 'Invalid verdict.',
          },
        ],
      };
      assert.throws(() => patternsSchema.parse(invalid));
    });
  });

  describe('toneMapSchema', () => {
    const validToneMap = [
      {
        key: 'dark_bold_palette',
        description: 'Deep and moody colors',
        vibes: ['bold', 'confident'],
      },
    ];

    test('valid tone map fixture passes', () => {
      const parsed = toneMapSchema.parse(validToneMap);
      assert.equal(parsed.length, 1);
    });

    test('rejects invalid vibe in tone map', () => {
      const invalid = [
        {
          key: 'dark_bold_palette',
          description: 'Deep and moody colors',
          vibes: ['hyper_aggressive'], // not in VIBES
        },
      ];
      assert.throws(() => toneMapSchema.parse(invalid));
    });

    test('rejects empty vibes list', () => {
      const invalid = [
        {
          key: 'dark_bold_palette',
          description: 'Deep and moody colors',
          vibes: [],
        },
      ];
      assert.throws(() => toneMapSchema.parse(invalid));
    });
  });
});
