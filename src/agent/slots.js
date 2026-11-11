/**
 * Slot Extraction, Merging, and Normalisation for StyleScent.
 *
 * What: Defines the NLU Slots schema, executes LLM understanding with 1-turn repair,
 * merges multi-turn session slots, and resolves default styling assumptions.
 * Why: Isolates NLU output parsing from downstream deterministic styling tools,
 * enforcing schema conformance and transparent assumption tracking.
 */

import { z } from 'zod';
import {
  OCCASIONS,
  SEASONS,
  TIMES,
  VIBES,
  PROJECTION,
  PRICE_BANDS,
  MARKETED_FOR,
  PATTERNS,
} from '../data/enums.js';
import {
  OCCASION_FORMALITY,
  OCCASION_DEFAULT_TIME,
  BUDGET_BANDS_INR,
  defaultSeason,
} from './rules.js';
import { UNDERSTAND_SYSTEM } from './prompts.js';
import { HEX_COLOR_REGEX } from '../data/schemas.js';
import { analyseColour } from '../tools/colour.js';

export const garmentSchema = z.object({
  type: z.enum([
    'top',
    'bottom',
    'outerwear',
    'dress',
    'ethnic',
    'footwear',
    'accessory',
  ]),
  colourName: z.string().nullable().default(null),
  colourHex: z.string().nullable().default(null),
  pattern: z.enum(PATTERNS).nullable().default(null),
  formality: z.enum(['casual', 'smart', 'formal']).nullable().default(null),
});

export const slotsSchema = z.object({
  intent: z.enum([
    'full_look',
    'pairing_only',
    'fragrance_only',
    'greeting_help',
    'out_of_scope',
  ]),
  unsupported: z
    .array(z.enum(['guarantee', 'live_price_stock', 'medical_allergy']))
    .default([]),
  occasion: z.enum(OCCASIONS).nullable().default(null),
  season: z.enum(SEASONS).nullable().default(null),
  timeOfDay: z.enum(TIMES).nullable().default(null),
  tone: z
    .enum(['dark', 'light', 'pastel', 'bright', 'earthy', 'neutral'])
    .nullable()
    .default(null),
  colourPrefs: z.array(z.string()).default([]),
  vibe: z.array(z.enum(VIBES)).default([]),
  projection: z.enum(PROJECTION).nullable().default(null),
  minLongevityHours: z.number().nullable().default(null),
  budgetInrMax: z.number().nullable().default(null),
  budget: z.enum(PRICE_BANDS).nullable().default(null),
  marketedFor: z.enum(MARKETED_FOR).nullable().default(null),
  avoidNotes: z.array(z.string()).default([]),
  requireNotes: z.array(z.string()).default([]),
  garments: z.array(garmentSchema).default([]),
  acknowledgeConflict: z.boolean().default(false),
});

/**
 * Deterministic keyword slot extractor — no LLM involved.
 *
 * What: Best-effort slot extraction from plain keyword matching, used only
 * when the LLM understanding step fails (API error, bad JSON, or schema
 * mismatch). It covers the demo-critical cases: occasion, tone, colours,
 * avoid/require notes, budget, gendered marketing, vibe and projection.
 * Why: The live agent answered "I don't understand" to every request on
 * 2026-11-11 even though the Gemini key was set and the call was made —
 * one failing LLM step must not brick the whole agent. The deterministic
 * tools downstream (wardrobe, fragrance matcher, checker) do the real
 * work from these slots, so a keyword pass still produces a grounded plan.
 * Returns null when the text carries no styling signal at all, so
 * genuinely out-of-scope input still gets the rephrase/clarify path.
 *
 * @param {string} userText
 * @returns {z.infer<typeof slotsSchema> | null}
 */
