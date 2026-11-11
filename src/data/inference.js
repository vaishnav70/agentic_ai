/**
 * Fragrance Attribute Inference Rules.
 *
 * What: Deterministic rule tables and inference functions for deriving `time_of_day`
 * and `vibe` from fragrance family, occasion, and projection.
 * Why: The raw research dataset does not contain time_of_day and vibe fields.
 * Having simple, transparent, exported rule tables allows the team to review,
 * customize, and defend these heuristics without hardcoding black-box logic.
 */

import { TIMES, VIBES } from './enums.js';

/**
 * Mapping from fragrance family to natural times of day.
 */
export const FAMILY_TIME_MAP = {
  citrus: ['day'],
  fresh: ['day'],
  aromatic: ['day'],
  fruity: ['day', 'evening'],
  woody: ['day', 'evening'],
  floral: ['day', 'evening'],
  oriental: ['evening', 'night'],
  gourmand: ['evening', 'night'],
};

/**
 * Mapping from occasion to associated times of day.
 */
export const OCCASION_TIME_MAP = {
  office: ['day'],
  interview: ['day'],
  casual: ['day'],
  wedding: ['day', 'evening'],
  festival_traditional: ['day', 'evening'],
  college_fest: ['evening', 'night'],
  party: ['evening', 'night'],
  date_night: ['evening', 'night'],
};

/**
 * Mapping from fragrance family to personality vibe tags.
 */
export const FAMILY_VIBE_MAP = {
  citrus: ['fresh'],
  fresh: ['fresh'],
  aromatic: ['confident', 'calm'],
  woody: ['confident', 'calm'],
  floral: ['elegant', 'romantic'],
  oriental: ['bold', 'romantic'],
  gourmand: ['bold', 'romantic'],
  fruity: ['playful'],
};

/**
 * Additional vibes contributed by projection strength.
 */
export const PROJECTION_VIBE_MAP = {
  strong: ['bold', 'confident'],
  moderate: [],
  soft: ['calm'],
};

/**
 * Infers times of day for a fragrance based on its family and occasions.
 *
 * @param {string} family
 * @param {string[]} [occasions=[]]
 * @returns {string[]} Ordered list of matching TIMES
 */
export function inferTimeOfDay(family, occasions = []) {
  const timeSet = new Set();

  const familyTimes = FAMILY_TIME_MAP[family];
  if (Array.isArray(familyTimes)) {
    familyTimes.forEach((t) => timeSet.add(t));
  }

  if (Array.isArray(occasions)) {
    occasions.forEach((occ) => {
      const occTimes = OCCASION_TIME_MAP[occ];
      if (Array.isArray(occTimes)) {
        occTimes.forEach((t) => timeSet.add(t));
      }
    });
  }

  // Preserve canonical order: day, evening, night
  const result = TIMES.filter((t) => timeSet.has(t));
  return result.length > 0 ? result : ['day', 'evening'];
}

/**
 * Infers vibe tags for a fragrance based on its family, projection, and occasions.
 *
 * @param {string} family
 * @param {string|null} [projection=null]
 * @param {string[]} [occasions=[]]
 * @returns {string[]} Canonical list of VIBES
 */
export function inferVibes(family, projection = null, occasions = []) {
  const vibeSet = new Set();

  const familyVibes = FAMILY_VIBE_MAP[family];
  if (Array.isArray(familyVibes)) {
    familyVibes.forEach((v) => vibeSet.add(v));
  }

  if (projection && PROJECTION_VIBE_MAP[projection]) {
    PROJECTION_VIBE_MAP[projection].forEach((v) => vibeSet.add(v));
  }

  // Optional subtle hints from occasions
  if (Array.isArray(occasions)) {
    if (occasions.includes('party') || occasions.includes('college_fest')) {
      vibeSet.add('playful');
    }
    if (occasions.includes('wedding')) {
      vibeSet.add('elegant');
    }
  }

  const result = VIBES.filter((v) => vibeSet.has(v));
  return result.length > 0 ? result : ['confident', 'fresh'];
}
