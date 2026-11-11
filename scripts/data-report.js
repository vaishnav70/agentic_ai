/**
 * Data Quality and Verification Report Script for StyleScent.
 *
 * What: Computes distribution statistics, data warnings, demo-coverage analysis,
 * and outputs a manual verification checklist to console and `data/VERIFY.md`.
 * Why: Allows the team to audit coverage across seasons, occasions, notes, and price bands,
 * identifying gaps and preparing for live demo golden tests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEASONS,
  OCCASIONS,
  FAMILIES,
  PRICE_BANDS,
  PROJECTION,
  MARKETED_FOR,
} from '../src/data/enums.js';

/**
 * Generates the verification report and markdown file.
 *
 * @param {object} [options]
 * @param {string} [options.perfumesPath]
 * @param {string} [options.verifyOut]
 * @returns {{ stats: object, warnings: string[], demoMatches: object[], markdown: string }}
 */
export function generateReport({
  perfumesPath = path.resolve('data/perfumes.json'),
  verifyOut = path.resolve('data/VERIFY.md'),
} = {}) {
  if (!fs.existsSync(perfumesPath)) {
    throw new Error(`Perfumes file not found at ${perfumesPath}`);
  }

  /** @type {any[]} */
  const perfumes = JSON.parse(fs.readFileSync(perfumesPath, 'utf8'));
  const total = perfumes.length;

  const verifiedCount = perfumes.filter((p) => p.verified === true).length;
  const verifiedShare = total > 0 ? ((verifiedCount / total) * 100).toFixed(1) : '0.0';

  // 1. Group counts
  const familyCounts = Object.fromEntries(FAMILIES.map((f) => [f, 0]));
  const seasonCounts = Object.fromEntries(SEASONS.map((s) => [s, 0]));
  const occasionCounts = Object.fromEntries(OCCASIONS.map((o) => [o, 0]));
  const priceCounts = Object.fromEntries([
    ...PRICE_BANDS.map((p) => [p, 0]),
    ['null', 0],
  ]);
  const projectionCounts = Object.fromEntries([
    ...PROJECTION.map((pr) => [pr, 0]),
    ['null', 0],
  ]);
  const marketedCounts = Object.fromEntries(MARKETED_FOR.map((m) => [m, 0]));

  for (const p of perfumes) {
    if (familyCounts[p.family] !== undefined) familyCounts[p.family]++;

    (p.seasons || []).forEach((s) => {
      if (seasonCounts[s] !== undefined) seasonCounts[s]++;
    });

    (p.occasions || []).forEach((o) => {
      if (occasionCounts[o] !== undefined) occasionCounts[o]++;
    });

    const priceKey = p.price_band || 'null';
    if (priceCounts[priceKey] !== undefined) priceCounts[priceKey]++;

    const projKey = p.projection || 'null';
    if (projectionCounts[projKey] !== undefined) projectionCounts[projKey]++;

    if (marketedCounts[p.marketed_for] !== undefined) {
      marketedCounts[p.marketed_for]++;
    }
  }

  // 2. Compute Warnings
  const warnings = [];

  // Season < 6
  for (const s of SEASONS) {
    if (seasonCounts[s] < 6) {
      warnings.push(`Season "${s}" has only ${seasonCounts[s]} fragrances (threshold: 6).`);
    }
  }

  // Occasion < 6
  for (const o of OCCASIONS) {
    if (occasionCounts[o] < 6) {
      warnings.push(
        `Occasion "${o}" has only ${occasionCounts[o]} fragrances (threshold: 6).`
      );
    }
  }

  // Price band < 8
  for (const pb of PRICE_BANDS) {
    if (priceCounts[pb] < 8) {
      warnings.push(
        `Price band "${pb}" has only ${priceCounts[pb]} fragrances (threshold: 8).`
      );
    }
  }

  // Null projection / longevity / price band
  const nullProjection = perfumes.filter((p) => p.projection === null);
  if (nullProjection.length > 0) {
    warnings.push(
      `${nullProjection.length} entries have null projection: ${nullProjection.map((p) => p.name).join(', ')}`
    );
  }

  const nullLongevity = perfumes.filter((p) => p.longevity === null);
  if (nullLongevity.length > 0) {
    warnings.push(
      `${nullLongevity.length} entries have null longevity: ${nullLongevity.map((p) => p.name).join(', ')}`
    );
  }

  const nullPriceBand = perfumes.filter((p) => p.price_band === null);
  if (nullPriceBand.length > 0) {
    warnings.push(
      `${nullPriceBand.length} entries have null price band: ${nullPriceBand.map((p) => p.name).join(', ')}`
    );
  }

  // Low confidence / Low source agreement
  const lowConfidence = perfumes.filter((p) => p.confidence === 'low');
  if (lowConfidence.length > 0) {
    warnings.push(
      `${lowConfidence.length} entries have "low" confidence: ${lowConfidence.map((p) => p.name).join(', ')}`
    );
  }

  const lowAgreement = perfumes.filter((p) => p.source_agreement === 'low');
  if (lowAgreement.length > 0) {
    warnings.push(
      `${lowAgreement.length} entries have "low" source agreement: ${lowAgreement.map((p) => p.name).join(', ')}`
    );
  }

  // 3. Demo-coverage check
  // Occasion: college_fest + Season: autumn/winter + Time: evening/night + No vanilla, No musk
  const demoMatches = perfumes.filter((p) => {
    const occMatch = Array.isArray(p.occasions) && p.occasions.includes('college_fest');
    const seasonMatch =
      Array.isArray(p.seasons) &&
      (p.seasons.includes('autumn') || p.seasons.includes('winter'));
    const timeMatch =
      Array.isArray(p.time_of_day) &&
      (p.time_of_day.includes('evening') || p.time_of_day.includes('night'));

    const allNotes = [
      ...(p.notes?.top || []),
      ...(p.notes?.heart || []),
      ...(p.notes?.base || []),
    ].map((n) => String(n).toLowerCase());

    const hasVanillaOrMusk = allNotes.some(
      (n) => n.includes('vanilla') || n.includes('musk')
    );

    return occMatch && seasonMatch && timeMatch && !hasVanillaOrMusk;
  });

  if (demoMatches.length < 3) {
    warnings.push(
      `Demo coverage check: only ${demoMatches.length} fragrance(s) match college_fest + autumn/winter + evening/night without vanilla/musk (threshold: 3).`
    );
  }

  // 4. Build Markdown
  const lines = [];
  lines.push('# StyleScent Data Quality & Verification Audit\n');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Fragrances: **${total}**`);
  lines.push(`Verified Entries: **${verifiedCount} / ${total} (${verifiedShare}%)**\n`);

  lines.push('## 1. Coverage Distributions\n');

  lines.push('### By Olfactory Family');
  lines.push('| Family | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(familyCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('### By Season');
  lines.push('| Season | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(seasonCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('### By Occasion');
  lines.push('| Occasion | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(occasionCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('### By Price Band');
  lines.push('| Price Band | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(priceCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('### By Projection');
  lines.push('| Projection | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(projectionCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('### By Target Demographic');
  lines.push('| Demographic | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(marketedCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('## 2. Audit Warnings\n');
  if (warnings.length === 0) {
    lines.push('No data quality warnings. All thresholds satisfied.\n');
  } else {
    warnings.forEach((w) => lines.push(`- ⚠️ ${w}`));
    lines.push('');
  }

  lines.push('## 3. Demo Coverage Check\n');
  lines.push(
    '> Criteria: Occasion = `college_fest` AND Season ∈ {`autumn`, `winter`} AND Time ∈ {`evening`, `night`} AND Notes exclude `vanilla` and `musk`.'
  );
  lines.push('');
  lines.push(`Matching Fragrances Found: **${demoMatches.length}**`);
  if (demoMatches.length > 0) {
    lines.push('| ID | Name | Brand | Price Band | Longevity |');
    lines.push('|---|---|---|---|---|');
    demoMatches.forEach((m) => {
      lines.push(
        `| ${m.id} | ${m.name} | ${m.brand} | ${m.price_band || 'N/A'} | ${m.longevity || 'N/A'} |`
      );
    });
  } else {
    lines.push('_None currently match all 4 criteria. Flagged for seed data expansion._');
  }
  lines.push('');

  lines.push('## 4. Unverified Entries Checklist\n');
  const unverified = perfumes.filter((p) => !p.verified);
  lines.push(
    `The following **${unverified.length}** entries require team verification prior to judging demo usage:\n`
  );
  lines.push('| ID | Fragrance Name | Brand | Family | Confidence | Verified |');
  lines.push('|---|---|---|---|---|:---:|');
  unverified.forEach((p) => {
    lines.push(
      `| ${p.id} | ${p.name} | ${p.brand} | ${p.family} | ${p.confidence} | [ ] |`
    );
  });
  lines.push('');

  const markdown = lines.join('\n');

  if (verifyOut) {
    fs.mkdirSync(path.dirname(verifyOut), { recursive: true });
    fs.writeFileSync(verifyOut, markdown, 'utf8');
  }

  return {
    stats: {
      total,
      verifiedCount,
      verifiedShare,
      familyCounts,
      seasonCounts,
      occasionCounts,
      priceCounts,
      projectionCounts,
      marketedCounts,
    },
    warnings,
    demoMatches,
    markdown,
  };
}

// Execute directly if run as CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = generateReport({});
    console.log(report.markdown);
  } catch (err) {
    console.error('Failed to generate verification report:', err.message);
    process.exit(1);
  }
}
