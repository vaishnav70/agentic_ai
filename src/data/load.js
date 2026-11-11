/**
 * Data Loader and Cross-Validation Module.
 *
 * What: Loads, parses, schema-validates, and cross-checks all core JSON datasets
 * (perfumes.json, colour_rules.json, patterns.json, tone_map.json).
 * Why: Guarantees relational integrity across distinct data files at server startup,
 * enforcing fail-fast behavior if data is corrupted, duplicate IDs exist, or cross-references fail.
 */

import fs from 'node:fs';
import path from 'node:path';
import { OCCASIONS } from './enums.js';
import {
  perfumesArraySchema,
  colourRulesSchema,
  patternsSchema,
  toneMapSchema,
} from './schemas.js';

/**
 * Loads and validates all four datasets, throwing detailed errors on failure.
 *
 * @param {string} [baseDir] Directory path containing the data JSON files.
 * @returns {Readonly<{
 *   perfumes: import('zod').infer<typeof perfumesArraySchema>,
 *   colourRules: import('zod').infer<typeof colourRulesSchema>,
 *   patterns: import('zod').infer<typeof patternsSchema>,
 *   toneMap: import('zod').infer<typeof toneMapSchema>,
 * }>}
 */
export function loadData(baseDir = path.resolve('data')) {
  const perfumesPath = path.join(baseDir, 'perfumes.json');
  const colourRulesPath = path.join(baseDir, 'colour_rules.json');
  const patternsPath = path.join(baseDir, 'patterns.json');
  const toneMapPath = path.join(baseDir, 'tone_map.json');

  // Helper to read and JSON-parse with file-level error attribution
  function readJson(filePath, filename) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found: ${filename} (expected at ${filePath})`);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Malformed JSON in ${filename}: ${err.message}`);
    }
  }

  // 1. Read files
  const rawPerfumes = readJson(perfumesPath, 'perfumes.json');
  const rawColourRules = readJson(colourRulesPath, 'colour_rules.json');
  const rawPatterns = readJson(patternsPath, 'patterns.json');
  const rawToneMap = readJson(toneMapPath, 'tone_map.json');

  // 2. Validate with Zod schemas
  let perfumes;
  try {
    perfumes = perfumesArraySchema.parse(rawPerfumes);
  } catch (err) {
    const details = err.issues
      ? err.issues.map((i) => `entry [${i.path.join('.')}] - ${i.message}`).join(', ')
      : err.message;
    throw new Error(`Schema validation failed in perfumes.json: ${details}`);
  }

  let colourRules;
  try {
    colourRules = colourRulesSchema.parse(rawColourRules);
  } catch (err) {
    const details = err.issues
      ? err.issues.map((i) => `entry [${i.path.join('.')}] - ${i.message}`).join(', ')
      : err.message;
    throw new Error(`Schema validation failed in colour_rules.json: ${details}`);
  }

  let patterns;
  try {
    patterns = patternsSchema.parse(rawPatterns);
  } catch (err) {
    const details = err.issues
      ? err.issues.map((i) => `entry [${i.path.join('.')}] - ${i.message}`).join(', ')
      : err.message;
    throw new Error(`Schema validation failed in patterns.json: ${details}`);
  }

  let toneMap;
  try {
    toneMap = toneMapSchema.parse(rawToneMap);
  } catch (err) {
    const details = err.issues
      ? err.issues.map((i) => `entry [${i.path.join('.')}] - ${i.message}`).join(', ')
      : err.message;
    throw new Error(`Schema validation failed in tone_map.json: ${details}`);
  }

  // 3. Cross-file integrity checks

  // Cross-check A: Unique perfume IDs
  const seenIds = new Set();
  for (const p of perfumes) {
    if (seenIds.has(p.id)) {
      throw new Error(
        `Cross-file check failed in perfumes.json: duplicate perfume ID "${p.id}" for entry "${p.name}" (${p.brand})`
      );
    }
    seenIds.add(p.id);
  }

  // Cross-check B: Every pairing rule uses valid patterns from the patterns list
  const allowedPatternSet = new Set(patterns.patterns);
  for (const rule of patterns.pairing_rules) {
    if (!allowedPatternSet.has(rule.a)) {
      throw new Error(
        `Cross-file check failed in patterns.json: pairing rule references unknown pattern "${rule.a}"`
      );
    }
    if (!allowedPatternSet.has(rule.b)) {
      throw new Error(
        `Cross-file check failed in patterns.json: pairing rule references unknown pattern "${rule.b}"`
      );
    }
  }

  // Cross-check C: Every occasion in OCCASIONS has an occasion palette
  for (const occ of OCCASIONS) {
    const palette = colourRules.occasion_palettes[occ];
    if (!Array.isArray(palette) || palette.length === 0) {
      throw new Error(
        `Cross-file check failed in colour_rules.json: missing or empty occasion palette for occasion "${occ}"`
      );
    }
  }

  return Object.freeze({
    perfumes,
    colourRules,
    patterns,
    toneMap,
  });
}

export const loadDatasets = loadData;
