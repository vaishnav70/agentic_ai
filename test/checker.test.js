/**
 * Unit tests for the StyleScent safety & quality checker (M4, design.md §6.3).
 *
 * What: Verifies each rule C1–C6 in isolation, plus the auto-repair
 * behaviour — the checker must strip/replace/disclose, never invent data.
 * Why: The checker is the only programmatic guard between LLM prose and
 * the user, so a regression here could ship a hallucinated fragrance or
 * a banned promise to the judges.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatasets } from '../src/data/load.js';
import { checkReply, createChecker } from '../src/agent/checker.js';

const data = loadDatasets();
// p_001 Aventus (base notes include vanilla) is a known dataset entry.
const aventus = data.perfumes.find((p) => p.id === 'p_001');
assert.ok(aventus, 'test fixture p_001 must exist');

function cleanInput(overrides = {}) {
  return {
    text: '## Your look\n\nOutfit harmony score: **85/100**\n\n## Fragrance pick\n\n**Aventus** by Creed (id: `p_001`) — Match score: **80/100**\n\n## Assumptions\n- season assumed: autumn',
    structured: {
      look: { score: 85, items: [] },
      fragrance: { results: [{ id: 'p_001', name: 'Aventus', brand: 'Creed', score: 80 }] },
      slots: { avoidNotes: [] },
      assumptions: ['season assumed: autumn'],
      data,
    },
    slots: { avoidNotes: [] },
    data,
    ...overrides,
  };
}

describe('Checker C1–C6', () => {
  test('passes a clean reply', () => {
    const res = checkReply(cleanInput());
    assert.equal(res.passed, true);
    assert.deepEqual(res.failures, []);
    assert.match(res.verdict, /PASS/);
    assert.equal(res.structured.fragrance.results.length, 1);
  });

  test('C1: unknown fragrance id in text is flagged and removed', () => {
    const res = checkReply(cleanInput({ text: 'Try **Mystery** (id: `p_999`) today.' }));
    assert.equal(res.passed, false);
    assert.ok(res.failures.some((f) => f.id === 'C1'));
    assert.ok(!res.text.includes('p_999'));
  });

  test('C1: unknown id in structured results is dropped from the shortlist', () => {
    const input = cleanInput();
    input.structured.fragrance.results = [{ id: 'p_999', name: 'Mystery', brand: 'None', score: 99 }];
    input.text = '## Fragrance pick\n\n**Mystery** (id: `p_999`)';
    const res = checkReply(input);
    assert.ok(res.failures.some((f) => f.id === 'C1'));
    assert.equal(res.structured.fragrance.results.length, 0);
  });

  test('C2: fragrance containing an avoided note is dropped', () => {
    assert.ok(
      (aventus.notes.base || []).map((n) => n.toLowerCase()).includes('vanilla'),
      'fixture: Aventus must contain vanilla for this test'
    );
    const input = cleanInput();
    input.slots = { avoidNotes: ['vanilla'] };
    input.structured.slots = { avoidNotes: ['vanilla'] };
    const res = checkReply(input);
    assert.ok(res.failures.some((f) => f.id === 'C2'));
    assert.equal(res.structured.fragrance.results.length, 0);
    assert.ok(res.repairs.join(' ').includes('p_001'));
  });

  test('C3: low outfit score without disclosure gets an honest note appended', () => {
    const input = cleanInput();
    input.structured.look.score = 55;
    input.text = '## Your look\n\nOutfit harmony score: **55/100**';
    const res = checkReply(input);
    assert.ok(res.failures.some((f) => f.id === 'C3'));
    assert.match(res.text, /scored 55\/100, below our 70 threshold/);
  });

  test('C3: low score with an honest disclosure already present passes', () => {
    const input = cleanInput();
    input.structured.look.score = 55;
    input.text = '## Your look\n\nOutfit harmony score: **55/100**\n\n*Honest note: this outfit scored 55/100, below our 70 threshold.*';
    const res = checkReply(input);
    assert.ok(!res.failures.some((f) => f.id === 'C3'));
  });

  test('C4: missing Assumptions section is added when defaults were applied', () => {
    const input = cleanInput();
    input.text = '## Your look\n\nOutfit harmony score: **85/100**';
    const res = checkReply(input);
    assert.ok(res.failures.some((f) => f.id === 'C4'));
    assert.match(res.text, /## Assumptions/);
    assert.match(res.text, /season assumed: autumn/);
  });

  test('C5: banned claims are stripped, including hypoallergenic', () => {
    const res = checkReply(
      cleanInput({ text: 'This is guaranteed to impress and will get you the job. It is hypoallergenic and perfect for everyone.' })
    );
    assert.ok(res.failures.some((f) => f.id === 'C5'));
    assert.ok(!/guaranteed|will get you the job|hypoallergenic|perfect for everyone/i.test(res.text));
  });

  test('C6: fragrance missing its dataset id gets the id appended', () => {
    const res = checkReply(cleanInput({ text: '## Fragrance pick\n\n**Aventus** by Creed is a great pick.' }));
    assert.ok(res.failures.some((f) => f.id === 'C6'));
    assert.ok(res.text.includes('`p_001`'));
  });

  test('createChecker returns the orchestrator-shaped { check } interface', async () => {
    const checker = createChecker(data);
    const res = await checker.check(cleanInput());
    assert.equal(res.passed, true);
    assert.equal(typeof res.text, 'string');
  });

  test('checker never invents a fragrance: repairs only remove or disclose', () => {
    const res = checkReply(cleanInput({ text: 'This is guaranteed. Try p_999.' }));
    const ids = res.text.match(/p_\d{3}/g) || [];
    for (const id of ids) assert.ok(data.perfumes.some((p) => p.id === id));
  });
});
