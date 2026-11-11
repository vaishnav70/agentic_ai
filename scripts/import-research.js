/**
 * Research Import Script for StyleScent.
 *
 * What: Ingests raw fragrance research from `data/raw/*.json`, cleans, deduplicates,
 * parses longevity, infers time_of_day and vibe, validates, and outputs `data/perfumes.json`
 * alongside an audit report in `data/import-report.json`.
 * Why: Keeps research ingestion automated, deterministic, reproducible, and verifiable,
 * protecting hand-edited verified entries and documenting all warnings and discarded entries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEASONS,
  OCCASIONS,
  FAMILIES,
  MARKETED_FOR,
  PROJECTION,
  PRICE_BANDS,
  LEVELS,
} from '../src/data/enums.js';
import { inferTimeOfDay, inferVibes } from '../src/data/inference.js';
import { perfumeSchema } from '../src/data/schemas.js';

/**
 * Normalizes text for deduplication matching (removes accents, punctuation, collapses whitespace).
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizeDedupeKey(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses longevity hours string into numeric min, max, and categorized longevity enum.
 *
 * @param {string|null} str e.g. "6-8", "8", "6 to 8", "5-10 hours"
 * @returns {{ min: number|null, max: number|null, longevity: 'short'|'medium'|'long'|null }}
 */
export function parseLongevity(str) {
  if (!str || typeof str !== 'string') {
    return { min: null, max: null, longevity: null };
  }

  const trimmed = str.trim();
  const rangeMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    const mid = (min + max) / 2;
    const longevity = mid < 4 ? 'short' : mid <= 7 ? 'medium' : 'long';
    return { min, max, longevity };
  }

  const singleMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    const longevity = val < 4 ? 'short' : val <= 7 ? 'medium' : 'long';
    return { min: val, max: val, longevity };
  }

  return { min: null, max: null, longevity: null };
}

/**
 * Confidence ranking score for deduplication tie-breaking.
 */
const CONFIDENCE_SCORE = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Imports research JSON files and generates `perfumes.json` and `import-report.json`.
 *
 * @param {object} [options]
 * @param {string} [options.rawDir] Directory containing raw JSON files.
 * @param {string} [options.perfumesOut] Destination path for perfumes.json.
 * @param {string} [options.reportOut] Destination path for import-report.json.
 * @param {boolean} [options.force] Overwrite even if verified entries exist.
 * @returns {Promise<{ perfumes: object[], report: object }>}
 */
