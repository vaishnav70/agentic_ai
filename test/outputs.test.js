/**
 * Unit tests for multi-format outputs (M4, design.md §5.5 and §7).
 *
 * What: Verifies the CSV shopping list (quoted fields, CRLF, UTF-8 BOM,
 * formula-injection safety) and the Markdown outfit plan, plus the
 * orchestrator wiring — a successful full-look reply must carry both
 * files, built from the checker-corrected shortlist.
 * Why: Golden 1 requires the same request to return chat + CSV + plan;
 * a file naming a fragrance the reply did not is a hallucination in
 * another format.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatasets } from '../src/data/load.js';
import { createTools } from '../src/tools/index.js';
import { createOrchestrator } from '../src/agent/orchestrator.js';
import { createSessionStore } from '../src/agent/session.js';
import { UNDERSTAND_SYSTEM } from '../src/agent/prompts.js';
import {
  csvField,
  buildShoppingListCsv,
  buildOutfitPlanMd,
  buildOutputs,
} from '../src/tools/outputs.js';

const data = loadDatasets();

const look = {
  score: 85,
  items: [
    { type: 'top', colourName: 'Navy', colourHex: '#1F2A44', pattern: 'solid', source: 'suggested' },
    { type: 'bottom', colourName: 'Beige', colourHex: '#D9C7A7', pattern: 'solid', source: 'suggested' },
  ],
  reasons: ['Navy and beige give confident contrast.'],
  patternNote: 'Keep one piece solid.',
};

const fragrance = {
  results: [{ id: 'p_001', name: 'Aventus', brand: 'Creed', score: 80, reasons: ['Direct occasion match for "party"'] }],
  relaxed: [],
};

describe('CSV shopping list', () => {
  test('quotes every field, uses CRLF and a UTF-8 BOM', () => {
    const csv = buildShoppingListCsv(look, fragrance, { data });
    assert.ok(csv.startsWith('\uFEFF"item","category","colour_name","colour_hex","pattern","notes"\r\n'));
    assert.ok(csv.includes('\r\n'));
    assert.ok(!csv.includes('\n\n'));
  });

  test('includes one row per look item and per fragrance, with real notes from the dataset', () => {
    const csv = buildShoppingListCsv(look, fragrance, { data });
    assert.match(csv, /"Top","outfit","Navy","#1F2A44","solid"/);
    assert.match(csv, /"Aventus","fragrance"/);
    // Notes are looked up from data.perfumes by id (matcher results carry no notes).
    assert.match(csv, /pineapple/);
    assert.match(csv, /Match: 80\/100/);
  });

  test('formula-injection safe: leading = + - @ are neutralised', () => {
    assert.equal(csvField('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
    assert.equal(csvField('@evil'), '"\'@evil"');
    assert.equal(csvField('a"b'), '"a""b"');
  });

  test('fragrance-only (no look) still produces a valid CSV', () => {
    const csv = buildShoppingListCsv(null, fragrance, { data });
    assert.match(csv, /"item","category"/);
    assert.match(csv, /"Aventus","fragrance"/);
  });
});

describe('Markdown outfit plan', () => {
  test('contains look table, fragrance with dataset id, reasons and assumptions', () => {
    const md = buildOutfitPlanMd(look, fragrance, look.reasons, ['season assumed: autumn'], {
      data,
      slots: { occasion: 'party', season: 'autumn', avoidNotes: ['vanilla'] },
    });
    assert.match(md, /^# StyleScent outfit plan/);
    assert.match(md, /## Your look/);
    assert.match(md, /\| Top \| Navy \(`#1F2A44`\) \| Solid \| Suggested \|/);
    assert.match(md, /Aventus by Creed \(id: `p_001`\)/);
    assert.match(md, /## Assumptions/);
    assert.match(md, /season assumed: autumn/);
    assert.match(md, /\*\*Avoided notes:\*\* vanilla/);
  });

  test('states honestly when no fragrance matched', () => {
    const md = buildOutfitPlanMd(look, { results: [] }, [], []);
    assert.match(md, /No close fragrance match was found/);
  });
});

describe('buildOutputs + orchestrator wiring', () => {
  test('returns both files with the design.md §7 names and mimes', () => {
    const files = buildOutputs({ look, fragrance, slots: { occasion: 'party' }, assumptions: [], caveats: [], data });
    assert.equal(files.length, 2);
    assert.equal(files[0].name, 'stylescent-shopping-list.csv');
    assert.equal(files[0].mime, 'text/csv');
    assert.equal(files[1].name, 'stylescent-outfit-plan.md');
    assert.equal(files[1].mime, 'text/markdown');
    assert.ok(Buffer.isBuffer(files[0].buffer));
    assert.match(files[0].buffer.toString('utf8'), /Aventus/);
    assert.match(files[1].buffer.toString('utf8'), /# StyleScent outfit plan/);
  });

  test('returns [] when there is nothing to file', () => {
    assert.deepEqual(buildOutputs(null), []);
    assert.deepEqual(buildOutputs({ look: null, pairing: null, fragrance: { results: [] } }), []);
  });

  test('orchestrator full-look reply carries both files and a checker verdict', async () => {
    const fakeLlm = {
      async generateJson(prompt, options) {
        if (options?.system === UNDERSTAND_SYSTEM || prompt.includes('userText')) {
          return { intent: 'full_look', occasion: 'party', tone: 'dark', avoidNotes: ['vanilla'], unsupported: [] };
        }
        return {
          why_it_works: 'Dark tones provide confident contrast.',
          fragrance_why: 'Crisp bergamot and woods project well.',
          tip: 'Roll up the sleeves.',
        };
      },
    };
    const orchestrator = createOrchestrator({
      data,
      tools: createTools(data),
      llm: fakeLlm,
      sessions: createSessionStore(),
    });
    const res = await orchestrator.handleRequest({
      text: 'Outfit and perfume for a party, I like dark colours, no vanilla',
      userId: 'user-outputs',
      channel: 'test',
    });
    assert.equal(res.files.length, 2);
    assert.equal(res.files[0].name, 'stylescent-shopping-list.csv');
    assert.equal(res.files[1].name, 'stylescent-outfit-plan.md');
    assert.match(res.files[1].buffer.toString('utf8'), /# StyleScent outfit plan/);
    assert.equal(typeof res.trace.checker, 'string');
    assert.match(res.trace.checker, /checker:/);
    // No banned claim may survive into the delivered reply.
    assert.ok(!/guaranteed|will get you the job|hypoallergenic/i.test(res.text));
    // Every fragrance id in the reply and in the files must exist.
    const ids = new Set(data.perfumes.map((p) => p.id));
    for (const id of res.text.match(/p_\d{3}/g) || []) assert.ok(ids.has(id));
    for (const id of res.files[1].buffer.toString('utf8').match(/p_\d{3}/g) || []) assert.ok(ids.has(id));
  });
});
