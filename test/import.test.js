/**
 * Unit Tests for Research Import Script.
 *
 * What: Validates deduplication, longevity parsing, rejection rules, enum cleaning,
 * and overwrite protection using small, isolated test fixtures.
 * Why: Ensures data integrity during import without relying on the size or contents
 * of the live production dataset.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  importResearch,
  parseLongevity,
  normalizeDedupeKey,
} from '../scripts/import-research.js';

describe('Research Import Script', () => {
  describe('parseLongevity', () => {
    test('parses range strings and calculates midpoint categories', () => {
      assert.deepEqual(parseLongevity('6-8'), {
        min: 6,
        max: 8,
        longevity: 'medium',
      });
      assert.deepEqual(parseLongevity('5-10 hours'), {
        min: 5,
        max: 10,
        longevity: 'long',
      });
      assert.deepEqual(parseLongevity('2 to 4 hours'), {
        min: 2,
        max: 4,
        longevity: 'short',
      });
    });

    test('parses single number strings', () => {
      assert.deepEqual(parseLongevity('8'), {
        min: 8,
        max: 8,
        longevity: 'long',
      });
      assert.deepEqual(parseLongevity('3 hours'), {
        min: 3,
        max: 3,
        longevity: 'short',
      });
    });

    test('returns nulls for invalid or missing longevity', () => {
      assert.deepEqual(parseLongevity(null), {
        min: null,
        max: null,
        longevity: null,
      });
      assert.deepEqual(parseLongevity('untested'), {
        min: null,
        max: null,
        longevity: null,
      });
    });
  });

  describe('normalizeDedupeKey', () => {
    test('normalizes casing, accents, punctuation, and extra whitespace', () => {
      assert.equal(
        normalizeDedupeKey('  Terre d’Hermès  '),
        'terre d hermes'
      );
      assert.equal(
        normalizeDedupeKey('Althaïr (EdP)!'),
        'althair edp'
      );
    });
  });

  describe('importResearch pipeline with fixtures', () => {
    let tempDir;

    before(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylescent-test-import-'));
    });

    after(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('deduplicates matching entries, keeps higher confidence, merges sources, keeps lower rank', async () => {
      const rawDir = path.join(tempDir, 'raw-dedupe');
      fs.mkdirSync(rawDir, { recursive: true });

      const rawItems = [
        {
          rank: 5,
          name: 'Aventus',
          brand: 'Creed',
          marketed_for: 'men',
          family: 'fruity',
          notes: { top: ['lemon'], heart: ['rose'], base: ['amber'] },
          confidence: 'medium',
          sources: ['https://source-a.com'],
          verified: false,
        },
        {
          rank: 2,
          name: ' aventus! ',
          brand: 'creed',
          marketed_for: 'men',
          family: 'fruity',
          notes: { top: ['bergamot'], heart: ['patchouli'], base: ['oakmoss'] },
          confidence: 'high', // higher confidence should be chosen
          sources: ['https://source-b.com'],
          verified: false,
        },
      ];

      fs.writeFileSync(
        path.join(rawDir, 'items.json'),
        JSON.stringify(rawItems),
        'utf8'
      );

      const perfumesOut = path.join(tempDir, 'perfumes-dedupe.json');
      const reportOut = path.join(tempDir, 'report-dedupe.json');

      const { perfumes, report } = await importResearch({
        rawDir,
        perfumesOut,
        reportOut,
        force: true,
      });

      assert.equal(report.entries_read, 2);
      assert.equal(report.duplicates_merged, 1);
      assert.equal(report.kept, 1);
      assert.equal(perfumes.length, 1);

      const kept = perfumes[0];
      assert.equal(kept.name, 'aventus!');
      assert.equal(kept.confidence, 'high');
      assert.equal(kept.rank, 2); // best (lower) rank preserved
      assert.equal(kept.sources.length, 2);
      assert.ok(kept.sources.includes('https://source-a.com'));
      assert.ok(kept.sources.includes('https://source-b.com'));
    });

    test('rejection rules discard entries missing name, brand, family, or notes', async () => {
      const rawDir = path.join(tempDir, 'raw-rejects');
      fs.mkdirSync(rawDir, { recursive: true });

      const badItems = [
        { brand: 'Chanel', family: 'woody', notes: { top: ['lemon'] } }, // missing name
        { name: 'No Brand', family: 'woody', notes: { top: ['lemon'] } }, // missing brand
        { name: 'Bad Fam', brand: 'Dior', family: 'not_a_family', notes: { top: ['lemon'] } },
        { name: 'No Notes', brand: 'YSL', family: 'fresh', notes: { top: [], heart: [], base: [] } },
      ];

      fs.writeFileSync(
        path.join(rawDir, 'bad.json'),
        JSON.stringify(badItems),
        'utf8'
      );

      const perfumesOut = path.join(tempDir, 'perfumes-reject.json');
      const reportOut = path.join(tempDir, 'report-reject.json');

      const { perfumes, report } = await importResearch({
        rawDir,
        perfumesOut,
        reportOut,
        force: true,
      });

      assert.equal(report.entries_read, 4);
      assert.equal(report.rejected.length, 4);
      assert.equal(report.kept, 0);
      assert.equal(perfumes.length, 0);
    });

    test('drops unknown enum values from seasons and occasions with warnings', async () => {
      const rawDir = path.join(tempDir, 'raw-enums');
      fs.mkdirSync(rawDir, { recursive: true });

      const itemWithWeirdEnums = [
        {
          name: 'Enum Test',
          brand: 'Brand X',
          family: 'citrus',
          notes: { top: ['grapefruit'] },
          seasons: ['summer', 'monsoon_rainy'], // monsoon_rainy invalid
          occasions: ['office', 'underwater_diving'], // underwater_diving invalid
        },
      ];

      fs.writeFileSync(
        path.join(rawDir, 'item.json'),
        JSON.stringify(itemWithWeirdEnums),
        'utf8'
      );

      const perfumesOut = path.join(tempDir, 'perfumes-enums.json');
      const reportOut = path.join(tempDir, 'report-enums.json');

      const { perfumes, report } = await importResearch({
        rawDir,
        perfumesOut,
        reportOut,
        force: true,
      });

      assert.equal(perfumes.length, 1);
      assert.deepEqual(perfumes[0].seasons, ['summer']);
      assert.deepEqual(perfumes[0].occasions, ['office']);
      assert.ok(report.warnings.some((w) => w.includes('monsoon_rainy')));
      assert.ok(report.warnings.some((w) => w.includes('underwater_diving')));
    });

    test('refuses to overwrite when verified: true exists unless --force is specified', async () => {
      const rawDir = path.join(tempDir, 'raw-protect');
      fs.mkdirSync(rawDir, { recursive: true });

      fs.writeFileSync(
        path.join(rawDir, 'new.json'),
        JSON.stringify([
          {
            name: 'New Scent',
            brand: 'Brand Y',
            family: 'woody',
            notes: { top: ['cedar'] },
          },
        ]),
        'utf8'
      );

      const perfumesOut = path.join(tempDir, 'perfumes-protect.json');
      const reportOut = path.join(tempDir, 'report-protect.json');

      // Pre-seed file with one verified: true entry
      fs.writeFileSync(
        perfumesOut,
        JSON.stringify([
          {
            id: 'p_001',
            name: 'Hand Verified',
            brand: 'Brand Z',
            verified: true,
          },
        ]),
        'utf8'
      );

      // Without force: throws
      await assert.rejects(
        () =>
          importResearch({
            rawDir,
            perfumesOut,
            reportOut,
            force: false,
          }),
        /Refusing to overwrite/
      );

      // With force: succeeds
      const result = await importResearch({
        rawDir,
        perfumesOut,
        reportOut,
        force: true,
      });
      assert.equal(result.perfumes.length, 1);
    });
  });
});
