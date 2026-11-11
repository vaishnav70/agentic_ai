/**
 * Shared Domain Enums for StyleScent.
 *
 * What: Defines standardized category constants for fragrance attributes, styling rules,
 * patterns, occasions, seasons, and confidence levels.
 * Why: Provides a single source of truth across schemas, loaders, matcher algorithms,
 * and tests, avoiding magic strings and typos.
 */

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export const OCCASIONS = [
  'college_fest',
  'office',
  'date_night',
  'wedding',
  'casual',
  'interview',
  'party',
  'festival_traditional',
];

export const TIMES = ['day', 'evening', 'night'];

export const FAMILIES = [
  'woody',
  'floral',
  'citrus',
  'fresh',
  'oriental',
  'gourmand',
  'aromatic',
  'fruity',
];

export const VIBES = [
  'confident',
  'fresh',
  'elegant',
  'playful',
  'bold',
  'calm',
  'romantic',
];

export const PROJECTION = ['soft', 'moderate', 'strong'];

export const LONGEVITY = ['short', 'medium', 'long'];

export const PRICE_BANDS = ['budget', 'mid', 'premium'];

export const MARKETED_FOR = ['men', 'unisex', 'women'];

export const PATTERNS = [
  'solid',
  'stripes',
  'checks',
  'floral',
  'polka',
  'paisley',
  'geometric',
  'abstract',
];

export const VERDICTS = ['good', 'ok', 'avoid'];

export const LEVELS = ['high', 'medium', 'low'];
