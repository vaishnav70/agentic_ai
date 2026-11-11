/**
 * Data Validation Schemas for StyleScent.
 *
 * What: Defines Zod schemas for all static and curated datasets (perfumes, colour rules,
 * pattern rules, tone maps) using shared domain enums.
 * Why: Guarantees that seed data and research imports are strictly validated at load time,
 * preventing corrupted, malformed, or unverified data from polluting the agent's reasoning.
 */

import { z } from 'zod';
import {
  SEASONS,
  OCCASIONS,
  TIMES,
  FAMILIES,
  VIBES,
  PROJECTION,
  LONGEVITY,
  PRICE_BANDS,
  MARKETED_FOR,
  PATTERNS,
  VERDICTS,
  LEVELS,
} from './enums.js';

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validates a single hex colour string.
 */
export const hexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Hex colour must match /^#[0-9A-Fa-f]{6}$/');

/**
 * Validates note strings are lowercase.
 */
export const lowercaseStringSchema = z
  .string()
  .refine((val) => val === val.toLowerCase(), {
    message: 'Note strings must be lowercase',
  });

/**
 * Schema for perfume note breakdown.
 */
export const perfumeNotesSchema = z.object({
  top: z.array(lowercaseStringSchema),
  heart: z.array(lowercaseStringSchema),
  base: z.array(lowercaseStringSchema),
});

/**
 * Schema for a single curated perfume entry.
 */
export const perfumeSchema = z.object({
  id: z.string().min(1),
  rank: z.number().int().positive().nullable(),
  name: z.string().min(1),
  brand: z.string().min(1),
  marketed_for: z.enum(MARKETED_FOR),
  family: z.enum(FAMILIES),
  notes: perfumeNotesSchema,
  longevity_hours: z.string().nullable(),
  longevity_min_hours: z.number().nullable(),
  longevity_max_hours: z.number().nullable(),
  longevity: z.enum(LONGEVITY).nullable(),
  projection: z.enum(PROJECTION).nullable(),
  seasons: z.array(z.enum(SEASONS)),
  occasions: z.array(z.enum(OCCASIONS)),
  time_of_day: z.array(z.enum(TIMES)),
  vibe: z.array(z.enum(VIBES)),
  price_band: z.enum(PRICE_BANDS).nullable(),
  sources: z.array(z.string()),
  source_agreement: z.enum(LEVELS),
  confidence: z.enum(LEVELS),
  verified: z.boolean(),
  inferred_fields: z.array(z.string()),
  source: z.string().min(1),
});

export const perfumesArraySchema = z.array(perfumeSchema);

/**
 * Schema for named colour definitions.
 */
export const namedColourSchema = z.object({
  name: z.string().min(1),
  hex: hexColorSchema,
  temperature: z.enum(['warm', 'cool', 'neutral']),
});

/**
 * Schema for colour rules dataset (colour_rules.json).
 */
export const colourRulesSchema = z.object({
  neutrals: z.array(z.string().min(1)),
  named_colours: z.array(namedColourSchema),
  season_palettes: z.object({
    spring: z.array(hexColorSchema),
    summer: z.array(hexColorSchema),
    autumn: z.array(hexColorSchema),
    winter: z.array(hexColorSchema),
  }),
  occasion_palettes: z.record(z.enum(OCCASIONS), z.array(hexColorSchema)),
  harmony_angles: z.object({
    complementary: z.array(z.number()),
    analogous: z.array(z.number()),
    triadic: z.array(z.number()),
  }),
  wearable_bounds: z.object({
    s: z.tuple([z.number(), z.number()]),
    l: z.tuple([z.number(), z.number()]),
  }),
});

/**
 * Schema for a single pattern pairing rule.
 */
export const patternPairingRuleSchema = z.object({
  a: z.enum(PATTERNS),
  b: z.enum(PATTERNS),
  verdict: z.enum(VERDICTS),
  reason: z.string().min(1),
});

/**
 * Schema for pattern rules dataset (patterns.json).
 */
export const patternsSchema = z.object({
  patterns: z.array(z.enum(PATTERNS)),
  pairing_rules: z.array(patternPairingRuleSchema),
  scale_rule: z.string().min(1),
});

/**
 * Schema for an outfit mood-to-vibe mapping item.
 */
export const toneMappingItemSchema = z.object({
  key: z.string().min(1),
  description: z.string().min(1),
  vibes: z.array(z.enum(VIBES)).min(1),
});

/**
 * Schema for tone map dataset (tone_map.json).
 */
export const toneMapSchema = z.array(toneMappingItemSchema);
