/**
 * Occasion Aliases for Fragrance Matching.
 *
 * What: Maps specific, nuanced occasion tags to broader, related occasion categories.
 * Why: Research datasets and fragrance marketing rarely tag niche occasions like
 * "college_fest" or "festival_traditional" explicitly. Allowing partial credit (0.6x)
 * from related occasion aliases prevents false-negative recommendations while still
 * penalizing non-exact matches deterministically.
 */

export const OCCASION_ALIASES = {
  college_fest: ['party', 'casual', 'date_night'],
  festival_traditional: ['wedding', 'party'],
  interview: ['office'],
};
