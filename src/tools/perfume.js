/**
 * Deterministic Fragrance Matcher Tool for StyleScent.
 *
 * What: Filters and scores dataset fragrances against user constraints and styling slots.
 * Why: Guarantees explainable, deterministic fragrance recommendations grounded strictly
 * in verified/curated dataset entries, enforcing hard constraints before scoring.
 */

import {
  OCCASIONS,
  SEASONS,
  TIMES,
  VIBES,
  PROJECTION,
  PRICE_BANDS,
  MARKETED_FOR,
} from '../data/enums.js';
import { OCCASION_ALIASES } from '../data/aliases.js';

/**
 * Scoring weights for fragrance dimensions.
 */
export const PERFUME_WEIGHTS = {
  occasion: 25,
  season: 20,
  vibe: 20,
  projection: 10,
  longevity: 5,
  timeOfDay: 5,
  budgetFit: 10,
  consensusRank: 5,
};

/**
 * Validates match query fields against domain enums.
 *
 * @param {object} query
 */
function validateQuery(query) {
  if (!query || typeof query !== 'object') {
    throw new Error('Query must be an object.');
  }

  // occasion is required
  if (!query.occasion || !OCCASIONS.includes(query.occasion)) {
    throw new Error(
      `Invalid or missing "occasion": "${query.occasion}". Allowed: ${OCCASIONS.join(', ')}`
    );
  }

  if (query.season && !SEASONS.includes(query.season)) {
    throw new Error(`Invalid "season": "${query.season}". Allowed: ${SEASONS.join(', ')}`);
  }

  if (query.timeOfDay && !TIMES.includes(query.timeOfDay)) {
    throw new Error(
      `Invalid "timeOfDay": "${query.timeOfDay}". Allowed: ${TIMES.join(', ')}`
    );
  }

  if (query.vibe) {
    if (!Array.isArray(query.vibe)) {
      throw new Error('"vibe" must be an array of strings.');
    }
    for (const v of query.vibe) {
      if (!VIBES.includes(v)) {
        throw new Error(`Invalid vibe "${v}". Allowed: ${VIBES.join(', ')}`);
      }
    }
  }

  if (query.projection && !PROJECTION.includes(query.projection)) {
    throw new Error(
      `Invalid "projection": "${query.projection}". Allowed: ${PROJECTION.join(', ')}`
    );
  }

  if (
    query.minLongevityHours !== undefined &&
    query.minLongevityHours !== null &&
    (typeof query.minLongevityHours !== 'number' || query.minLongevityHours <= 0)
  ) {
    throw new Error('"minLongevityHours" must be a positive number.');
  }

  if (query.budget && !PRICE_BANDS.includes(query.budget)) {
    throw new Error(
      `Invalid "budget": "${query.budget}". Allowed: ${PRICE_BANDS.join(', ')}`
    );
  }

  if (query.marketedFor && !MARKETED_FOR.includes(query.marketedFor)) {
    throw new Error(
      `Invalid "marketedFor": "${query.marketedFor}". Allowed: ${MARKETED_FOR.join(', ')}`
    );
  }

  if (query.avoidNotes && !Array.isArray(query.avoidNotes)) {
    throw new Error('"avoidNotes" must be an array of strings.');
  }

  if (query.requireNotes && !Array.isArray(query.requireNotes)) {
    throw new Error('"requireNotes" must be an array of strings.');
  }
}

/**
 * Matches, filters, and scores fragrances from the dataset.
 *
 * @param {object} query
 * @param {object[]} perfumes
 * @param {object} [options]
 * @param {number} [options.k=3]
 * @param {number} [options.threshold=40]
 * @returns {{
 *   results: Array<{
 *     id: string,
 *     name: string,
 *     brand: string,
 *     score: number,
 *     reasons: string[],
 *     matched: object,
 *     caveats: string[],
 *   }>,
 *   reason: string|null,
 *   best_score: number|null,
 *   filtered_out: { avoidNotes: number, requireNotes: number, budget: number, marketedFor: number },
 *   considered: number,
 * }}
 */
