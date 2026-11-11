/**
 * Deterministic Colour Theory & Harmony Tool for StyleScent.
 *
 * What: Provides pure mathematical colour space conversions (RGB, HSL, CIE Lab D65),
 * perceptual distance (deltaE76), colour classification, harmony generation, and outfit scoring.
 * Why: Keeps all styling logic explainable, deterministic, and testable without black-box LLM hallucinations.
 */

import { HEX_COLOR_REGEX } from '../data/schemas.js';

/**
 * Tunable constants and thresholds for colour analysis and outfit scoring.
 */
export const COLOUR_SCORING = {
  BASE_SCORE: 60,
  NEUTRAL_BASE_BONUS: 10,
  ALL_NEUTRAL_BONUS: 10,
  HUE_FAMILY_THRESHOLD_DEG: 25,
  HUE_COUNT_BONUSES: {
    1: 10,
    2: 5,
    3: 0,
    4: -20, // 4 or more
  },
  PAIR_BONUS: {
    ANALOGOUS_MAX_DEG: 40,
    ANALOGOUS_BONUS: 5,
    COMPLEMENTARY_TARGET_DEG: 180,
    COMPLEMENTARY_TOLERANCE_DEG: 20,
    COMPLEMENTARY_BONUS: 8,
    TRIADIC_TARGET_DEG: 120,
    TRIADIC_TOLERANCE_DEG: 15,
    TRIADIC_BONUS: 5,
    MAX_TOTAL_PAIR_BONUS: 12,
  },
  CLASH: {
    MIN_SATURATION: 0.5,
    MIN_DEG: 50,
    MAX_DEG: 100,
    PENALTY: -12,
    MAX_TOTAL_CLASH_PENALTY: -24,
  },
  FORMALITY_SPREAD: {
    0: 5,
    1: 0,
    2: -15,
  },
  NEUTRAL_BOUNDS: {
    MIN_SATURATION: 0.15,
    MIN_LIGHTNESS: 0.10,
    MAX_LIGHTNESS: 0.94,
  },
};

/**
 * Validates and converts 6-character hex string to RGB object { r, g, b } (0-255).
 *
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string' || !HEX_COLOR_REGEX.test(hex)) {
    throw new Error(`Invalid hex colour format: "${hex}". Expected format /^#[0-9A-Fa-f]{6}$/`);
  }
  const num = parseInt(hex.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts RGB components (0-255) to 6-digit lowercase hex string.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

/**
 * Converts RGB components (0-255) to HSL { h: 0-360, s: 0-1, l: 0-1 }.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, l: number }}
 */
export function rgbToHsl(r, g, b) {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;

  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN:
        h = (gN - bN) / d + (gN < bN ? 6 : 0);
        break;
      case gN:
        h = (bN - rN) / d + 2;
        break;
      case bN:
        h = (rN - gN) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 1000,
    l: Math.round(l * 1000) / 1000,
  };
}

/**
 * Converts HSL components (h: 0-360, s: 0-1, l: 0-1) to RGB { r, g, b } (0-255).
 *
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {{ r: number, g: number, b: number }}
 */
