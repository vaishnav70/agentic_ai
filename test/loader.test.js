/**
 * Unit Tests for Dataset Loader & Cross-File Integrity Checks.
 *
 * What: Validates cross-file relational rules (unique IDs, valid pattern references,
 * full occasion coverage) using test fixtures, and ensures production seed data loads cleanly.
 * Why: Prevents silent data integrity regressions across interdependent data files.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadData } from '../src/data/load.js';

describe('Data Loader and Cross-File Integrity', () => {
  let tempDir;

  const validPerfumesFixture = [
    {
      id: 'p_001',
      rank: 1,
      name: 'Perfume One',
      brand: 'Brand A',
      marketed_for: 'men',
      family: 'woody',
      notes: { top: ['lemon'], heart: ['cedar'], base: ['amber'] },
      longevity_hours: '6-8',
      longevity_min_hours: 6,
      longevity_max_hours: 8,
      longevity: 'medium',
      projection: 'moderate',
      seasons: ['spring'],
      occasions: ['office'],
      time_of_day: ['day'],
      vibe: ['confident'],
      price_band: 'mid',
      sources: ['https://example.com'],
      source_agreement: 'high',
      confidence: 'high',
      verified: false,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research via web search',
    },
    {
      id: 'p_002',
      rank: 2,
      name: 'Perfume Two',
      brand: 'Brand B',
      marketed_for: 'women',
      family: 'floral',
      notes: { top: ['rose'], heart: ['jasmine'], base: ['vanilla'] },
      longevity_hours: '8',
      longevity_min_hours: 8,
      longevity_max_hours: 8,
      longevity: 'long',
      projection: 'strong',
      seasons: ['summer'],
      occasions: ['party'],
      time_of_day: ['evening'],
      vibe: ['romantic'],
      price_band: 'premium',
      sources: ['https://example.com/2'],
      source_agreement: 'high',
      confidence: 'high',
      verified: false,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research via web search',
    },
  ];

  const validColourRulesFixture = {
    neutrals: ['black', 'white'],
    named_colours: [
      { name: 'black', hex: '#000000', temperature: 'neutral' },
    ],
    season_palettes: {
      spring: ['#87ceeb'],
      summer: ['#87ceeb'],
      autumn: ['#800020'],
      winter: ['#000000'],
    },
    occasion_palettes: {
      college_fest: ['#000000'],
      office: ['#000000'],
      date_night: ['#000000'],
      wedding: ['#000000'],
      casual: ['#000000'],
      interview: ['#000000'],
      party: ['#000000'],
      festival_traditional: ['#000000'],
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

  const validPatternsFixture = {
    patterns: ['solid', 'stripes'],
    pairing_rules: [
      {
        a: 'solid',
        b: 'stripes',
        verdict: 'good',
        reason: 'Solid grounds stripes.',
      },
    ],
    scale_rule: 'Mix different scales and share a colour.',
  };

  const validToneMapFixture = [
    {
      key: 'dark_bold_palette',
      description: 'Moody colors',
      vibes: ['bold', 'confident'],
    },
  ];

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylescent-test-loader-'));
  });

  after(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function writeFixtureFiles(dir, overrides = {}) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'perfumes.json'),
      JSON.stringify(overrides.perfumes || validPerfumesFixture),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dir, 'colour_rules.json'),
      JSON.stringify(overrides.colourRules || validColourRulesFixture),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dir, 'patterns.json'),
      JSON.stringify(overrides.patterns || validPatternsFixture),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dir, 'tone_map.json'),
      JSON.stringify(overrides.toneMap || validToneMapFixture),
      'utf8'
    );
  }

  test('valid fixture directory loads successfully and returns frozen object', () => {
    const dir = path.join(tempDir, 'valid');
    writeFixtureFiles(dir);

    const loaded = loadData(dir);
    assert.equal(loaded.perfumes.length, 2);
    assert.equal(loaded.colourRules.named_colours.length, 1);
    assert.equal(loaded.patterns.patterns.length, 2);
    assert.equal(loaded.toneMap.length, 1);
    assert.ok(Object.isFrozen(loaded));
  });

  test('cross-check fails when duplicate perfume IDs exist', () => {
    const dir = path.join(tempDir, 'dup-ids');
    const dupPerfumes = [
      { ...validPerfumesFixture[0], id: 'p_001' },
      { ...validPerfumesFixture[1], id: 'p_001' }, // duplicate id
    ];
    writeFixtureFiles(dir, { perfumes: dupPerfumes });

    assert.throws(
      () => loadData(dir),
      /duplicate perfume ID "p_001"/i
    );
  });

  test('cross-check fails when pairing rule references unknown pattern', () => {
    const dir = path.join(tempDir, 'bad-pairing');
    const badPatterns = {
      ...validPatternsFixture,
      patterns: ['solid'], // 'stripes' is missing from patterns list
      pairing_rules: [
        {
          a: 'solid',
          b: 'stripes',
          verdict: 'good',
          reason: 'Solid grounds stripes.',
        },
      ],
    };
    writeFixtureFiles(dir, { patterns: badPatterns });

    assert.throws(
      () => loadData(dir),
      /pairing rule references unknown pattern "stripes"/i
    );
  });

  test('cross-check fails when an occasion is missing an occasion palette', () => {
    const dir = path.join(tempDir, 'missing-palette');
    const badColourRules = {
      ...validColourRulesFixture,
      occasion_palettes: {
        ...validColourRulesFixture.occasion_palettes,
        college_fest: [], // empty/missing
      },
    };
    writeFixtureFiles(dir, { colourRules: badColourRules });

    assert.throws(
      () => loadData(dir),
      /missing or empty occasion palette for occasion "college_fest"/i
    );
  });

  test('real data loads cleanly without errors', () => {
    const realData = loadData();
    assert.ok(realData);
    assert.ok(Array.isArray(realData.perfumes));
    assert.ok(realData.perfumes.length > 0);
    assert.ok(realData.colourRules.named_colours.length > 0);
    assert.ok(realData.patterns.pairing_rules.length > 0);
    assert.ok(realData.toneMap.length > 0);
  });
});
