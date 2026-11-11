/**
 * Unit Tests for Colour Theory & Harmony Tool.
 *
 * What: Validates RGB/HSL/Lab conversions, perceptual distance, nearest colour classification,
 * harmony generation, boundary clamping, and outfit scoring logic using controlled fixtures.
 * Why: Guarantees deterministic colour maths and scoring without dependence on external APIs.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hslToHex,
  hueDistance,
  rgbToLab,
  deltaE76,
  analyseColour,
  suggestHarmonies,
  paletteForSeason,
  paletteForOccasion,
  scoreOutfit,
} from '../src/tools/colour.js';

describe('Colour Tool & Math', () => {
  const colourRulesFixture = {
    neutrals: ['black', 'white', 'grey', 'navy'],
    named_colours: [
      { name: 'black', hex: '#000000', temperature: 'neutral' },
      { name: 'white', hex: '#ffffff', temperature: 'neutral' },
      { name: 'grey', hex: '#808080', temperature: 'neutral' },
      { name: 'navy', hex: '#000080', temperature: 'cool' },
      { name: 'crimson red', hex: '#ff0000', temperature: 'warm' },
      { name: 'emerald green', hex: '#00ff00', temperature: 'cool' },
      { name: 'royal blue', hex: '#0000ff', temperature: 'cool' },
      { name: 'mustard yellow', hex: '#ffff00', temperature: 'warm' },
    ],
    season_palettes: {
      spring: ['#00ff00', '#ffffff'],
      summer: ['#0000ff', '#ffffff'],
      autumn: ['#ff0000', '#808080'],
      winter: ['#000000', '#ffffff'],
    },
    occasion_palettes: {
      college_fest: ['#ff0000', '#0000ff'],
      office: ['#000080', '#808080'],
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

  describe('Conversions & Helpers', () => {
    test('hex/RGB/HSL round trips preserve values', () => {
      const hex = '#36454f';
      const rgb = hexToRgb(hex);
      assert.equal(rgbToHex(rgb.r, rgb.g, rgb.b), hex);

      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const backToRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      assert.ok(Math.abs(backToRgb.r - rgb.r) <= 1);
      assert.ok(Math.abs(backToRgb.g - rgb.g) <= 1);
      assert.ok(Math.abs(backToRgb.b - rgb.b) <= 1);

      const backToHex = hslToHex(hsl.h, hsl.s, hsl.l);
      assert.equal(backToHex, hex);
    });

    test('known primary hues are exact: red 0, green 120, blue 240', () => {
      assert.equal(rgbToHsl(255, 0, 0).h, 0);
      assert.equal(rgbToHsl(0, 255, 0).h, 120);
      assert.equal(rgbToHsl(0, 0, 255).h, 240);
    });

    test('hueDistance computes circular distance correctly (0 to 180)', () => {
      assert.equal(hueDistance(10, 30), 20);
      assert.equal(hueDistance(350, 10), 20); // wraps 360
      assert.equal(hueDistance(0, 180), 180);
      assert.equal(hueDistance(10, 200), 170);
    });

    test('CIE Lab & deltaE76 compute distance properly', () => {
      const labBlack = rgbToLab(0, 0, 0);
      const labWhite = rgbToLab(255, 255, 255);
      const dist = deltaE76(labBlack, labWhite);
      assert.ok(Math.abs(dist - 100) < 0.1);
    });

    test('invalid hex format throws error', () => {
      assert.throws(() => hexToRgb('not-a-hex'), /Invalid hex/i);
      assert.throws(() => hexToRgb('#12345'), /Invalid hex/i);
      assert.throws(() => hexToRgb('#1234567'), /Invalid hex/i);
      assert.throws(() => hexToRgb('#ZZZZZZ'), /Invalid hex/i);
    });
  });

  describe('analyseColour', () => {
    test('identifies nearest named colour correctly', () => {
      const result = analyseColour('#fe0202', colourRulesFixture);
      assert.equal(result.name, 'crimson red');
      assert.equal(result.temperature, 'warm');
    });

    test('isNeutral is true for black, white, grey, navy and false for saturated red', () => {
      assert.equal(analyseColour('#000000', colourRulesFixture).isNeutral, true); // black
      assert.equal(analyseColour('#ffffff', colourRulesFixture).isNeutral, true); // white
      assert.equal(analyseColour('#808080', colourRulesFixture).isNeutral, true); // grey
      assert.equal(analyseColour('#000080', colourRulesFixture).isNeutral, true); // navy
      assert.equal(analyseColour('#ff0000', colourRulesFixture).isNeutral, false); // saturated red
    });
  });

  describe('suggestHarmonies', () => {
    test('produces expected hue offsets within 2 degrees for complementary', () => {
      // Base hue red = 0. Complementary should be 180 (cyan)
      const result = suggestHarmonies('#ff0000', 'complementary', colourRulesFixture);
      assert.equal(result.colours.length, 1);
      const compHsl = rgbToHsl(...Object.values(hexToRgb(result.colours[0].hex)));
      assert.ok(hueDistance(compHsl.h, 180) <= 2);
    });

    test('clamping keeps companion colours inside wearable_bounds', () => {
      // Extremely saturated colour (s=1.0)
      const result = suggestHarmonies('#ff0000', 'complementary', colourRulesFixture);
      const compHsl = rgbToHsl(...Object.values(hexToRgb(result.colours[0].hex)));
      assert.ok(compHsl.s <= 0.90 + 0.01);
      assert.ok(compHsl.s >= 0.20 - 0.01);
      assert.ok(compHsl.l <= 0.85 + 0.01);
      assert.ok(compHsl.l >= 0.20 - 0.01);
    });

    test('neutral base colour returns empty colours and guidance note for chromatic schemes', () => {
      const result = suggestHarmonies('#808080', 'complementary', colourRulesFixture);
      assert.deepEqual(result.colours, []);
      assert.match(result.note, /Neutral base: pairs with almost anything/);
    });

    test('neutral-pair returns top contrast neutral companions for neutral base', () => {
      // Grey (l=0.5) should pair with white (l=1) or black (l=0)
      const result = suggestHarmonies('#808080', 'neutral-pair', colourRulesFixture);
      assert.ok(result.colours.length > 0);
      assert.equal(result.note, null);
    });
  });

  describe('paletteForSeason & paletteForOccasion', () => {
    test('paletteForSeason returns colour list with names', () => {
      const palette = paletteForSeason('spring', colourRulesFixture);
      assert.equal(palette.length, 2);
      assert.equal(palette[0].hex, '#00ff00');
      assert.equal(palette[0].name, 'emerald green');
    });

    test('paletteForOccasion throws on unknown occasion', () => {
      assert.throws(() => paletteForOccasion('unknown_gala', colourRulesFixture), /Unknown occasion/);
    });
  });

  describe('scoreOutfit', () => {
    test('an all-neutral outfit with equal formality scores exactly 85', () => {
      // Base: 60 + neutral_base (10) + all_neutral (10) + formality spread 0 (5) = 85
      const garments = [
        { colour_hex: '#000000', formality: 'formal' },
        { colour_hex: '#ffffff', formality: 'formal' },
        { colour_hex: '#808080', formality: 'formal' },
      ];
      const result = scoreOutfit(garments, colourRulesFixture);
      assert.equal(result.score, 85);
      assert.equal(result.reasons.length, result.breakdown.length);
    });

    test('an outfit with 4+ hue families gets the -20 penalty', () => {
      // Red (0), Green (120), Blue (240), Yellow (60)
      const garments = [
        { colour_hex: '#ff0000', formality: 'casual' }, // Red (0)
        { colour_hex: '#00ff00', formality: 'casual' }, // Green (120)
        { colour_hex: '#0000ff', formality: 'casual' }, // Blue (240)
        { colour_hex: '#ffff00', formality: 'casual' }, // Yellow (60)
      ];
      const result = scoreOutfit(garments, colourRulesFixture);
      const hueCountEntry = result.breakdown.find((b) => b.rule === 'hue_count');
      assert.ok(hueCountEntry);
      assert.equal(hueCountEntry.delta, -20);
    });

    test('a saturated clash pair gets the clash penalty (-12)', () => {
      // Red (h=0, s=1.0) and Yellow-Green (h=70, s=1.0) -> distance = 70 (in 50..100)
      const garments = [
        { colour_hex: '#ff0000', formality: 'casual' },
        { colour_hex: '#80ff00', formality: 'casual' }, // h=80, s=1
      ];
      const result = scoreOutfit(garments, colourRulesFixture);
      const clashEntry = result.breakdown.find((b) => b.rule === 'pair_clash');
      assert.ok(clashEntry);
      assert.equal(clashEntry.delta, -12);
    });

    test('a formal + casual mix gets -15 formality penalty', () => {
      const garments = [
        { colour_hex: '#000000', formality: 'formal' },
        { colour_hex: '#ffffff', formality: 'casual' },
      ];
      const result = scoreOutfit(garments, colourRulesFixture);
      const formalityEntry = result.breakdown.find((b) => b.rule === 'formality');
      assert.ok(formalityEntry);
      assert.equal(formalityEntry.delta, -15);
    });

    test('reasons and breakdown line up one-to-one and score stays 0..100', () => {
      const garments = [
        { colour_hex: '#ff0000', formality: 'casual' },
        { colour_hex: '#000080', formality: 'smart' },
        { colour_hex: '#00ff00', formality: 'formal' },
      ];
      const result = scoreOutfit(garments, colourRulesFixture);
      assert.equal(result.reasons.length, result.breakdown.length);
      assert.ok(result.score >= 0 && result.score <= 100);
    });

    test('throws on missing or invalid colour_hex in garment', () => {
      assert.throws(
        () => scoreOutfit([{ formality: 'casual' }], colourRulesFixture),
        /missing required "colour_hex"/i
      );
      assert.throws(
        () => scoreOutfit([{ colour_hex: 'invalid-hex' }], colourRulesFixture),
        /invalid hex/i
      );
    });
  });
});