export function matchPerfumes(
  query,
  perfumes,
  { k = 3, threshold = 40 } = {}
) {
  validateQuery(query);

  if (!Array.isArray(perfumes)) {
    throw new Error('Perfumes parameter must be an array.');
  }

  const filteredOut = {
    avoidNotes: 0,
    requireNotes: 0,
    budget: 0,
    marketedFor: 0,
  };

  // Find max rank in the provided input perfumes (for consensusRank scoring)
  const maxRankInInput = Math.max(
    ...perfumes.map((p) => (typeof p.rank === 'number' ? p.rank : 0)),
    1
  );

  // 1. Apply Hard Filters
  const candidates = [];

  for (const p of perfumes) {
    const allNotes = [
      ...(p.notes?.top || []),
      ...(p.notes?.heart || []),
      ...(p.notes?.base || []),
    ].map((n) => String(n).toLowerCase());

    // Filter A: avoidNotes
    if (Array.isArray(query.avoidNotes) && query.avoidNotes.length > 0) {
      const hasAvoided = query.avoidNotes.some((avoidTerm) => {
        const term = String(avoidTerm).trim().toLowerCase();
        return term && allNotes.some((note) => note.includes(term));
      });
      if (hasAvoided) {
        filteredOut.avoidNotes++;
        continue;
      }
    }

    // Filter B: requireNotes
    if (Array.isArray(query.requireNotes) && query.requireNotes.length > 0) {
      const hasAllRequired = query.requireNotes.every((reqTerm) => {
        const term = String(reqTerm).trim().toLowerCase();
        return !term || allNotes.some((note) => note.includes(term));
      });
      if (!hasAllRequired) {
        filteredOut.requireNotes++;
        continue;
      }
    }

    // Filter C: budget
    if (query.budget) {
      const allowedBands =
        query.budget === 'budget'
          ? ['budget']
          : query.budget === 'mid'
          ? ['budget', 'mid']
          : ['budget', 'mid', 'premium'];

      if (!p.price_band || !allowedBands.includes(p.price_band)) {
        filteredOut.budget++;
        continue;
      }
    }

    // Filter D: marketedFor
    if (query.marketedFor) {
      const allowedDemographics =
        query.marketedFor === 'men'
          ? ['men', 'unisex']
          : query.marketedFor === 'women'
          ? ['women', 'unisex']
          : ['unisex'];

      if (!allowedDemographics.includes(p.marketed_for)) {
        filteredOut.marketedFor++;
        continue;
      }
    }

    candidates.push(p);
  }

  const considered = candidates.length;

  // 2. Score Candidates
  // Determine possible weight sum based on requested dimensions
  let possible = 0;
  possible += PERFUME_WEIGHTS.occasion; // required
  if (query.season) possible += PERFUME_WEIGHTS.season;
  if (query.vibe && query.vibe.length > 0) possible += PERFUME_WEIGHTS.vibe;
  if (query.projection) possible += PERFUME_WEIGHTS.projection;
  if (query.minLongevityHours) possible += PERFUME_WEIGHTS.longevity;
  if (query.timeOfDay) possible += PERFUME_WEIGHTS.timeOfDay;
  if (query.budget) possible += PERFUME_WEIGHTS.budgetFit;
  possible += PERFUME_WEIGHTS.consensusRank; // always counts

  const scoredEntries = candidates.map((p) => {
    let earned = 0;
    const reasons = [];
    const matched = {};
    const caveats = [];

    // Dimension: occasion
    const exactOccasion = Array.isArray(p.occasions) && p.occasions.includes(query.occasion);
    const aliases = OCCASION_ALIASES[query.occasion] || [];
    const matchedAliases = Array.isArray(p.occasions)
      ? aliases.filter((a) => p.occasions.includes(a))
      : [];
    const aliasOccasion = !exactOccasion && matchedAliases.length > 0;

    if (exactOccasion) {
      earned += 1.0 * PERFUME_WEIGHTS.occasion;
      matched.occasion = { type: 'exact', tags: [query.occasion] };
      reasons.push(`Direct occasion match for "${query.occasion}"`);
    } else if (aliasOccasion) {
      earned += 0.6 * PERFUME_WEIGHTS.occasion;
      matched.occasion = { type: 'alias', tags: matchedAliases };
      reasons.push(
        `Occasion affinity for "${query.occasion}" via related occasion tags (${matchedAliases.join(', ')})`
      );
    } else {
      matched.occasion = { type: 'none', tags: [] };
    }

    // Dimension: season
    if (query.season) {
      const matchSeason = Array.isArray(p.seasons) && p.seasons.includes(query.season);
      if (matchSeason) {
        earned += 1.0 * PERFUME_WEIGHTS.season;
        matched.season = true;
        reasons.push(`Ideal for ${query.season} climate`);
      } else {
        matched.season = false;
      }
    }

    // Dimension: vibe
    if (query.vibe && query.vibe.length > 0) {
      const matchedVibes = query.vibe.filter(
        (v) => Array.isArray(p.vibe) && p.vibe.includes(v)
      );
      const credit = matchedVibes.length / query.vibe.length;
      earned += credit * PERFUME_WEIGHTS.vibe;
      matched.vibe = matchedVibes;
      if (matchedVibes.length > 0) {
        reasons.push(`Vibe alignment: ${matchedVibes.join(', ')}`);
      }
    }

    // Dimension: projection
    if (query.projection) {
      if (!p.projection) {
        matched.projection = 'unknown';
      } else if (p.projection === query.projection) {
        earned += 1.0 * PERFUME_WEIGHTS.projection;
        matched.projection = 'exact';
        reasons.push(`Exact projection match (${query.projection})`);
      } else {
        const projOrder = ['soft', 'moderate', 'strong'];
        const qIdx = projOrder.indexOf(query.projection);
        const pIdx = projOrder.indexOf(p.projection);
        if (Math.abs(qIdx - pIdx) === 1) {
          earned += 0.5 * PERFUME_WEIGHTS.projection;
          matched.projection = 'adjacent';
          reasons.push(`Compatible projection intensity (${p.projection})`);
        } else {
          matched.projection = 'none';
        }
      }
    }

    // Dimension: longevity
    if (query.minLongevityHours) {
      if (p.longevity_max_hours === null || p.longevity_max_hours === undefined) {
        matched.longevity = 'unknown';
      } else if (p.longevity_max_hours >= query.minLongevityHours) {
        earned += 1.0 * PERFUME_WEIGHTS.longevity;
        matched.longevity = true;
        reasons.push(
          `Meets longevity requirement (${p.longevity_max_hours}h >= ${query.minLongevityHours}h)`
        );
      } else {
        const credit = Math.max(0, Math.min(1, p.longevity_max_hours / query.minLongevityHours));
        earned += credit * PERFUME_WEIGHTS.longevity;
        matched.longevity = false;
      }
    }

    // Dimension: timeOfDay
    if (query.timeOfDay) {
      const matchTime = Array.isArray(p.time_of_day) && p.time_of_day.includes(query.timeOfDay);
      if (matchTime) {
        earned += 1.0 * PERFUME_WEIGHTS.timeOfDay;
        matched.timeOfDay = true;
        reasons.push(`Recommended for ${query.timeOfDay} wear`);
      } else {
        matched.timeOfDay = false;
      }
    }

    // Dimension: budgetFit
    if (query.budget) {
      const priceOrder = ['budget', 'mid', 'premium'];
      const qIdx = priceOrder.indexOf(query.budget);
      const pIdx = p.price_band ? priceOrder.indexOf(p.price_band) : -1;

      if (pIdx === -1) {
        matched.budgetFit = 'unknown';
      } else if (pIdx === qIdx) {
        earned += 1.0 * PERFUME_WEIGHTS.budgetFit;
        matched.budgetFit = 'exact';
        reasons.push(`Budget match (${p.price_band})`);
      } else if (qIdx - pIdx === 1) {
        earned += 0.7 * PERFUME_WEIGHTS.budgetFit;
        matched.budgetFit = 'cheaper_1';
        reasons.push(`Under budget (${p.price_band})`);
      } else if (qIdx - pIdx === 2) {
        earned += 0.4 * PERFUME_WEIGHTS.budgetFit;
        matched.budgetFit = 'cheaper_2';
        reasons.push(`Well under budget (${p.price_band})`);
      }
    }

    // Dimension: consensusRank (always counts)
    let rankCredit = 0;
    if (typeof p.rank === 'number' && p.rank > 0) {
      rankCredit = Math.max(0, Math.min(1, 1 - (p.rank - 1) / maxRankInInput));
      if (rankCredit > 0.6) {
        reasons.push(`Top-ranked consensus favorite (#${p.rank})`);
      }
    }
    earned += rankCredit * PERFUME_WEIGHTS.consensusRank;
    matched.rank = p.rank;

    // Normalised score calculation
    let rawScore = (earned / possible) * 100;

    // Low confidence penalty
    if (p.confidence === 'low') {
      rawScore *= 0.9;
    }

    const finalScore = Math.round(rawScore);

    // Collect Caveats
    if (p.projection === null) caveats.push('projection unknown');
    if (p.longevity === null || p.longevity_max_hours === null) caveats.push('longevity unknown');
    if (Array.isArray(p.inferred_fields)) {
      if (p.inferred_fields.includes('time_of_day')) caveats.push('time_of_day inferred');
      if (p.inferred_fields.includes('vibe')) caveats.push('vibe inferred');
    }
    if (p.confidence === 'low') caveats.push('low research confidence');
    if (p.price_band === null) caveats.push('price band unknown');
    if (p.verified === false) caveats.push('unverified dataset entry');

    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      rank: p.rank,
      verified: p.verified,
      score: finalScore,
      reasons,
      matched,
      caveats,
    };
  });

  // 3. Deterministic Sorting:
  // (a) score desc
  // (b) verified true first
  // (c) better (lower) rank with nulls last
  // (d) id ascending
  scoredEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    if (a.rank !== null && b.rank !== null) {
      if (a.rank !== b.rank) return a.rank - b.rank;
    } else if (a.rank !== null) {
      return -1;
    } else if (b.rank !== null) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });

  const bestScore = scoredEntries.length > 0 ? scoredEntries[0].score : null;
  const passingEntries = scoredEntries.filter((p) => p.score >= threshold);

  if (passingEntries.length === 0) {
    return {
      results: [],
      reason: 'no close match',
      best_score: bestScore,
      filtered_out: filteredOut,
      considered,
    };
  }

  return {
    results: passingEntries.slice(0, k),
    reason: null,
    best_score: bestScore,
    filtered_out: filteredOut,
    considered,
  };
}
