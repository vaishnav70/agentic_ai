/**
 * Wardrobe Specialist for StyleScent AI.
 *
 * What: Deterministically builds complete looks, selects anchors, generates harmonious
 * colour combinations, checks pattern compatibility, and scores outfits using M2 tools.
 * Why: Pure deterministic logic guarantees reproducible styling grounded in colour
 * theory and rule tables without hallucinated items, invalid hexes, or random styling choices.
 */

import {
  LOOK_TEMPLATES,
  OCCASION_FORMALITY,
  TONE_PREDICATES,
} from './rules.js';

/**
 * Maps numeric formality level (0, 1, 2) to string representation.
 * @param {number} level
 * @returns {'casual'|'smart'|'formal'}
 */
function formalityLevelToString(level) {
  if (level === 2) return 'formal';
  if (level === 1) return 'smart';
  return 'casual';
}

// Tool call helper wrappers accommodating pre-bound or pure tool suites
function callAnalyseColour(tools, data, hex) {
  if (typeof tools?.colour?.analyse === 'function') return tools.colour.analyse(hex);
  if (typeof tools?.colour?.analyseColour === 'function') return tools.colour.analyseColour(hex, data.colourRules);
  if (typeof tools?.analyseColour === 'function') return tools.analyseColour(hex, data.colourRules);
  throw new Error('Colour analyse tool missing');
}

function callSuggestHarmonies(tools, data, hex, scheme) {
  if (typeof tools?.colour?.suggestHarmonies === 'function') {
    // Check arity or try bound
    try {
      return tools.colour.suggestHarmonies(hex, scheme, data.colourRules);
    } catch {
      return tools.colour.suggestHarmonies(hex, scheme);
    }
  }
  if (typeof tools?.suggestHarmonies === 'function') return tools.suggestHarmonies(hex, scheme, data.colourRules);
  throw new Error('Colour suggestHarmonies tool missing');
}

function callPaletteForSeason(tools, data, season) {
  if (typeof tools?.colour?.paletteForSeason === 'function') {
    try {
      return tools.colour.paletteForSeason(season, data.colourRules);
    } catch {
      return tools.colour.paletteForSeason(season);
    }
  }
  if (typeof tools?.paletteForSeason === 'function') return tools.paletteForSeason(season, data.colourRules);
  throw new Error('Colour paletteForSeason tool missing');
}

function callPaletteForOccasion(tools, data, occasion) {
  if (typeof tools?.colour?.paletteForOccasion === 'function') {
    try {
      return tools.colour.paletteForOccasion(occasion, data.colourRules);
    } catch {
      return tools.colour.paletteForOccasion(occasion);
    }
  }
  if (typeof tools?.paletteForOccasion === 'function') return tools.paletteForOccasion(occasion, data.colourRules);
  throw new Error('Colour paletteForOccasion tool missing');
}

function callScoreOutfit(tools, data, garments) {
  if (typeof tools?.colour?.scoreOutfit === 'function') {
    try {
      return tools.colour.scoreOutfit(garments, data.colourRules);
    } catch {
      return tools.colour.scoreOutfit(garments);
    }
  }
  if (typeof tools?.scoreOutfit === 'function') return tools.scoreOutfit(garments, data.colourRules);
  throw new Error('Colour scoreOutfit tool missing');
}

