/**
 * Agent Rules, Thresholds, and Heuristics for StyleScent.
 *
 * What: Defines central rule tables, default inferences, tone predicates, look templates,
 * session limits, and relaxation sequences.
 * Why: Keeps all styling and constraint heuristics transparent, documented, and easily
 * tuneable by the team without burying magic numbers in orchestrator logic.
 */

/**
 * Expected formality level for each occasion: 0 = casual, 1 = smart, 2 = formal.
 */
export const OCCASION_FORMALITY = {
  college_fest: 0,
  casual: 0,
  party: 1,
  date_night: 1,
  office: 1,
  festival_traditional: 1,
  interview: 2,
  wedding: 2,
};

/**
 * Default time of day associated with each occasion when not specified by user.
 */
export const OCCASION_DEFAULT_TIME = {
  college_fest: 'evening',
  party: 'night',
  date_night: 'evening',
  office: 'day',
  interview: 'day',
  wedding: 'evening',
  casual: 'day',
  festival_traditional: 'evening',
};

/**
 * Derives default season from a given Date instance.
 * Dec-Feb: winter, Mar-Apr: spring, May-Aug: summer, Sep-Nov: autumn.
 *
 * @param {Date} [date=new Date()]
 * @returns {'spring'|'summer'|'autumn'|'winter'}
 */
export function defaultSeason(date = new Date()) {
  const d = typeof date === 'number' ? new Date(date) : date instanceof Date ? date : new Date(date);
  const month = d.getMonth(); // 0-11
  if (month === 11 || month === 0 || month === 1) {
    return 'winter';
  }
  if (month === 2 || month === 3) {
    return 'spring';
  }
  if (month >= 4 && month <= 7) {
    return 'summer';
  }
  return 'autumn';
}

/**
 * Maximum price limits in INR for budget bands (per 100ml in Indian market).
 */
export const BUDGET_BANDS_INR = {
  budgetMax: 3000,
  midMax: 8000,
};

/**
 * Standard garment slot combinations for outfit planning.
 */
export const LOOK_TEMPLATES = {
  default: ['top', 'bottom', 'footwear'],
  festival_traditional: ['ethnic', 'footwear'],
};

/**
 * Tone predicates applied to an analysed colour object { hsl, temperature, isNeutral }.
 */
export const TONE_PREDICATES = {
  dark: (c) => ((c && c.hsl) ? c.hsl.l : (c && c.l !== undefined) ? c.l : 1) < 0.35,
  light: (c) => ((c && c.hsl) ? c.hsl.l : (c && c.l !== undefined) ? c.l : 0) > 0.65,
  pastel: (c) => {
    const hsl = (c && c.hsl) ? c.hsl : c;
    return Boolean(hsl && hsl.l > 0.75 && hsl.s < 0.6);
  },
  bright: (c) => ((c && c.hsl) ? c.hsl.s : (c && c.s !== undefined) ? c.s : 0) > 0.7,
  earthy: (c) => {
    const hsl = (c && c.hsl) ? c.hsl : c;
    const temp = c && c.temperature ? c.temperature : 'neutral';
    return Boolean(hsl && temp === 'warm' && hsl.s < 0.6);
  },
  neutral: (c) => Boolean(c && c.isNeutral),
};

/**
 * Quality thresholds and runtime session boundaries.
 */
export const OUTFIT_SCORE_THRESHOLD = 70;
export const MAX_ALTERNATIVES = 2;
export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_MAX = 500;
export const MAX_LLM_CALLS_PER_REQUEST = 2;

/**
 * Sequential relaxation order when no fragrances match initial query.
 * Note: Never relaxes avoidNotes, requireNotes, marketedFor, or occasion.
 */
export const RELAXATION_ORDER = [
  'drop_min_longevity',
  'drop_projection',
  'drop_time_of_day',
  'drop_season',
  'raise_budget_mid',
  'raise_budget_premium',
];
