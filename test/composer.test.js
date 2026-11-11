/**
 * Unit Tests for Response Composer & Guardrails (Milestone M3).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { composeReply, renderFallbackReply } from '../src/agent/composer.js';

describe('Response Composer', () => {
  const structuredFixture = {
    intent: 'full_look',
    slots: { occasion: 'college_fest' },
    look: {
      score: 85,
      items: [
        { type: 'top', colourName: 'Navy Blue', colourHex: '#001f3f', pattern: 'solid', source: 'suggested' },
        { type: 'bottom', colourName: 'Charcoal', colourHex: '#36454f', pattern: 'solid', source: 'suggested' },
        { type: 'footwear', colourName: 'Black', colourHex: '#000000', pattern: 'solid', source: 'suggested' },
      ],
      reasons: ['Balanced neutral base (+10)', 'Monochromatic harmony (+5)'],
    },
    fragrance: {
      results: [
        {
          id: 'p_001',
          name: 'Aventus',
          brand: 'Creed',
          score: 88,
          top_notes: ['bergamot', 'apple'],
          heart_notes: ['birch', 'patchouli'],
          base_notes: ['oakmoss', 'ambergris'],
          projection: 'strong',
          longevity_hours: 10,
        },
      ],
      relaxed: [],
    },
    assumptions: ['Assuming autumn (based on today\'s date)'],
    caveats: ['time_of_day inferred from heuristics'],
    data: {
      perfumes: [
        { id: 'p_001', name: 'Aventus' },
        { id: 'p_002', name: 'Bleu de Chanel' },
      ],
    },
  };

  test('sections appear in strict order: Your look -> Why it works -> Fragrance pick -> Assumptions', async () => {
    const fakeLlm = {
      async generateJson() {
        return {
          why_it_works: 'The deep navy contrasts cleanly with charcoal.',
          fragrance_why: 'Crisp bergamot cuts through the cool evening air.',
          tip: 'Roll up your sleeves for a relaxed vibe.',
        };
      },
    };

    const reply = await composeReply(structuredFixture, fakeLlm);

    const lookIdx = reply.indexOf('## Your look');
    const whyIdx = reply.indexOf('## Why it works');
    const fragIdx = reply.indexOf('## Fragrance pick');
    const assumpIdx = reply.indexOf('## Assumptions');

    assert.ok(lookIdx !== -1, 'Missing ## Your look');
    assert.ok(whyIdx !== -1, 'Missing ## Why it works');
    assert.ok(fragIdx !== -1, 'Missing ## Fragrance pick');
    assert.ok(assumpIdx !== -1, 'Missing ## Assumptions');

    assert.ok(lookIdx < whyIdx);
    assert.ok(whyIdx < fragIdx);
    assert.ok(fragIdx < assumpIdx);

    // No "Files" section in M3
    assert.equal(reply.includes('## Files'), false);
  });

  test('guard discards LLM prose if it mentions an unshown dataset fragrance', async () => {
    const fakeLlmWithHallucination = {
      async generateJson() {
        return {
          why_it_works: 'Great look.',
          // Mentions 'Bleu de Chanel' which is NOT in shown results (shown is only Aventus p_001)
          fragrance_why: 'Instead of this, you should try Bleu de Chanel because it is great.',
          tip: 'Have fun.',
        };
      },
    };

    const reply = await composeReply(structuredFixture, fakeLlmWithHallucination);

    // The hallucinated sentence should NOT be present; fallback copy should be used
    assert.equal(reply.includes('Bleu de Chanel'), false);
    assert.ok(reply.includes('Selected for occasion alignment') || reply.includes('Matches the occasion'));
  });

  test('invalid LLM JSON or thrown error renders fallback reply gracefully', async () => {
    const throwingLlm = {
      async generateJson() {
        throw new Error('LLM connection reset');
      },
    };

    const reply = await composeReply(structuredFixture, throwingLlm);
    assert.ok(reply.includes('## Your look'));
    assert.ok(reply.includes('## Fragrance pick'));
    assert.ok(reply.includes('Outfit harmony score: **85/100**'));
  });

  test('fragrance notes come from the dataset lookup when matcher results carry none (regression: "None listed")', async () => {
    // Mirrors the real matcher output: id/name/brand/score only, no notes,
    // no projection, no longevity_hours. Full entry lives in data.perfumes.
    const structured = JSON.parse(JSON.stringify(structuredFixture));
    structured.fragrance.results = [
      { id: 'p_022', name: 'Invictus', brand: 'Paco Rabanne', score: 83, reasons: ['Direct occasion match for "college_fest"'], matched: {}, caveats: [] },
      { id: 'p_004', name: 'Sauvage Elixir', brand: 'Dior', score: 80, reasons: [], matched: {}, caveats: [] },
    ];
    structured.data.perfumes = [
      {
        id: 'p_022',
        name: 'Invictus',
        brand: 'Paco Rabanne',
        notes: { top: ['grapefruit', 'marine accord'], heart: ['bay leaf', 'jasmine'], base: ['ambergris', 'guaiac wood', 'oakmoss', 'patchouli'] },
        projection: 'strong',
        longevity_hours: '6-8 hours',
      },
      {
        id: 'p_004',
        name: 'Sauvage Elixir',
        brand: 'Dior',
        notes: { top: ['grapefruit', 'nutmeg'], heart: ['lavender'], base: ['amber'] },
        projection: 'strong',
        longevity_hours: '8-10 hours',
      },
    ];

    const reply = renderFallbackReply(structured);

    assert.ok(reply.includes('Top: grapefruit, marine accord'), 'top notes should come from the dataset');
    assert.ok(reply.includes('Heart: bay leaf, jasmine'), 'heart notes should come from the dataset');
    assert.ok(reply.includes('Base: ambergris, guaiac wood, oakmoss, patchouli'), 'base notes should come from the dataset');
    assert.ok(reply.includes('Projection: strong'), 'projection should come from the dataset, not the moderate default');
    assert.ok(reply.includes('6-8 hours'), 'longevity should come from the dataset, not the medium default');
    assert.equal(reply.includes('hours hrs'), false, 'string longevity ranges must not get a doubled unit');
    assert.ok(reply.includes('Sauvage Elixir'), 'alternative should still be listed');
    assert.ok(reply.includes('grapefruit, nutmeg'), 'alternative notes should come from the dataset');
    assert.equal(reply.includes('None listed'), false, 'no "None listed" should remain when the dataset has notes');
  });
});