export function deterministicUnderstand(userText) {
  const text = (userText || '').toLowerCase();
  const has = (...words) => words.some((w) => text.includes(w));

  const outfitWords = ['outfit', 'wear', 'dress', 'look', 'cloth', 'kurta', 'shirt', 'pant', 'trouser', 'jean', 'shoe', 'sneaker', 'jacket', 'hoodie', 'style', 'pair', 'goes with'];
  const fragranceWords = ['perfume', 'fragrance', 'scent', 'cologne', 'smell', 'oud', 'attar'];
  const hasOutfit = has(...outfitWords);
  const hasFragrance = has(...fragranceWords);

  let intent = null;
  if (hasOutfit && hasFragrance) intent = 'full_look';
  else if (hasFragrance) intent = 'fragrance_only';
  else if (hasOutfit) intent = 'pairing_only';
  if (!intent) return null;

  const occasionMap = [
    [['college fest', 'college_fest', 'collegefest', 'fest'], 'college_fest'],
    [['interview', 'job interview'], 'interview'],
    [['office', 'work meeting', 'workwear'], 'office'],
    [['wedding', 'shaadi', 'marriage'], 'wedding'],
    [['date night', 'date_night', ' dinner date'], 'date_night'],
    [['party', 'clubbing', 'night out'], 'party'],
    [['festival', 'diwali', 'traditional', 'navratri', 'garba'], 'festival_traditional'],
  ];
  let occasion = null;
  for (const [words, value] of occasionMap) {
    if (has(...words)) { occasion = value; break; }
  }

  const timeOfDay = has('night') ? 'night' : has('evening') ? 'evening' : has('morning', 'afternoon', 'daytime') ? 'day' : null;
  const season = has('summer') ? 'summer' : has('winter') ? 'winter' : has('spring') ? 'spring' : has('autumn', 'fall season') ? 'autumn' : null;
  const tone = has('dark colour', 'dark color', 'dark tone', 'dark colours', 'dark colors') ? 'dark'
    : has('pastel') ? 'pastel'
    : has('bright colour', 'bright color', 'bright colours', 'bright colors', 'vibrant') ? 'bright'
    : has('earthy') ? 'earthy'
    : has('light colour', 'light color', 'light colours', 'light colors') ? 'light'
    : has('neutral') ? 'neutral' : null;

  const colourNames = ['black', 'white', 'red', 'blue', 'green', 'navy', 'grey', 'gray', 'beige', 'brown', 'maroon', 'pink', 'yellow', 'orange', 'purple', 'cream', 'charcoal', 'teal', 'olive'];
  const colourPrefs = colourNames.filter((c) => new RegExp(`\\b${c}\\b`).test(text));

  const noteNames = ['vanilla', 'musk', 'oud', 'rose', 'citrus', 'lavender', 'sandalwood', 'amber', 'jasmine', 'bergamot', 'woody', 'floral'];
  const avoidNotes = noteNames.filter((n) => has(`no ${n}`, `avoid ${n}`, `without ${n}`, `not ${n}`, `no-${n}`));
  const requireNotes = noteNames.filter((n) => has(`with ${n}`, `want ${n}`, `love ${n}`, `must have ${n}`, `need ${n}`));

  const budgetMatch = text.match(/under\s*(?:rs\.?|₹|inr)?\s*(\d[\d,]*)/);
  const budgetInrMax = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : null;
  const budget = has('low budget', 'cheap', 'budget-friendly', 'under 1000', 'under ₹1000') || (budgetInrMax !== null && budgetInrMax <= 1000)
    ? 'budget' : has('premium', 'luxury', 'expensive') ? 'premium' : null;

  const marketedFor = has('for women', 'women', 'female', 'for her') ? 'women'
    : has('for men', 'men', 'male', 'for him') ? 'men' : null;

  const vibeMap = [['confident', 'confident'], ['bold', 'bold'], ['fresh', 'fresh'], ['elegant', 'elegant'], ['playful', 'playful'], ['calm', 'calm'], ['romantic', 'romantic']];
  const vibe = vibeMap.filter(([w]) => has(w)).map(([, v]) => v);

  const projection = has('strong projection', 'projects well', 'long lasting', 'long-lasting', 'beast mode') ? 'strong'
    : has('soft', 'subtle', 'light scent') ? 'soft'
    : has('moderate') ? 'moderate' : null;

  const slots = {
    intent,
    unsupported: [],
    occasion,
    season,
    timeOfDay,
    tone,
    colourPrefs,
    vibe,
    projection,
    minLongevityHours: null,
    budgetInrMax,
    budget,
    marketedFor,
    avoidNotes,
    requireNotes,
    garments: [],
    acknowledgeConflict: false,
  };
  const parsed = slotsSchema.safeParse(slots);
  return parsed.success ? parsed.data : null;
}

