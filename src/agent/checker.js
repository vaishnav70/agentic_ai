/**
 * Safety & Quality Checker for StyleScent (Milestone M4, design.md §6.3).
 *
 * What: Deterministic, zero-LLM verification of a composed reply against
 * rules C1–C6, with automatic repair where a repair is safe. It never
 * invents data: repairs only strip, replace or disclose — they never add
 * a fragrance, a note or a claim.
 * Why: The LLM writes the prose, so only a programmatic check can prove
 * the reply names real dataset entries, honours avoided notes, and makes
 * no banned promise. The orchestrator runs this before delivering files,
 * so a failed check can also drop the offending fragrance from the files.
 *
 * Rules (design.md §6.3):
 *  C1  Every fragrance ID in the reply exists in perfumes.json.
 *  C2  No fragrance in the reply contains an avoided note.
 *  C3  scoreOutfit is >= 70, or the reply states the weak points honestly.
 *  C4  The reply includes an Assumptions section if any default was applied.
 *  C5  The reply contains none of the banned claims.
 *  C6  The reply names the dataset entry (ID) behind each fragrance.
 *
 * Extra (from the project status report, not design.md): "hypoallergenic"
 * is also banned — the agent must never make a medical-safety claim.
 */

import { OUTFIT_SCORE_THRESHOLD } from './rules.js';

/** Banned claims (C5). Each entry: pattern to find, safe replacement. */
export const BANNED_CLAIMS = [
  { pattern: /will get you the job/gi, replacement: 'can help you feel confident' },
  { pattern: /safe for allergies/gi, replacement: 'please check the ingredients if you have sensitivities' },
  { pattern: /perfect for everyone/gi, replacement: 'versatile' },
  { pattern: /hypoallergenic/gi, replacement: '' },
  // "guaranteed" last so longer phrases above are replaced first.
  { pattern: /\bguaranteed\b/gi, replacement: 'likely' },
];

function allNotes(perfume) {
  if (!perfume || !perfume.notes) return [];
  const { top = [], heart = [], base = [] } = perfume.notes;
  return [...top, ...heart, ...base].map((n) => String(n).toLowerCase());
}

function noteMatches(note, avoided) {
  const n = String(note).toLowerCase();
  const a = String(avoided).toLowerCase().trim();
  return a !== '' && (n === a || n.includes(a) || a.includes(n));
}

/**
 * Checks (and repairs) one composed reply.
 *
 * @param {object} input
 * @param {string} input.text Composed Markdown reply.
 * @param {object} [input.structured] Orchestrator structured result
 *   ({ look, fragrance, slots, assumptions, data }).
 * @param {object} [input.slots] Request slots (avoidNotes, …).
 * @param {object} [input.data] Full datasets ({ perfumes }).
 * @returns {{
 *   text: string,
 *   passed: boolean,
 *   failures: Array<{ id: string, detail: string }>,
 *   repairs: string[],
 *   verdict: string,
 *   structured: object|null
 * }}
 *   `structured` is a copy of the input structured result with any
 *   C1/C2-offending fragrances removed, so the orchestrator can build
 *   files from the corrected shortlist. Null when no structured was given.
 */
