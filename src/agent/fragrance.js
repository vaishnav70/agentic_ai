/**
 * Fragrance Specialist for StyleScent AI.
 *
 * What: Deterministically maps styling context and slots to fragrance queries, executes
 * matching using M2 perfume tools, applies cumulative relaxation when no matches are found,
 * and condenses data caveats across candidate perfumes.
 * Why: Strictly grounds perfume recommendations in data without hallucinated notes or IDs,
 * with transparent, deterministic relaxation that never loosens core safety constraints
 * (avoidNotes, requireNotes, marketedFor, or occasion).
 */

import { outfitToneKeys } from './wardrobe.js';
import { RELAXATION_ORDER } from './rules.js';

/**
 * Executes the perfume matcher using either pre-bound tools or pure tools.
 * @param {Object} tools
 * @param {Object} data
 * @param {Object} query
 * @returns {any}
 */
function callMatch(tools, data, query) {
  if (tools?.perfume?.match) {
    return tools.perfume.match(query);
  }
  if (tools?.perfume?.matchPerfumes) {
    return tools.perfume.matchPerfumes(query, data.perfumes);
  }
  if (tools?.matchPerfumes) {
    return tools.matchPerfumes(query, data.perfumes);
  }
  throw new Error('Perfume matcher tool is missing or improperly bound');
}

/**
 * Builds a fragrance query object from slots, look, and tone map data.
 *
 * @param {import('./slots.js').Slots} slots
 * @param {Object} look
 * @param {Object} data
 * @returns {Object}
 */
export function buildQuery(slots, look, data) {
  const userVibes = Array.isArray(slots.vibe) ? slots.vibe : [];
  const toneKeys = outfitToneKeys(look, data);

  const toneVibes = [];
  for (const tk of toneKeys) {
    const entry = data.toneMap.find((t) => t.key === tk);
    if (entry && Array.isArray(entry.vibes)) {
      for (const v of entry.vibes) {
        if (!toneVibes.includes(v)) {
          toneVibes.push(v);
        }
      }
    }
  }

  // User vibes first, then tone vibes, deduped, capped at 4
  const combinedVibes = [];
  for (const v of userVibes) {
    if (v && !combinedVibes.includes(v)) {
      combinedVibes.push(v);
    }
  }
  for (const v of toneVibes) {
    if (v && !combinedVibes.includes(v)) {
      combinedVibes.push(v);
    }
  }
  const finalVibes = combinedVibes.slice(0, 4);

  return {
    occasion: slots.occasion,
    season: slots.season,
    timeOfDay: slots.timeOfDay,
    vibe: finalVibes,
    projection: slots.projection,
    minLongevityHours: slots.minLongevityHours,
    budget: slots.budget,
    marketedFor: slots.marketedFor,
    avoidNotes: Array.isArray(slots.avoidNotes) ? slots.avoidNotes : [],
    requireNotes: Array.isArray(slots.requireNotes) ? slots.requireNotes : [],
  };
}

/**
 * Searches for fragrances matching the query, applying cumulative relaxation if no matches exist.
 *
 * @param {Object} query
 * @param {Object} data
 * @param {Object} tools
 * @returns {{
 *   results: Array<any>,
 *   relaxed: string[],
 *   exact: boolean,
 *   reason: string|null,
 *   considered: number,
 *   filtered_out: Object
 * }}
 */
export function findFragrances(query, data, tools) {
  let currentQuery = { ...query };
  let initialRes = callMatch(tools, data, currentQuery);

  if (initialRes.results && initialRes.results.length > 0) {
    return {
      results: initialRes.results,
      relaxed: [],
      exact: true,
      reason: initialRes.reason || null,
      considered: initialRes.considered,
      filtered_out: initialRes.filtered_out,
    };
  }

  // Cumulative relaxation
  const relaxed = [];
  let lastRes = initialRes;

  for (const step of RELAXATION_ORDER) {
    let changed = false;

    if (step === 'drop_minLongevityHours' && currentQuery.minLongevityHours !== undefined && currentQuery.minLongevityHours !== null) {
      delete currentQuery.minLongevityHours;
      relaxed.push('minimum longevity requirement');
      changed = true;
    } else if (step === 'drop_projection' && currentQuery.projection) {
      delete currentQuery.projection;
      relaxed.push('projection preference');
      changed = true;
    } else if (step === 'drop_timeOfDay' && currentQuery.timeOfDay) {
      delete currentQuery.timeOfDay;
      relaxed.push('time of day constraint');
      changed = true;
    } else if (step === 'drop_season' && currentQuery.season) {
      delete currentQuery.season;
      relaxed.push('season constraint');
      changed = true;
    } else if (step === 'raise_budget_mid' && currentQuery.budget === 'budget') {
      currentQuery.budget = 'mid';
      relaxed.push('budget (expanded to mid-tier)');
      changed = true;
    } else if (step === 'raise_budget_premium' && (currentQuery.budget === 'budget' || currentQuery.budget === 'mid')) {
      currentQuery.budget = 'premium';
      relaxed.push('budget (expanded to premium tier)');
      changed = true;
    }

    if (changed) {
      const relaxedRes = callMatch(tools, data, currentQuery);
      lastRes = relaxedRes;
      if (relaxedRes.results && relaxedRes.results.length > 0) {
        return {
          results: relaxedRes.results,
          relaxed,
          exact: false,
          reason: relaxedRes.reason || null,
          considered: relaxedRes.considered,
          filtered_out: relaxedRes.filtered_out,
        };
      }
    }
  }

  // If still empty after all relaxations
  return {
    results: [],
    relaxed,
    exact: false,
    reason: lastRes.reason || 'no close match',
    considered: lastRes.considered,
    filtered_out: lastRes.filtered_out,
  };
}

/**
 * Dedupes caveats across results into at most 3 short lines, folding time_of_day and vibe inferences.
 *
 * @param {Array<any>} results
 * @returns {string[]}
 */
export function condenseCaveats(results) {
  if (!Array.isArray(results) || results.length === 0) return [];

  const rawCaveats = new Set();
  for (const r of results) {
    if (Array.isArray(r.caveats)) {
      for (const c of r.caveats) {
        rawCaveats.add(c);
      }
    }
  }

  let hasTimeOfDay = false;
  let hasVibe = false;
  const filtered = [];

  for (const c of rawCaveats) {
    const lower = c.toLowerCase();
    if (lower.includes('time_of_day') && lower.includes('inferred')) {
      hasTimeOfDay = true;
    } else if (lower.includes('vibe') && lower.includes('inferred')) {
      hasVibe = true;
    } else {
      filtered.push(c);
    }
  }

  if (hasTimeOfDay && hasVibe) {
    filtered.unshift('time_of_day and vibe inferred from heuristics');
  } else if (hasTimeOfDay) {
    filtered.unshift('time_of_day inferred from occasion heuristics');
  } else if (hasVibe) {
    filtered.unshift('vibe inferred from outfit tone heuristics');
  }

  return filtered.slice(0, 3);
}