/**
 * Extracts slot values from user text via LLM, with a single automated repair attempt on validation failure.
 * If the LLM step fails for any reason, falls back to deterministicUnderstand
 * so one bad LLM call never bricks the agent.
 *
 * @param {string} userText
 * @param {object} [context]
 * @param {object} [context.previousSlots]
 * @param {string} [context.lastQuestion]
 * @param {object} llm
 * @returns {Promise<{ ok: boolean, slots?: z.infer<typeof slotsSchema> }>}
 */
export async function understand(
  userText,
  { previousSlots, lastQuestion } = {},
  llm
) {
  if (!llm || typeof llm.generateJson !== 'function') {
    return { ok: false };
  }

  const payload = {
    userText,
    ...(previousSlots ? { previousSlots } : {}),
    ...(lastQuestion ? { lastQuestion } : {}),
  };

  try {
    const rawJson = await llm.generateJson(JSON.stringify(payload), {
      system: UNDERSTAND_SYSTEM,
      temperature: 0.1,
    });

    const parsed = slotsSchema.safeParse(rawJson);
    if (parsed.success) {
      return { ok: true, slots: parsed.data };
    }

    // Single repair attempt with validation errors included
    const repairPrompt = `The previous JSON response failed validation with the following errors:\n${parsed.error.message}\nOriginal output was:\n${JSON.stringify(rawJson)}\nPlease output the corrected valid JSON according to schema.`;

    const repairedJson = await llm.generateJson(repairPrompt, {
      system: UNDERSTAND_SYSTEM,
      temperature: 0.1,
    });

    const repairedParse = slotsSchema.safeParse(repairedJson);
    if (repairedParse.success) {
      return { ok: true, slots: repairedParse.data };
    }

    const fallback = deterministicUnderstand(userText);
    return fallback ? { ok: true, slots: fallback } : { ok: false };
  } catch {
    const fallback = deterministicUnderstand(userText);
    return fallback ? { ok: true, slots: fallback } : { ok: false };
  }
}

/**
 * Merges previous session slots with newly extracted slots.
 *
 * @param {z.infer<typeof slotsSchema>|null} previous
 * @param {z.infer<typeof slotsSchema>} next
 * @returns {z.infer<typeof slotsSchema>}
 */
export function mergeSlots(previous, next) {
  if (!previous) return next;
  if (!next) return previous;

  const unionStrings = (a = [], b = []) => {
    const set = new Set();
    a.forEach((item) => set.add(String(item).toLowerCase()));
    b.forEach((item) => set.add(String(item).toLowerCase()));
    return Array.from(set);
  };

  const unionEnums = (a = [], b = []) => {
    const set = new Set([...a, ...b]);
    return Array.from(set);
  };

  const pick = (nextVal, prevVal) => {
    if (nextVal !== null && nextVal !== undefined && nextVal !== '') {
      return nextVal;
    }
    return prevVal;
  };

  return {
    intent: pick(next.intent, previous.intent),
    unsupported: unionEnums(previous.unsupported, next.unsupported),
    occasion: pick(next.occasion, previous.occasion),
    season: pick(next.season, previous.season),
    timeOfDay: pick(next.timeOfDay, previous.timeOfDay),
    tone: pick(next.tone, previous.tone),
    colourPrefs: unionStrings(previous.colourPrefs, next.colourPrefs),
    vibe: unionEnums(previous.vibe, next.vibe),
    projection: pick(next.projection, previous.projection),
    minLongevityHours: pick(next.minLongevityHours, previous.minLongevityHours),
    budgetInrMax: pick(next.budgetInrMax, previous.budgetInrMax),
    budget: pick(next.budget, previous.budget),
    marketedFor: pick(next.marketedFor, previous.marketedFor),
    avoidNotes: unionStrings(previous.avoidNotes, next.avoidNotes),
    requireNotes: unionStrings(previous.requireNotes, next.requireNotes),
    garments: next.garments && next.garments.length > 0 ? next.garments : previous.garments,
    acknowledgeConflict:
      next.acknowledgeConflict !== undefined
        ? next.acknowledgeConflict
        : previous.acknowledgeConflict,
  };
}