function callHueDistance(tools, a, b) {
  if (typeof tools?.colour?.hueDistance === 'function') return tools.colour.hueDistance(a, b);
  if (typeof tools?.hueDistance === 'function') return tools.hueDistance(a, b);
  // Default circular distance
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function callSuggestCompanions(tools, data, pattern) {
  if (typeof tools?.pattern?.suggestCompanions === 'function') {
    try {
      return tools.pattern.suggestCompanions(pattern, data.patterns);
    } catch {
      return tools.pattern.suggestCompanions(pattern);
    }
  }
  if (typeof tools?.suggestCompanions === 'function') return tools.suggestCompanions(pattern, data.patterns);
  return [];
}

function callCheckPatternPairing(tools, data, p1, p2) {
  if (typeof tools?.pattern?.checkPairing === 'function') return tools.pattern.checkPairing(p1, p2);
  if (typeof tools?.pattern?.checkPatternPairing === 'function') return tools.pattern.checkPatternPairing(p1, p2, data.patterns);
  if (typeof tools?.checkPatternPairing === 'function') return tools.checkPatternPairing(p1, p2, data.patterns);
  return { verdict: 'ok', reason: 'patterns compatible' };
}

function callScaleAdvice(tools, data, p1, p2) {
  if (typeof tools?.pattern?.scaleAdvice === 'function') {
    try {
      return tools.pattern.scaleAdvice(p1, p2, data.patterns);
    } catch {
      return tools.pattern.scaleAdvice(data.patterns);
    }
  }
  if (typeof tools?.scaleAdvice === 'function') return tools.scaleAdvice(data.patterns);
  return { advice: 'Pair with varying scale.' };
}

/**
 * Builds a complete look for the user based on slots and datasets.
 *
 * @param {import('./slots.js').Slots} slots
 * @param {Object} data Raw data tables (colourRules, patterns, toneMap, perfumes)
 * @param {Object} tools Pure deterministic tools (colour, pattern, perfume)
 * @returns {{
 *   anchor: Object,
 *   items: Array<{ type: string, colourHex: string, colourName: string, pattern: string, formality: string, source: 'user'|'suggested' }>,
 *   score: number,
 *   reasons: string[],
 *   breakdown: Array<{ rule: string, delta: number }>,
 *   patternNote: string|null
 * }}
 */
export function buildLook(slots, data, tools) {
  const occasion = slots.occasion || 'casual';
  const formalityLevel = OCCASION_FORMALITY[occasion] ?? 0;
  const occasionFormality = formalityLevelToString(formalityLevel);

  // 1. Determine template & slots
  const templateTypes = LOOK_TEMPLATES[occasion] || LOOK_TEMPLATES.default;
  const userGarments = Array.isArray(slots.garments) ? [...slots.garments] : [];

  // 2. Select Anchor
  let anchor = null;

  // 2a. First user garment with hex
  const userWithHex = userGarments.find((g) => g.colourHex);
  if (userWithHex) {
    const analysed = callAnalyseColour(tools, data, userWithHex.colourHex);
    anchor = {
      type: userWithHex.type,
      hex: userWithHex.colourHex,
      name: userWithHex.colourName || analysed.name,
      pattern: userWithHex.pattern || 'solid',
      formality: userWithHex.formality || occasionFormality,
      source: 'user',
    };
  }

  // 2b. Else first resolvable colour preference
  if (!anchor && Array.isArray(slots.colourPrefs)) {
    for (const pref of slots.colourPrefs) {
      if (!pref) continue;
      const clean = pref.trim().toLowerCase();
      // Check named colours
      const matched = data.colourRules.named_colours.find(
        (c) => c.name.toLowerCase() === clean || c.hex.toLowerCase() === clean
      );
      if (matched) {
        anchor = {
          type: templateTypes[0] || 'top',
          hex: matched.hex,
          name: matched.name,
          pattern: 'solid',
          formality: occasionFormality,
          source: 'suggested',
        };
        break;
      }
    }
  }

  // 2c. Else occasion palette passing tone predicate and within 25° of a season hue
  const occasionPalette = callPaletteForOccasion(tools, data, occasion);
  const seasonPalette = slots.season
    ? callPaletteForSeason(tools, data, slots.season)
    : [];

  if (!anchor && slots.tone && TONE_PREDICATES[slots.tone]) {
    const predicate = TONE_PREDICATES[slots.tone];
    for (const col of occasionPalette) {
      const analysed = callAnalyseColour(tools, data, col.hex);
      const passesTone = predicate(analysed);
      if (!passesTone) continue;

      if (seasonPalette.length > 0) {
        const nearSeason = seasonPalette.some((sc) => {
          const sAnalysed = callAnalyseColour(tools, data, sc.hex);
          return callHueDistance(tools, analysed.hsl.h, sAnalysed.hsl.h) <= 25;
        });
        if (nearSeason) {
          anchor = {
            type: templateTypes[0] || 'top',
            hex: col.hex,
            name: col.name,
            pattern: 'solid',
            formality: occasionFormality,
            source: 'suggested',
          };
          break;
        }
      } else {
        anchor = {
          type: templateTypes[0] || 'top',
          hex: col.hex,
          name: col.name,
          pattern: 'solid',
          formality: occasionFormality,
          source: 'suggested',
        };
        break;
      }
    }
  }

  // 2d. Else occasion palette[0]
  if (!anchor && occasionPalette.length > 0) {
    anchor = {
      type: templateTypes[0] || 'top',
      hex: occasionPalette[0].hex,
      name: occasionPalette[0].name,
      pattern: 'solid',
      formality: occasionFormality,
      source: 'suggested',
    };
  }

  // 2e. Else first named colour passing tone, or default
  if (!anchor && slots.tone && TONE_PREDICATES[slots.tone]) {
    const predicate = TONE_PREDICATES[slots.tone];
    for (const col of data.colourRules.named_colours) {
      const analysed = callAnalyseColour(tools, data, col.hex);
      if (predicate(analysed)) {
        anchor = {
          type: templateTypes[0] || 'top',
          hex: col.hex,
          name: col.name,
          pattern: 'solid',
          formality: occasionFormality,
          source: 'suggested',
        };
        break;
      }
    }
  }

  // Final fallback
  if (!anchor) {
    const fallbackCol = data.colourRules.named_colours[0];
    anchor = {
      type: templateTypes[0] || 'top',
      hex: fallbackCol.hex,
      name: fallbackCol.name,
      pattern: 'solid',
      formality: occasionFormality,
      source: 'suggested',
    };
  }

  // 3. Assemble target item types
  const userTypesCovered = new Set();
  const initialItems = [];

  for (const ug of userGarments) {
    const hex = ug.colourHex || anchor.hex;
    const analysed = callAnalyseColour(tools, data, hex);
    initialItems.push({
      type: ug.type,
      colourHex: hex,
      colourName: ug.colourName || analysed.name,
      pattern: ug.pattern || 'solid',
      formality: ug.formality || occasionFormality,
      source: 'user',
    });
    userTypesCovered.add(ug.type);
  }

  // If user provided no garments, anchor becomes the first template item
  if (initialItems.length === 0) {
    initialItems.push({
      type: anchor.type,
      colourHex: anchor.hex,
      colourName: anchor.name,
      pattern: anchor.pattern,
      formality: anchor.formality,
      source: 'suggested',
    });
    userTypesCovered.add(anchor.type);
  }

  // Find empty template types that need suggestions
  const emptyTypes = templateTypes.filter((t) => !userTypesCovered.has(t));

  // 4. Generate Candidates for Empty Slots
  const namedNeutrals = data.colourRules.named_colours.filter((c) =>
    data.colourRules.neutrals.includes(c.name)
  );

  const analogous = callSuggestHarmonies(tools, data, anchor.hex, 'analogous').colours;
  const complementary = callSuggestHarmonies(tools, data, anchor.hex, 'complementary').colours;
  const neutralPair = callSuggestHarmonies(tools, data, anchor.hex, 'neutral-pair').colours;

  // General candidate pool for non-footwear
  const generalCandidateMap = new Map();
  for (const c of [...analogous, ...complementary, ...neutralPair, ...namedNeutrals]) {
    if (!generalCandidateMap.has(c.hex.toLowerCase())) {
      generalCandidateMap.set(c.hex.toLowerCase(), c);
    }
  }
  const generalCandidates = Array.from(generalCandidateMap.values());

  // Footwear candidate pool: neutrals only
  const footwearCandidateMap = new Map();
  for (const c of [...neutralPair, ...namedNeutrals]) {
    if (!footwearCandidateMap.has(c.hex.toLowerCase())) {
      footwearCandidateMap.set(c.hex.toLowerCase(), c);
    }
  }
  const footwearCandidates = Array.from(footwearCandidateMap.values());

  // 5. Enumerate combinations (cap 200)
  const slotCandidates = emptyTypes.map((type) => {
    return {
      type,
      candidates: type === 'footwear' ? footwearCandidates : generalCandidates,
    };
  });

  let combinations = [[]];
  for (const sc of slotCandidates) {
    const nextCombos = [];
    for (const prefix of combinations) {
      for (const cand of sc.candidates) {
        nextCombos.push([...prefix, { type: sc.type, colour: cand }]);
        if (nextCombos.length >= 200) break;
      }
      if (nextCombos.length >= 200) break;
    }
    combinations = nextCombos;
    if (combinations.length >= 200) break;
  }

  if (emptyTypes.length === 0) {
    combinations = [[]];
  }

  // 6. Score each combination
  let bestScore = -Infinity;
  let bestHueFamilies = Infinity;
  let bestHexStr = '';
  let bestLook = null;

  for (const combo of combinations) {
    const candidateItems = [
      ...initialItems,
      ...combo.map((item) => ({
        type: item.type,
        colourHex: item.colour.hex,
        colourName: item.colour.name,
        pattern: 'solid',
        formality: occasionFormality,
        source: 'suggested',
      })),
    ];

    const scoreInput = candidateItems.map((it) => ({
      type: it.type,
      colour_hex: it.colourHex,
      colour_name: it.colourName,
      pattern: it.pattern,
      formality: it.formality,
    }));

    const scoreResult = callScoreOutfit(tools, data, scoreInput);

    // Compute chromatic hue families for tie-breaking
    const chromaticHues = candidateItems
      .map((it) => callAnalyseColour(tools, data, it.colourHex))
      .filter((a) => !a.isNeutral)
      .map((a) => a.hsl.h);

    const families = [];
    for (const h of chromaticHues) {
      const near = families.some((fam) => callHueDistance(tools, fam, h) <= 25);
      if (!near) families.push(h);
    }
    const hueFamilyCount = families.length;
    const hexStr = candidateItems.map((it) => it.colourHex.toLowerCase()).sort().join('');

    let isBetter = false;
    if (scoreResult.score > bestScore) {
      isBetter = true;
    } else if (scoreResult.score === bestScore) {
      if (hueFamilyCount < bestHueFamilies) {
        isBetter = true;
      } else if (hueFamilyCount === bestHueFamilies) {
        if (!bestHexStr || hexStr.localeCompare(bestHexStr) < 0) {
          isBetter = true;
        }
      }
    }

    if (isBetter) {
      bestScore = scoreResult.score;
      bestHueFamilies = hueFamilyCount;
      bestHexStr = hexStr;
      bestLook = {
        items: candidateItems,
        score: scoreResult.score,
        reasons: scoreResult.reasons,
        breakdown: scoreResult.breakdown,
      };
    }
  }

  // 7. Pattern Companion and Scale Advice
  let patternNote = null;
  const userPatternGarment = bestLook.items.find(
    (it) => it.source === 'user' && it.pattern && it.pattern !== 'solid'
  );

  if (userPatternGarment) {
    const companions = callSuggestCompanions(tools, data, userPatternGarment.pattern);
    const mainTypes = ['top', 'bottom', 'ethnic', 'outerwear', 'dress'];
    const nextMainItem = bestLook.items.find(
      (it) =>
        it !== userPatternGarment &&
        mainTypes.includes(it.type) &&
        it.source === 'suggested'
    );

    if (nextMainItem && companions.length > 0) {
      nextMainItem.pattern = companions[0];
    }

    const nonSolids = bestLook.items.filter((it) => it.pattern && it.pattern !== 'solid');
    if (nonSolids.length >= 2) {
      const p1 = nonSolids[0].pattern;
      const p2 = nonSolids[1].pattern;
      const pairing = callCheckPatternPairing(tools, data, p1, p2);
      const scale = callScaleAdvice(tools, data, p1, p2);
      const scaleText = typeof scale === 'string' ? scale : scale?.advice || '';
      patternNote = `${pairing.reason}. ${scaleText}`.trim();
    }
  }

  return {
    anchor,
    items: bestLook.items,
    score: bestLook.score,
    reasons: bestLook.reasons,
    breakdown: bestLook.breakdown,
    patternNote,
  };
}

/**
 * Returns pairing ideas for an anchor piece (for pairing_only intent).
 *
 * @param {import('./slots.js').Slots} slots
 * @param {Object} data
 * @param {Object} tools
 * @returns {{
 *   anchor: Object,
 *   complementary: Array<{ hex: string, name: string }>,
 *   analogous: Array<{ hex: string, name: string }>,
 *   neutralPair: Array<{ hex: string, name: string }>,
 *   companionPatterns: string[],
 *   notes: string[]
 * }}
 */
export function pairingIdeas(slots, data, tools) {
  const userGarment = Array.isArray(slots.garments) && slots.garments.length > 0 ? slots.garments[0] : null;
  let hex = userGarment?.colourHex || null;
  let pattern = userGarment?.pattern || 'solid';

  if (!hex && Array.isArray(slots.colourPrefs) && slots.colourPrefs.length > 0) {
    const clean = slots.colourPrefs[0].trim().toLowerCase();
    const matched = data.colourRules.named_colours.find(
      (c) => c.name.toLowerCase() === clean || c.hex.toLowerCase() === clean
    );
    if (matched) hex = matched.hex;
  }

  if (!hex) {
    hex = data.colourRules.named_colours[0].hex;
  }

  const analysed = callAnalyseColour(tools, data, hex);
  const anchor = {
    type: userGarment?.type || 'top',
    hex,
    name: userGarment?.colourName || analysed.name,
    pattern,
    formality: userGarment?.formality || 'smart',
  };

  const comp = callSuggestHarmonies(tools, data, hex, 'complementary');
  const ana = callSuggestHarmonies(tools, data, hex, 'analogous');
  const neutral = callSuggestHarmonies(tools, data, hex, 'neutral-pair');

  const companionPatterns =
    pattern && pattern !== 'solid'
      ? callSuggestCompanions(tools, data, pattern)
      : [];

  const notes = [comp.note, ana.note, neutral.note].filter(Boolean);

  return {
    anchor,
    complementary: comp.colours.slice(0, 3),
    analogous: ana.colours.slice(0, 3),
    neutralPair: neutral.colours.slice(0, 3),
    companionPatterns,
    notes,
  };
}

/**
 * Maps the outfit to tone_map keys that exist in data/tone_map.json.
 *
 * @param {Object} look
 * @param {Object} data
 * @returns {string[]}
 */
export function outfitToneKeys(look, data) {
  const existingKeys = new Set(data.toneMap.map((t) => t.key));
  const keys = new Set();
  const items = look.items || [];

  if (items.length === 0) return [];

  // Ethnic festive check
  if (items.some((it) => it.type === 'ethnic')) {
    keys.add('ethnic_festive');
  }

  // Formality check
  if (items.every((it) => it.formality === 'formal' || it.formality === 'smart')) {
    keys.add('smart_formal');
  }
  if (items.every((it) => it.formality === 'casual')) {
    keys.add('casual_relaxed');
  }

  // Colour analysis
  const colourRules = data.colourRules;
  let allNeutral = true;
  let hasBlack = false;
  let hasWhite = false;
  let hasDark = false;
  let hasPastel = false;
  let hasBright = false;
  let hasEarthy = false;
  let hasJewel = false;

  for (const it of items) {
    if (!it.colourHex) continue;
    const hex = it.colourHex;
    const named = colourRules.named_colours.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
    const isNeutralName = named && colourRules.neutrals.includes(named.name);

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let s = 0;
    if (max !== min) {
      s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    }

    const isNeutral = isNeutralName || s < 0.15 || l < 0.1 || l > 0.94;
    if (!isNeutral) allNeutral = false;

    const lowerName = named ? named.name.toLowerCase() : '';
    if (['black', 'charcoal'].includes(lowerName) || l < 0.15) hasBlack = true;
    if (['white', 'off-white', 'cream'].includes(lowerName) || l > 0.9) hasWhite = true;

    if (l < 0.35 && s > 0.25) hasDark = true;
    if (l > 0.75 && s < 0.6 && !isNeutral) hasPastel = true;
    if (s > 0.7) hasBright = true;
    if (named?.temperature === 'warm' && s < 0.6 && !isNeutral) hasEarthy = true;
    if (s > 0.5 && l >= 0.25 && l <= 0.45) hasJewel = true;
  }

  if (allNeutral) {
    keys.add('monochrome_neutral');
    if (hasBlack && hasWhite) {
      keys.add('black_and_white');
    }
  }

  if (hasDark) keys.add('dark_bold_palette');
  if (hasPastel) keys.add('pastel_palette');
  if (hasBright) keys.add('bright_saturated');
  if (hasEarthy) keys.add('earthy_palette');
  if (hasJewel) keys.add('jewel_tones');

  return Array.from(keys).filter((k) => existingKeys.has(k));
}
