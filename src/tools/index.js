/**
 * Central Tools Export & Factory for StyleScent.
 *
 * What: Exports pure tool functions individually and provides a `createTools(data)` factory
 * that returns pre-bound tool suites for the orchestrator and specialist agents.
 * Why: Decouples dataset storage from tool execution, enabling easy mocking and isolated testing
 * while offering ergonomic pre-bound interfaces at runtime.
 */

import {
  analyseColour,
  suggestHarmonies,
  paletteForSeason,
  paletteForOccasion,
  scoreOutfit,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hslToHex,
  hueDistance,
  rgbToLab,
  deltaE76,
  COLOUR_SCORING,
} from './colour.js';

import {
  checkPatternPairing,
  suggestCompanions,
  scaleAdvice,
} from './pattern.js';

import {
  matchPerfumes,
  PERFUME_WEIGHTS,
} from './perfume.js';

import {
  buildShoppingListCsv,
  buildOutfitPlanMd,
  buildOutputs,
  csvField,
} from './outputs.js';

/**
 * Creates a pre-bound tool suite using loaded domain datasets.
 *
 * @param {{ colourRules: object, patterns: object, perfumes: object[] }} data
 * @returns {{
 *   colour: {
 *     analyse: (hex: string) => ReturnType<typeof analyseColour>,
 *     suggestHarmonies: (hex: string, scheme: string) => ReturnType<typeof suggestHarmonies>,
 *     paletteForSeason: (season: string) => ReturnType<typeof paletteForSeason>,
 *     paletteForOccasion: (occasion: string) => ReturnType<typeof paletteForOccasion>,
 *     scoreOutfit: (garments: object[]) => ReturnType<typeof scoreOutfit>,
 *   },
 *   pattern: {
 *     checkPairing: (a: string, b: string) => ReturnType<typeof checkPatternPairing>,
 *     suggestCompanions: (pattern: string) => ReturnType<typeof suggestCompanions>,
 *     scaleAdvice: () => string,
 *   },
 *   perfume: {
 *     match: (query: object, options?: object) => ReturnType<typeof matchPerfumes>,
 *   }
 * }}
 */
export function createTools(data) {
  if (!data) {
    throw new Error('createTools requires data object with { colourRules, patterns, perfumes }');
  }

  return {
    colour: {
      analyse: (hex) => analyseColour(hex, data.colourRules),
      suggestHarmonies: (hex, scheme) => suggestHarmonies(hex, scheme, data.colourRules),
      paletteForSeason: (season) => paletteForSeason(season, data.colourRules),
      paletteForOccasion: (occasion) => paletteForOccasion(occasion, data.colourRules),
      scoreOutfit: (garments) => scoreOutfit(garments, data.colourRules),
    },
    pattern: {
      checkPairing: (a, b) => checkPatternPairing(a, b, data.patterns),
      suggestCompanions: (pattern) => suggestCompanions(pattern, data.patterns),
      scaleAdvice: () => scaleAdvice(data.patterns),
    },
    perfume: {
      match: (query, options) => matchPerfumes(query, data.perfumes, options),
    },
  };
}

export {
  // Pure colour tool functions & helpers
  analyseColour,
  suggestHarmonies,
  paletteForSeason,
  paletteForOccasion,
  scoreOutfit,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hslToHex,
  hueDistance,
  rgbToLab,
  deltaE76,
  COLOUR_SCORING,

  // Pure pattern tool functions
  checkPatternPairing,
  suggestCompanions,
  scaleAdvice,

  // Pure perfume tool functions
  matchPerfumes,
  PERFUME_WEIGHTS,

  // Multi-format output generators (M4)
  buildShoppingListCsv,
  buildOutfitPlanMd,
  buildOutputs,
  csvField,
};
