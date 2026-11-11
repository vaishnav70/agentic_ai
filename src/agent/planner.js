/**
 * Agent Execution Planner for StyleScent AI.
 *
 * What: Deterministically generates a 4 to 6 line execution plan for active specialists.
 * Why: Surfaces the agent's internal reasoning and planned actions to the user and trace,
 * demonstrating autonomous multi-step execution rather than an opaque LLM wrapper.
 */

/**
 * Builds a deterministic 4 to 6 line execution plan tailored to the active intent.
 *
 * @param {import('./slots.js').Slots} slots
 * @returns {string[]}
 */
export function buildPlan(slots) {
  const intent = slots.intent || 'full_look';

  if (intent === 'pairing_only') {
    return [
      '1. Read request and identify the anchor piece.',
      '2. Generate complementary, analogous, and neutral colour harmonies.',
      '3. Evaluate companion patterns and scale guidance.',
      '4. Synthesise pairing recommendations and review look synergy.',
    ];
  }

  if (intent === 'fragrance_only') {
    return [
      '1. Read occasion, season, and olfactory preferences.',
      '2. Filter curated fragrance database by notes and constraints.',
      '3. Score and rank perfumes across occasion, season, and projection.',
      '4. Synthesise fragrance recommendations with notes and caveats.',
    ];
  }

  if (intent === 'greeting_help' || intent === 'out_of_scope') {
    return [
      '1. Read user input and assess intent.',
      '2. Select appropriate guidance and formulate response.',
    ];
  }

  // Default: full_look
  return [
    '1. Read request and determine occasion styling constraints.',
    '2. Assemble wardrobe palette and harmonise garment colours.',
    '3. Evaluate pattern pairings and score outfit synergy.',
    '4. Query tone map and match fragrances aligned with the look.',
    '5. Synthesise complete look, fragrance pick, and assumptions.',
  ];
}