export function hslToRgb(h, s, l) {
  const hN = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hN / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hN < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hN < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hN < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hN < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hN < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

/**
 * Converts HSL to 6-digit hex.
 *
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {string}
 */
export function hslToHex(h, s, l) {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Computes circular shortest distance between two hues on the 360 degree wheel (0 to 180).
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function hueDistance(a, b) {
  const diff = Math.abs(((a % 360) + 360) % 360 - (((b % 360) + 360) % 360));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Converts RGB components (0-255) to CIE Lab coordinates under standard D65 illuminant.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ l: number, a: number, b: number }}
 */
export function rgbToLab(r, g, b) {
  const toLinear = (c) => {
    const v = c / 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };

  const rL = toLinear(r);
  const gL = toLinear(g);
  const bL = toLinear(b);

  // sRGB to XYZ (D65 reference white)
  const x = (rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375) / 0.95047;
  const y = (rL * 0.2126729 + gL * 0.7151522 + bL * 0.072175) / 1.0;
  const z = (rL * 0.0193339 + gL * 0.119192 + bL * 0.9503041) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const l = 116 * f(y) - 16;
  const a = 500 * (f(x) - f(y));
  const labB = 200 * (f(y) - f(z));

  return { l, a, b: labB };
}

/**
 * Computes CIE deltaE76 perceptual colour difference between two Lab coordinates.
 *
 * @param {{ l: number, a: number, b: number }} labA
 * @param {{ l: number, a: number, b: number }} labB
 * @returns {number}
 */
export function deltaE76(labA, labB) {
  return Math.hypot(labA.l - labB.l, labA.a - labB.a, labA.b - labB.b);
}

/**
 * Analyses a hex colour, maps it to the nearest named colour in colourRules, and checks neutral status.
 *
 * @param {string} hex
 * @param {object} colourRules
 * @returns {{ hex: string, hsl: { h: number, s: number, l: number }, name: string, temperature: 'warm'|'cool'|'neutral', isNeutral: boolean }}
 */
export function analyseColour(hex, colourRules) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const targetLab = rgbToLab(rgb.r, rgb.g, rgb.b);

  // Find nearest named colour in CIE Lab space
  let nearest = null;
  let minDistance = Infinity;

  for (const nc of colourRules.named_colours) {
    const ncRgb = hexToRgb(nc.hex);
    const ncLab = rgbToLab(ncRgb.r, ncRgb.g, ncRgb.b);
    const dist = deltaE76(targetLab, ncLab);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = nc;
    }
  }

  const nearestName = nearest ? nearest.name : 'unknown';
  const temperature = nearest ? nearest.temperature : 'neutral';

  // Neutral if low saturation, near-black, near-white, or nearest colour name is neutral
  const isNeutralName =
    colourRules.neutrals.includes(nearestName) ||
    colourRules.neutrals.some((n) =>
      nearestName.toLowerCase().split(/\s+/).includes(n.toLowerCase())
    );

  const isNeutral =
    hsl.s < COLOUR_SCORING.NEUTRAL_BOUNDS.MIN_SATURATION ||
    hsl.l < COLOUR_SCORING.NEUTRAL_BOUNDS.MIN_LIGHTNESS ||
    hsl.l > COLOUR_SCORING.NEUTRAL_BOUNDS.MAX_LIGHTNESS ||
    isNeutralName;

  return {
    hex: hex.toLowerCase(),
    hsl,
    name: nearestName,
    temperature,
    isNeutral,
  };
}

/**
 * Suggests harmony companions for a colour under the specified scheme.
 *
 * @param {string} hex
 * @param {'complementary'|'analogous'|'triadic'|'neutral-pair'} scheme
 * @param {object} colourRules
 * @returns {{ scheme: string, colours: Array<{ hex: string, name: string }>, note: string|null }}
 */