export function checkReply(input = {}) {
  const failures = [];
  const repairs = [];
  let text = typeof input.text === 'string' ? input.text : '';
  const structured = input.structured || null;
  const slots = input.slots || structured?.slots || {};
  const data = input.data || structured?.data || null;
  const perfumes = Array.isArray(data?.perfumes) ? data.perfumes : [];
  const byId = new Map(perfumes.map((p) => [p.id, p]));
  const avoidNotes = Array.isArray(slots.avoidNotes) ? slots.avoidNotes : [];
  const assumptions = Array.isArray(structured?.assumptions)
    ? structured.assumptions
    : Array.isArray(input.assumptions)
      ? input.assumptions
      : [];

  // Work on a copy of the structured fragrance list; drop offenders.
  let fixedStructured = null;
  let keptResults = null;
  if (structured?.fragrance && Array.isArray(structured.fragrance.results)) {
    keptResults = [...structured.fragrance.results];
    fixedStructured = {
      ...structured,
      fragrance: { ...structured.fragrance, results: keptResults },
    };
  }

  const dropFragrance = (id, reason) => {
    if (!keptResults) return;
    const before = keptResults.length;
    keptResults = keptResults.filter((r) => r.id !== id);
    if (fixedStructured) fixedStructured.fragrance.results = keptResults;
    if (keptResults.length !== before) repairs.push(`Removed fragrance ${id} from the shortlist (${reason}).`);
  };

  // ---- C1: every fragrance ID in the reply must exist in the dataset.
  const mentionedIds = [...new Set(text.match(/p_\d{3}/g) || [])];
  for (const id of mentionedIds) {
    if (!byId.has(id)) {
      failures.push({ id: 'C1', detail: `Fragrance id ${id} in the reply is not in perfumes.json.` });
      text = text.replaceAll(id, '[removed: unknown dataset id]');
      repairs.push(`Removed unknown fragrance id ${id} from the reply.`);
    }
  }
  // Also catch structured results pointing at unknown ids.
  if (keptResults) {
    for (const r of [...keptResults]) {
      if (r?.id && !byId.has(r.id)) {
        failures.push({ id: 'C1', detail: `Fragrance id ${r.id} in the results is not in perfumes.json.` });
        dropFragrance(r.id, 'unknown dataset id');
      }
    }
  }

  // ---- C2: no recommended fragrance may contain an avoided note.
  if (avoidNotes.length > 0 && keptResults) {
    for (const r of [...keptResults]) {
      const full = byId.get(r.id);
      if (!full) continue;
      const bad = allNotes(full).filter((note) => avoidNotes.some((a) => noteMatches(note, a)));
      if (bad.length > 0) {
        const avoided = [...new Set(bad)];
        failures.push({
          id: 'C2',
          detail: `${full.name} (${r.id}) contains avoided note(s): ${avoided.join(', ')}.`,
        });
        dropFragrance(r.id, `contains avoided note(s): ${avoided.join(', ')}`);
      }
    }
  }
  // Note: C2 is enforced on the structured shortlist above, not by
  // scanning prose — prose may legitimately say "without vanilla",
  // which is the constraint being honoured, not a violation.

  // ---- C3: outfit score >= 70, or honest weak-points disclosure.
  const score = structured?.look?.score;
  if (typeof score === 'number' && score < OUTFIT_SCORE_THRESHOLD) {
    const honest = /below our 70|scored \d+\/100|weak point/i.test(text);
    if (!honest) {
      failures.push({ id: 'C3', detail: `Outfit score ${score}/100 is below the ${OUTFIT_SCORE_THRESHOLD} threshold with no disclosure.` });
      text += `\n\n*Honest note: this outfit scored ${score}/100, below our ${OUTFIT_SCORE_THRESHOLD} threshold — treat the pairing as a starting point and adjust colours or fit to taste.*`;
      repairs.push(`Added honest low-score disclosure (score ${score}/100).`);
    }
  }

  // ---- C4: Assumptions section must exist when defaults were applied.
  if (assumptions.length > 0 && !/^## Assumptions/m.test(text)) {
    failures.push({ id: 'C4', detail: `${assumptions.length} assumption(s) were applied but the reply has no Assumptions section.` });
    text += `\n\n## Assumptions\n${assumptions.map((a) => `- ${a}`).join('\n')}`;
    repairs.push('Added the missing Assumptions section.');
  }

  // ---- C5: banned claims must not appear.
  for (const { pattern, replacement } of BANNED_CLAIMS) {
    if (pattern.test(text)) {
      // Reset lastIndex: the patterns are global.
      pattern.lastIndex = 0;
      const found = text.match(pattern);
      failures.push({ id: 'C5', detail: `Banned claim in reply: "${found?.[0] || pattern}".` });
      text = text.replace(pattern, replacement);
      repairs.push(`Removed banned claim "${found?.[0] || pattern}".`);
    }
    pattern.lastIndex = 0;
  }
  // Tidy double spaces left by removing "hypoallergenic".
  text = text.replace(/ {2,}/g, ' ');

  // ---- C6: each recommended fragrance must be named with its dataset ID.
  if (keptResults && keptResults.length > 0) {
    const missing = keptResults.filter((r) => !text.includes(r.id));
    if (missing.length > 0) {
      failures.push({
        id: 'C6',
        detail: `Fragrance(s) missing their dataset id in the reply: ${missing.map((r) => r.id).join(', ')}.`,
      });
      text += `\n\n*Dataset entries: ${keptResults.map((r) => `${r.name} (\`${r.id}\`)`).join(', ')}.*`;
      repairs.push('Added dataset ids for fragrances missing them.');
    }
  }

  const passed = failures.length === 0;
  const verdict = passed
    ? 'checker: PASS (C1–C6)'
    : `checker: ${failures.length} issue(s) found (${[...new Set(failures.map((f) => f.id))].join(', ')}) — repaired where safe`;

  return { text, passed, failures, repairs, verdict, structured: fixedStructured };
}

/**
 * Creates a checker bound to the loaded datasets, in the shape the
 * orchestrator expects: `{ check(input) }`. The orchestrator passes
 * `{ text, structured, slots }`; datasets come from `structured.data`.
 * Kept separate from checkReply so tests can call the pure function
 * directly with explicit data.
 *
 * @param {object} [data] Full datasets ({ perfumes }).
 * @returns {{ check: (input: object) => Promise<ReturnType<typeof checkReply>> }}
 */
export function createChecker(data = null) {
  return {
    async check(input = {}) {
      return checkReply({ ...input, data: input.data || input.structured?.data || data });
    },
  };
}

export default checkReply;