/**
 * Normalises slot values against curated colour rules and clock, generating explicit assumption strings.
 *
 * @param {z.infer<typeof slotsSchema>} rawSlots
 * @param {object} deps
 * @param {object} deps.colourRules
 * @param {Function} [deps.clock=() => new Date()]
 * @returns {{ slots: z.infer<typeof slotsSchema>, assumptions: string[] }}
 */
export function normaliseSlots(rawSlots, { colourRules, clock = () => new Date() }) {
  const slots = JSON.parse(JSON.stringify(rawSlots));
  const assumptions = [];

  // 1. Resolve garments colour names to exact named_colours hex
  if (Array.isArray(slots.garments)) {
    slots.garments = slots.garments.map((g) => {
      const copy = { ...g };
      if (copy.colourName && colourRules) {
        const exact = colourRules.named_colours?.find(
          (c) => c.name.toLowerCase() === copy.colourName.trim().toLowerCase()
        );
        if (exact) {
          copy.colourHex = exact.hex.toLowerCase();
        }
      }

      // If valid colourHex exists, validate or derive name if missing
      if (copy.colourHex && HEX_COLOR_REGEX.test(copy.colourHex)) {
        copy.colourHex = copy.colourHex.toLowerCase();
        if (!copy.colourName && colourRules) {
          copy.colourName = analyseColour(copy.colourHex, colourRules).name;
        }
      } else if (copy.colourHex && !HEX_COLOR_REGEX.test(copy.colourHex)) {
        copy.colourHex = null;
      }

      // Default garment formality if missing
      if (!copy.formality && slots.occasion && OCCASION_FORMALITY[slots.occasion] !== undefined) {
        const level = OCCASION_FORMALITY[slots.occasion];
        copy.formality = level === 0 ? 'casual' : level === 1 ? 'smart' : 'formal';
      }

      return copy;
    });
  }

  // 2. Budget INR to band mapping (INR takes precedence)
  if (typeof slots.budgetInrMax === 'number' && slots.budgetInrMax > 0) {
    if (slots.budgetInrMax <= BUDGET_BANDS_INR.budgetMax) {
      slots.budget = 'budget';
    } else if (slots.budgetInrMax <= BUDGET_BANDS_INR.midMax) {
      slots.budget = 'mid';
    } else {
      slots.budget = 'premium';
    }
  }

  // 3. Default season derived from clock
  if (!slots.season) {
    const derivedSeason = defaultSeason(clock());
    slots.season = derivedSeason;
    assumptions.push(`Assuming ${derivedSeason} (based on today's date)`);
  }

  // 4. Default time of day inferred from occasion
  if (!slots.timeOfDay) {
    if (slots.occasion && OCCASION_DEFAULT_TIME[slots.occasion]) {
      const derivedTime = OCCASION_DEFAULT_TIME[slots.occasion];
      slots.timeOfDay = derivedTime;
      assumptions.push(`Assuming ${derivedTime} time of day for ${slots.occasion}`);
    } else {
      slots.timeOfDay = 'evening';
      assumptions.push('Assuming evening time of day');
    }
  }

  // 5. Unrecognised colour preferences
  if (Array.isArray(slots.colourPrefs) && colourRules) {
    slots.colourPrefs = slots.colourPrefs.filter((cName) => {
      const nameMatch = colourRules.named_colours?.some(
        (nc) => nc.name.toLowerCase() === String(cName).trim().toLowerCase()
      );
      const hexMatch = HEX_COLOR_REGEX.test(cName);
      if (!nameMatch && !hexMatch) {
        assumptions.push(`Ignored unrecognised colour preference: "${cName}"`);
        return false;
      }
      return true;
    });
  }

  return { slots, assumptions };
}