export function suggestHarmonies(hex, scheme, colourRules) {
  const validSchemes = ['complementary', 'analogous', 'triadic', 'neutral-pair'];
  if (!validSchemes.includes(scheme)) {
    throw new Error(`Unknown colour harmony scheme: "${scheme}". Supported: ${validSchemes.join(', ')}`);
  }

  const base = analyseColour(hex, colourRules);

  // If base is neutral and scheme is not neutral-pair, return special guidance note
  if (base.isNeutral && scheme !== 'neutral-pair') {
    return {
      scheme,
      colours: [],
      note: 'Neutral base: pairs with almost anything; use the neutral-pair or an occasion palette.',
    };
  }

  if (scheme === 'neutral-pair') {
    // Return up to 3 neutral named colours with greatest lightness contrast
    const neutralCandidates = colourRules.named_colours.filter(
      (c) =>
        colourRules.neutrals.includes(c.name) ||
        colourRules.neutrals.some((n) => c.name.toLowerCase().split(/\s+/).includes(n.toLowerCase()))
    );

    const scoredNeutrals = neutralCandidates.map((c) => {
      const rgb = hexToRgb(c.hex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const contrast = Math.abs(hsl.l - base.hsl.l);
      return { hex: c.hex.toLowerCase(), name: c.name, contrast };
    });

    scoredNeutrals.sort((a, b) => b.contrast - a.contrast);

    // Deduplicate by hex and take top 3
    const seenHex = new Set();
    const colours = [];
    for (const item of scoredNeutrals) {
      if (!seenHex.has(item.hex)) {
        seenHex.add(item.hex);
        colours.push({ hex: item.hex, name: item.name });
        if (colours.length === 3) break;
      }
    }

    return {
      scheme,
      colours,
      note: null,
    };
  }

  // Chromatic harmonies (complementary, analogous, triadic)
  const angles = colourRules.harmony_angles[scheme];
  if (!Array.isArray(angles)) {
    throw new Error(`Missing harmony angles definition for scheme "${scheme}" in colour_rules.`);
  }

  const [sMin, sMax] = colourRules.wearable_bounds?.s || [0.2, 0.9];
  const [lMin, lMax] = colourRules.wearable_bounds?.l || [0.2, 0.85];

  const clampedS = Math.min(Math.max(base.hsl.s, sMin), sMax);
  const clampedL = Math.min(Math.max(base.hsl.l, lMin), lMax);

  const seenHex = new Set();
  const colours = [];

  for (const angle of angles) {
    const newHue = ((base.hsl.h + angle) % 360 + 360) % 360;
    const companionHex = hslToHex(newHue, clampedS, clampedL);
    if (!seenHex.has(companionHex)) {
      seenHex.add(companionHex);
      const analysed = analyseColour(companionHex, colourRules);
      colours.push({ hex: companionHex, name: analysed.name });
      if (colours.length === 3) break;
    }
  }

  return {
    scheme,
    colours,
    note: null,
  };
}

/**
 * Returns the hex and names for a season palette.
 *
 * @param {string} season
 * @param {object} colourRules
 * @returns {Array<{ hex: string, name: string }>}
 */
export function paletteForSeason(season, colourRules) {
  const palette = colourRules.season_palettes[season];
  if (!Array.isArray(palette)) {
    throw new Error(`Unknown season: "${season}". Valid seasons: ${Object.keys(colourRules.season_palettes).join(', ')}`);
  }
  return palette.map((hex) => ({
    hex: hex.toLowerCase(),
    name: analyseColour(hex, colourRules).name,
  }));
}

/**
 * Returns the hex and names for an occasion palette.
 *
 * @param {string} occasion
 * @param {object} colourRules
 * @returns {Array<{ hex: string, name: string }>}
 */
export function paletteForOccasion(occasion, colourRules) {
  const palette = colourRules.occasion_palettes[occasion];
  if (!Array.isArray(palette)) {
    throw new Error(`Unknown occasion: "${occasion}". Valid occasions: ${Object.keys(colourRules.occasion_palettes).join(', ')}`);
  }
  return palette.map((hex) => ({
    hex: hex.toLowerCase(),
    name: analyseColour(hex, colourRules).name,
  }));
}

/**
 * Scores an outfit's colour harmony and formality alignment (0-100).
 *
 * @param {Array<{ colour_hex: string, formality?: 'casual'|'smart'|'formal', pattern?: string }>} garments
 * @param {object} colourRules
 * @returns {{ score: number, reasons: string[], breakdown: Array<{ rule: string, delta: number }> }}
 */
export function scoreOutfit(garments, colourRules) {
  if (!Array.isArray(garments) || garments.length === 0) {
    return {
      score: COLOUR_SCORING.BASE_SCORE,
      reasons: ['No garments provided; default baseline score.'],
      breakdown: [{ rule: 'base', delta: COLOUR_SCORING.BASE_SCORE }],
    };
  }

  // Validate and analyse each garment
  const analysedGarments = garments.map((g, idx) => {
    if (!g.colour_hex) {
      throw new Error(`Garment at index ${idx} is missing required "colour_hex".`);
    }
    const analysed = analyseColour(g.colour_hex, colourRules);
    return {
      ...g,
      analysed,
    };
  });

  const reasons = [];
  const breakdown = [];

  // Rule 1: neutral_base
  const hasNeutral = analysedGarments.some((g) => g.analysed.isNeutral);
  if (hasNeutral) {
    breakdown.push({ rule: 'neutral_base', delta: COLOUR_SCORING.NEUTRAL_BASE_BONUS });
    reasons.push('Outfit includes at least one neutral grounding garment (+10).');
  }

  // Rule 2: all_neutral
  const chromaticGarments = analysedGarments.filter((g) => !g.analysed.isNeutral);
  const isAllNeutral = chromaticGarments.length === 0;
  if (isAllNeutral) {
    breakdown.push({ rule: 'all_neutral', delta: COLOUR_SCORING.ALL_NEUTRAL_BONUS });
    reasons.push('All garments are neutral, creating a clean cohesive palette (+10).');
  }

  // Rule 3: hue_count (applies when there are chromatic garments)
  if (chromaticGarments.length > 0) {
    const families = [];
    for (const g of chromaticGarments) {
      const hue = g.analysed.hsl.h;
      let matchedFamily = false;
      for (const fam of families) {
        if (hueDistance(hue, fam[0]) <= COLOUR_SCORING.HUE_FAMILY_THRESHOLD_DEG) {
          fam.push(hue);
          matchedFamily = true;
          break;
        }
      }
      if (!matchedFamily) {
        families.push([hue]);
      }
    }

    const familyCount = families.length;
    let hueDelta = 0;
    let hueReason = '';

    if (familyCount === 1) {
      hueDelta = COLOUR_SCORING.HUE_COUNT_BONUSES[1];
      hueReason = 'Single chromatic hue family provides tight, intentional cohesion (+10).';
    } else if (familyCount === 2) {
      hueDelta = COLOUR_SCORING.HUE_COUNT_BONUSES[2];
      hueReason = 'Two chromatic hue families offer balanced contrast (+5).';
    } else if (familyCount === 3) {
      hueDelta = COLOUR_SCORING.HUE_COUNT_BONUSES[3];
      hueReason = 'Three chromatic hues present; dynamic but acceptable (+0).';
    } else {
      hueDelta = COLOUR_SCORING.HUE_COUNT_BONUSES[4];
      hueReason = `${familyCount} chromatic hue families create visual clutter and discord (-20).`;
    }

    breakdown.push({ rule: 'hue_count', delta: hueDelta });
    reasons.push(hueReason);

    // Rule 4: Pair rules (evaluated across each unique chromatic pair)
    let totalPairBonus = 0;
    let totalClashPenalty = 0;

    for (let i = 0; i < chromaticGarments.length; i++) {
      for (let j = i + 1; j < chromaticGarments.length; j++) {
        const c1 = chromaticGarments[i].analysed;
        const c2 = chromaticGarments[j].analysed;
        const d = hueDistance(c1.hsl.h, c2.hsl.h);

        // Analogous (d <= 40)
        if (d <= COLOUR_SCORING.PAIR_BONUS.ANALOGOUS_MAX_DEG) {
          const capacity = COLOUR_SCORING.PAIR_BONUS.MAX_TOTAL_PAIR_BONUS - totalPairBonus;
          if (capacity > 0) {
            const delta = Math.min(COLOUR_SCORING.PAIR_BONUS.ANALOGOUS_BONUS, capacity);
            totalPairBonus += delta;
            breakdown.push({ rule: 'pair_analogous', delta });
            reasons.push(`Analogous chromatic pairing between ${c1.name} and ${c2.name} (+${delta}).`);
          }
        }
        // Complementary (|d - 180| <= 20)
        else if (Math.abs(d - COLOUR_SCORING.PAIR_BONUS.COMPLEMENTARY_TARGET_DEG) <= COLOUR_SCORING.PAIR_BONUS.COMPLEMENTARY_TOLERANCE_DEG) {
          const capacity = COLOUR_SCORING.PAIR_BONUS.MAX_TOTAL_PAIR_BONUS - totalPairBonus;
          if (capacity > 0) {
            const delta = Math.min(COLOUR_SCORING.PAIR_BONUS.COMPLEMENTARY_BONUS, capacity);
            totalPairBonus += delta;
            breakdown.push({ rule: 'pair_complementary', delta });
            reasons.push(`Complementary contrast between ${c1.name} and ${c2.name} (+${delta}).`);
          }
        }
        // Triadic (|d - 120| <= 15)
        else if (Math.abs(d - COLOUR_SCORING.PAIR_BONUS.TRIADIC_TARGET_DEG) <= COLOUR_SCORING.PAIR_BONUS.TRIADIC_TOLERANCE_DEG) {
          const capacity = COLOUR_SCORING.PAIR_BONUS.MAX_TOTAL_PAIR_BONUS - totalPairBonus;
          if (capacity > 0) {
            const delta = Math.min(COLOUR_SCORING.PAIR_BONUS.TRIADIC_BONUS, capacity);
            totalPairBonus += delta;
            breakdown.push({ rule: 'pair_triadic', delta });
            reasons.push(`Triadic harmony between ${c1.name} and ${c2.name} (+${delta}).`);
          }
        }
        // Clash (both s > 0.5 and 50 <= d <= 100)
        else if (
          c1.hsl.s > COLOUR_SCORING.CLASH.MIN_SATURATION &&
          c2.hsl.s > COLOUR_SCORING.CLASH.MIN_SATURATION &&
          d >= COLOUR_SCORING.CLASH.MIN_DEG &&
          d <= COLOUR_SCORING.CLASH.MAX_DEG
        ) {
          const penaltyCapacity = Math.abs(COLOUR_SCORING.CLASH.MAX_TOTAL_CLASH_PENALTY) - Math.abs(totalClashPenalty);
          if (penaltyCapacity > 0) {
            const delta = -Math.min(Math.abs(COLOUR_SCORING.CLASH.PENALTY), penaltyCapacity);
            totalClashPenalty += delta;
            breakdown.push({ rule: 'pair_clash', delta });
            reasons.push(`Saturated clashing hue pair between ${c1.name} and ${c2.name} (${delta}).`);
          }
        }
      }
    }
  }

  // Rule 5: formality spread (casual=0, smart=1, formal=2)
  const formalityRank = {
    casual: 0,
    smart: 1,
    formal: 2,
  };

  const formalityValues = analysedGarments
    .map((g) => (g.formality && formalityRank[g.formality] !== undefined ? formalityRank[g.formality] : 0));

  const minFormality = Math.min(...formalityValues);
  const maxFormality = Math.max(...formalityValues);
  const spread = maxFormality - minFormality;

  let formalityDelta = 0;
  let formalityReason = '';
  if (spread === 0) {
    formalityDelta = COLOUR_SCORING.FORMALITY_SPREAD[0];
    formalityReason = 'Uniform formality level across all outfit pieces (+5).';
  } else if (spread === 1) {
    formalityDelta = COLOUR_SCORING.FORMALITY_SPREAD[1];
    formalityReason = 'Compatible formality levels blend naturally (+0).';
  } else {
    formalityDelta = COLOUR_SCORING.FORMALITY_SPREAD[2];
    formalityReason = 'High formality clash between formal and casual pieces (-15).';
  }

  breakdown.push({ rule: 'formality', delta: formalityDelta });
  reasons.push(formalityReason);

  // Compute final score = 60 + sum(breakdown deltas), clamped 0..100
  const totalDelta = breakdown.reduce((acc, b) => acc + b.delta, 0);
  const rawScore = COLOUR_SCORING.BASE_SCORE + totalDelta;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    score,
    reasons,
    breakdown,
  };
}
