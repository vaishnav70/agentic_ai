/**
 * Unit Tests for Wardrobe Specialist (Milestone M3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatasets } from '../src/data/load.js';
import { createTools } from '../src/tools/index.js';
import { buildLook, pairingIdeas } from '../src/agent/wardrobe.js';

describe('Wardrobe Specialist', () => {
  const data = loadDatasets();
  const tools = createTools(data);

  test('is strictly deterministic: same input gives deep-equal output', () => {
    const slots = {
      occasion: 'college_fest',
      season: 'autumn',
      timeOfDay: 'evening',
      tone: 'dark',
      garments: [
        { type: 'top', colourName: 'Black', colourHex: '#000000', pattern: 'solid', formality: 'casual' },
      ],
    };

    const run1 = buildLook(slots, data, tools);
    const run2 = buildLook(slots, data, tools);

    assert.deepEqual(run1, run2);
  });

  test('user garment is preserved in items', () => {
    const slots = {
      occasion: 'office',
      season: 'summer',
      garments: [
        { type: 'top', colourName: 'Sky Blue', colourHex: '#87ceeb', pattern: 'stripes', formality: 'smart' },
      ],
    };

    const look = buildLook(slots, data, tools);
    const userTop = look.items.find((i) => i.type === 'top');

    assert.ok(userTop);
    assert.equal(userTop.source, 'user');
    assert.equal(userTop.colourHex, '#87ceeb');
    assert.equal(userTop.pattern, 'stripes');
  });

  test('anchor selection follows priority order', () => {
    // 1. User garment with hex wins
    const slotsWithGarment = {
      occasion: 'casual',
      colourPrefs: ['burgundy'],
      garments: [{ type: 'top', colourHex: '#001f3f', colourName: 'Navy' }],
    };
    const look1 = buildLook(slotsWithGarment, data, tools);
    assert.equal(look1.anchor.hex, '#001f3f');

    // 2. Else first resolvable colour preference
    const slotsWithPref = {
      occasion: 'casual',
      colourPrefs: ['Burgundy'],
      garments: [],
    };
    const look2 = buildLook(slotsWithPref, data, tools);
    assert.equal(look2.anchor.hex.toLowerCase(), '#800020');
  });

  test('footwear is always neutral', () => {
    const slots = {
      occasion: 'college_fest',
      garments: [],
    };

    const look = buildLook(slots, data, tools);
    const footwear = look.items.find((i) => i.type === 'footwear');

    assert.ok(footwear);
    const analysed = tools.colour.analyse(footwear.colourHex);
    assert.equal(analysed.isNeutral, true);
  });

  test('outfit score equals scoreOutfit of the items', () => {
    const slots = {
      occasion: 'date_night',
      garments: [],
    };

    const look = buildLook(slots, data, tools);
    const garmentsForScorer = look.items.map((it) => ({
      type: it.type,
      colour_hex: it.colourHex,
      colour_name: it.colourName,
      pattern: it.pattern,
      formality: it.formality,
    }));

    const directScore = tools.colour.scoreOutfit(garmentsForScorer);
    assert.equal(look.score, directScore.score);
  });

  test('pairingIdeas returns at most 3 colours per scheme', () => {
    const slots = {
      intent: 'pairing_only',
      garments: [
        { type: 'top', colourName: 'Olive Green', colourHex: '#556b2f', pattern: 'checks' },
      ],
    };

    const ideas = pairingIdeas(slots, data, tools);
    assert.ok(ideas.anchor);
    assert.ok(ideas.complementary.length <= 3);
    assert.ok(ideas.analogous.length <= 3);
    assert.ok(ideas.neutralPair.length <= 3);
    assert.ok(Array.isArray(ideas.companionPatterns));
  });
});