export async function importResearch({
  rawDir = path.resolve('data/raw'),
  perfumesOut = path.resolve('data/perfumes.json'),
  reportOut = path.resolve('data/import-report.json'),
  force = false,
} = {}) {
  // Check overwrite protection if destination file exists
  if (fs.existsSync(perfumesOut) && !force) {
    try {
      const existing = JSON.parse(fs.readFileSync(perfumesOut, 'utf8'));
      if (Array.isArray(existing) && existing.some((p) => p.verified === true)) {
        throw new Error(
          `Refusing to overwrite ${perfumesOut} because it contains verified entries. Use --force to override.`
        );
      }
    } catch (err) {
      if (err.message.includes('Refusing to overwrite')) {
        throw err;
      }
      // If unparseable or other error, proceed
    }
  }

  const report = {
    files_read: [],
    entries_read: 0,
    kept: 0,
    duplicates_merged: 0,
    rejected: [],
    warnings: [],
  };

  if (!fs.existsSync(rawDir)) {
    throw new Error(`Raw directory not found: ${rawDir}`);
  }

  const rawFiles = fs
    .readdirSync(rawDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (rawFiles.length === 0) {
    report.warnings.push(`No .json files found in ${rawDir}`);
  }

  /** @type {Map<string, object>} */
  const entriesByDedupeKey = new Map();

  for (const file of rawFiles) {
    const filePath = path.join(rawDir, file);
    report.files_read.push(path.relative(process.cwd(), filePath).replace(/\\/g, '/'));

    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) {
      report.warnings.push(`File ${file} is empty (0 bytes), skipped.`);
      continue;
    }

    let items;
    try {
      items = JSON.parse(content);
    } catch (err) {
      report.warnings.push(`Failed to parse JSON in ${file}: ${err.message}`);
      continue;
    }

    if (!Array.isArray(items)) {
      report.warnings.push(`File ${file} does not contain a JSON array, skipped.`);
      continue;
    }

    for (let i = 0; i < items.length; i++) {
      report.entries_read++;
      const raw = items[i];

      // 1. Check rejection rules: name, brand, family required
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';
      const rawFamily = typeof raw.family === 'string' ? raw.family.trim().toLowerCase() : '';

      if (!name) {
        report.rejected.push({ entry: raw, reason: 'Missing name' });
        continue;
      }
      if (!brand) {
        report.rejected.push({ entry: raw, reason: 'Missing brand' });
        continue;
      }
      if (!rawFamily || !FAMILIES.includes(rawFamily)) {
        report.rejected.push({
          entry: raw,
          reason: `Missing or invalid family "${raw.family}"`,
        });
        continue;
      }

      // Check notes: must have at least one note across top, heart, base
      const topNotes = Array.isArray(raw.notes?.top)
        ? raw.notes.top.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        : [];
      const heartNotes = Array.isArray(raw.notes?.heart)
        ? raw.notes.heart.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        : [];
      const baseNotes = Array.isArray(raw.notes?.base)
        ? raw.notes.base.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
        : [];

      if (topNotes.length === 0 && heartNotes.length === 0 && baseNotes.length === 0) {
        report.rejected.push({
          entry: raw,
          reason: `No notes provided for "${name}" by "${brand}"`,
        });
        continue;
      }

      // 2. Normalise seasons and occasions (drop unknown values with warnings)
      const validSeasons = [];
      if (Array.isArray(raw.seasons)) {
        for (const s of raw.seasons) {
          const sLower = String(s).trim().toLowerCase();
          if (SEASONS.includes(sLower)) {
            if (!validSeasons.includes(sLower)) validSeasons.push(sLower);
          } else {
            report.warnings.push(
              `Unknown season "${s}" in "${name}" dropped.`
            );
          }
        }
      }

      const validOccasions = [];
      if (Array.isArray(raw.occasions)) {
        for (const o of raw.occasions) {
          const oLower = String(o).trim().toLowerCase();
          if (OCCASIONS.includes(oLower)) {
            if (!validOccasions.includes(oLower)) validOccasions.push(oLower);
          } else {
            report.warnings.push(
              `Unknown occasion "${o}" in "${name}" dropped.`
            );
          }
        }
      }

      // Normalise marketed_for
      const marketedFor =
        typeof raw.marketed_for === 'string' &&
        MARKETED_FOR.includes(raw.marketed_for.trim().toLowerCase())
          ? raw.marketed_for.trim().toLowerCase()
          : 'unisex';

      // Normalise projection
      const projection =
        typeof raw.projection === 'string' &&
        PROJECTION.includes(raw.projection.trim().toLowerCase())
          ? raw.projection.trim().toLowerCase()
          : null;

      // Normalise price band
      const priceBand =
        typeof raw.price_band === 'string' &&
        PRICE_BANDS.includes(raw.price_band.trim().toLowerCase())
          ? raw.price_band.trim().toLowerCase()
          : null;

      // Normalise confidence and source_agreement
      const confidence =
        typeof raw.confidence === 'string' &&
        LEVELS.includes(raw.confidence.trim().toLowerCase())
          ? raw.confidence.trim().toLowerCase()
          : 'medium';

      const sourceAgreement =
        typeof raw.source_agreement === 'string' &&
        LEVELS.includes(raw.source_agreement.trim().toLowerCase())
          ? raw.source_agreement.trim().toLowerCase()
          : 'medium';

      // Parse longevity
      const longevityHours =
        typeof raw.longevity_hours === 'string' && raw.longevity_hours.trim()
          ? raw.longevity_hours.trim()
          : null;
      const { min: longevityMin, max: longevityMax, longevity } =
        parseLongevity(longevityHours);

      // Sources
      const sources = Array.isArray(raw.sources)
        ? raw.sources.map((s) => String(s).trim()).filter(Boolean)
        : [];

      // Rank
      const rank =
        typeof raw.rank === 'number' && Number.isInteger(raw.rank) && raw.rank > 0
          ? raw.rank
          : null;

      // Construct normalized candidate
      const candidate = {
        rank,
        name,
        brand,
        marketed_for: marketedFor,
        family: rawFamily,
        notes: {
          top: topNotes,
          heart: heartNotes,
          base: baseNotes,
        },
        longevity_hours: longevityHours,
        longevity_min_hours: longevityMin,
        longevity_max_hours: longevityMax,
        longevity,
        projection,
        seasons: validSeasons,
        occasions: validOccasions,
        price_band: priceBand,
        sources,
        source_agreement: sourceAgreement,
        confidence,
        verified: Boolean(raw.verified),
      };

      // 3. Deduplication on name+brand
      const dedupeKey = `${normalizeDedupeKey(name)}|${normalizeDedupeKey(brand)}`;
      if (entriesByDedupeKey.has(dedupeKey)) {
        report.duplicates_merged++;
        const existing = entriesByDedupeKey.get(dedupeKey);

        const existingScore = CONFIDENCE_SCORE[existing.confidence] || 1;
        const candidateScore = CONFIDENCE_SCORE[candidate.confidence] || 1;

        // Better (lower) rank wins
        let bestRank = existing.rank;
        if (candidate.rank !== null) {
          if (bestRank === null || candidate.rank < bestRank) {
            bestRank = candidate.rank;
          }
        }

        // Union of sources
        const mergedSources = Array.from(
          new Set([...existing.sources, ...candidate.sources])
        );

        if (candidateScore > existingScore) {
          // Keep candidate as primary, transfer merged sources and best rank
          candidate.sources = mergedSources;
          candidate.rank = bestRank;
          candidate.verified = existing.verified || candidate.verified;
          entriesByDedupeKey.set(dedupeKey, candidate);
        } else {
          // Keep existing, update sources, rank, verified
          existing.sources = mergedSources;
          existing.rank = bestRank;
          existing.verified = existing.verified || candidate.verified;
        }
      } else {
        entriesByDedupeKey.set(dedupeKey, candidate);
      }
    }
  }

  // 4. Infer time_of_day and vibe, sort and assign IDs
  const deduplicatedList = Array.from(entriesByDedupeKey.values());

  // Sort by rank ascending (nulls last), then by name
  deduplicatedList.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) {
      if (a.rank !== b.rank) return a.rank - b.rank;
    } else if (a.rank !== null) {
      return -1;
    } else if (b.rank !== null) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });

  const finalPerfumes = deduplicatedList.map((entry, index) => {
    const id = `p_${String(index + 1).padStart(3, '0')}`;
    const timeOfDay = inferTimeOfDay(entry.family, entry.occasions);
    const vibe = inferVibes(entry.family, entry.projection, entry.occasions);

    const fullEntry = {
      id,
      rank: entry.rank,
      name: entry.name,
      brand: entry.brand,
      marketed_for: entry.marketed_for,
      family: entry.family,
      notes: entry.notes,
      longevity_hours: entry.longevity_hours,
      longevity_min_hours: entry.longevity_min_hours,
      longevity_max_hours: entry.longevity_max_hours,
      longevity: entry.longevity,
      projection: entry.projection,
      seasons: entry.seasons,
      occasions: entry.occasions,
      time_of_day: timeOfDay,
      vibe,
      price_band: entry.price_band,
      sources: entry.sources,
      source_agreement: entry.source_agreement,
      confidence: entry.confidence,
      verified: entry.verified,
      inferred_fields: ['time_of_day', 'vibe'],
      source: 'team research via web search',
    };

    // Schema validation assertion
    perfumeSchema.parse(fullEntry);
    return fullEntry;
  });

  report.kept = finalPerfumes.length;

  // Ensure output parent directory exists
  fs.mkdirSync(path.dirname(perfumesOut), { recursive: true });
  fs.mkdirSync(path.dirname(reportOut), { recursive: true });

  fs.writeFileSync(perfumesOut, JSON.stringify(finalPerfumes, null, 2) + '\n');
  fs.writeFileSync(reportOut, JSON.stringify(report, null, 2) + '\n');

  return { perfumes: finalPerfumes, report };
}

// Execute directly if run as CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const force = process.argv.includes('--force');
  importResearch({ force })
    .then(({ perfumes, report }) => {
      console.log('========================================================');
      console.log(' StyleScent Research Import Report');
      console.log('========================================================');
      console.log(`Files read:         ${report.files_read.join(', ') || 'None'}`);
      console.log(`Entries read:       ${report.entries_read}`);
      console.log(`Duplicates merged:  ${report.duplicates_merged}`);
      console.log(`Rejected:           ${report.rejected.length}`);
      console.log(`Kept & written:     ${report.kept}`);
      console.log(`Warnings logged:    ${report.warnings.length}`);
      if (report.warnings.length > 0) {
        console.log('\nWarnings:');
        report.warnings.forEach((w) => console.log(`  - ${w}`));
      }
      if (report.rejected.length > 0) {
        console.log('\nRejected entries:');
        report.rejected.forEach((r) =>
          console.log(`  - ${r.entry.name || 'unnamed'}: ${r.reason}`)
        );
      }
      console.log('========================================================\n');
    })
    .catch((err) => {
      console.error('Import failed:', err.message);
      process.exit(1);
    });
}
