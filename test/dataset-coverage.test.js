/**
 * Dataset coverage tests (Milestone M1 follow-up, 11 Nov 2026).
 *
 * What: Guards the coverage thresholds the repo's own data-report audits
 * (scripts/data-report.js): every season/occasion/price band must have
 * enough entries for the golden scenarios to find a match, and the
 * headline demo check (college fest evening, no vanilla/musk) must have
 * at least 3 matches.
 * Why: The 20-perfume dataset failed Golden 1 outright — 0 entries for
 * college_fest and 0 demo-check matches. These tests stop that regressing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDatasets } from '../src/data/load.js';

const { perfumes } = loadDatasets();

function allNotes(p) {
  return [...(p.notes.top || []), ...(p.notes.heart || []), ...(p.notes.base || [])]
    .map((n) => n.toLowerCase());
}

describe('Dataset coverage', () => {
  test('has at least 35 perfumes', () => {
    assert.ok(perfumes.length >= 35, `only ${perfumes.length} perfumes`);
  });

  test('college_fest has at least 6 entries', () => {
    const n = perfumes.filter((p) => p.occasions.includes('college_fest')).length;
    assert.ok(n >= 6, `college_fest has ${n}`);
  });

  test('interview has at least 6 entries', () => {
    const n = perfumes.filter((p) => p.occasions.includes('interview')).length;
    assert.ok(n >= 6, `interview has ${n}`);
  });

  test('budget band has at least 8 entries', () => {
    const n = perfumes.filter((p) => p.price_band === 'budget').length;
    assert.ok(n >= 8, `budget has ${n}`);
  });

  test('women and unisex entries exist', () => {
    assert.ok(perfumes.some((p) => p.marketed_for === 'women'), 'no women entries');
    assert.ok(perfumes.some((p) => p.marketed_for === 'unisex'), 'no unisex entries');
  });

  test('citrus family and summer season are covered', () => {
    assert.ok(perfumes.some((p) => p.family === 'citrus'), 'no citrus entries');
    assert.ok(perfumes.filter((p) => p.seasons.includes('summer')).length >= 6, 'summer thin');
  });

  test('demo check: at least 3 college-fest autumn/winter evening/night picks without vanilla or musk', () => {
    const matches = perfumes.filter(
      (p) =>
        p.occasions.includes('college_fest') &&
        p.seasons.some((s) => s === 'autumn' || s === 'winter') &&
        p.time_of_day.some((t) => t === 'evening' || t === 'night') &&
        !allNotes(p).includes('vanilla') &&
        !allNotes(p).includes('musk')
    );
    assert.ok(matches.length >= 3, `demo check has ${matches.length} matches`);
  });

  test('every entry is schema-valid with notes and an explicit verified flag', () => {
    const ids = new Set();
    for (const p of perfumes) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
      ids.add(p.id);
      assert.ok(allNotes(p).length > 0, `${p.id} has no notes`);
      assert.equal(typeof p.verified, 'boolean', `${p.id} missing verified flag`);
    }
  });
});
