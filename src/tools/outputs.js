/**
 * Multi-format Output Generators for StyleScent (Milestone M4).
 *
 * What: Builds the downloadable artefacts for a finished look — a CSV
 * shopping list and a Markdown outfit plan — from the same deterministic
 * structured results the chat reply is composed from, so the files can
 * never name a fragrance or garment the reply did not.
 * Why: The PRD (FR-12) requires the same request to return a chat reply,
 * a CSV file and a Markdown plan. No extra dependency: CSV is built by
 * hand (quoted fields, CRLF, UTF-8 BOM, formula-injection safe).
 *
 * Notes on shapes (see composer.js / tools/perfume.js):
 * - look: { items: [{ type, colourName, colourHex, pattern, source }],
 *           score, reasons?, patternNote? }
 * - fragrance: { results: [{ id, name, brand, score, reasons? }] }
 *   Matcher results carry NO notes — full note / price data is looked up
 *   from data.perfumes by id when `data` is supplied.
 * - pairing: { anchor, complementary?, analogous?, neutralPair?,
 *              companionPatterns?, notes? } (pairing_only intent)
 */

const CSV_HEADER = ['item', 'category', 'colour_name', 'colour_hex', 'pattern', 'notes'];

/**
 * Quote one CSV field. Every field is quoted; embedded quotes are doubled.
 * Fields that could be interpreted as a spreadsheet formula (=, +, -, @,
 * tab or carriage return at the start) are neutralised with a leading
 * single quote, per the PDF status report's formula-injection-safe rule.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function csvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function titleCase(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function allNotes(perfume) {
  if (!perfume || !perfume.notes) return [];
  const { top = [], heart = [], base = [] } = perfume.notes;
  return [...top, ...heart, ...base];
}

function findPerfume(data, id) {
  if (!data || !Array.isArray(data.perfumes)) return null;
  return data.perfumes.find((p) => p.id === id) || null;
}

/**
 * Builds the CSV shopping list.
 * Columns (design.md §5.5): item,category,colour_name,colour_hex,pattern,notes.
 * One row per look item, plus one row per recommended fragrance.
 *
 * @param {object|null} look
 * @param {object|null} fragrance
 * @param {object} [options]
 * @param {object} [options.data] Full datasets, for fragrance notes/price.
 * @param {object} [options.pairing] Pairing result (pairing_only intent).
 * @returns {string} CSV text with UTF-8 BOM and CRLF line endings.
 */
export function buildShoppingListCsv(look, fragrance, options = {}) {
  const rows = [CSV_HEADER];
  const items = Array.isArray(look?.items) ? look.items : [];

  for (const it of items) {
    rows.push([
      titleCase(it.type || 'item'),
      'outfit',
      it.colourName || '',
      it.colourHex || '',
      it.pattern || '',
      it.source ? `Source: ${it.source}` : '',
    ]);
  }

  // Pairing-only: the anchor is the item to shop around, harmonies are notes.
  if (options.pairing?.anchor) {
    const a = options.pairing.anchor;
    rows.push([
      titleCase(a.type || a.name || 'anchor'),
      'outfit',
      a.colourName || a.name || '',
      a.colourHex || '',
      a.pattern || '',
      'Anchor piece (already owned / starting point)',
    ]);
  }

  const results = Array.isArray(fragrance?.results) ? fragrance.results : [];
  for (const r of results) {
    const full = findPerfume(options.data, r.id);
    const notes = full ? allNotes(full).slice(0, 6).join(', ') : '';
    const detail = [
      full?.brand ? `Brand: ${full.brand}` : '',
      typeof r.score === 'number' ? `Match: ${r.score}/100` : '',
      full?.price_band ? `Price band: ${full.price_band}` : '',
      notes ? `Notes: ${notes}` : '',
      full?.verified === false ? 'Dataset entry unverified — verify notes before demo' : '',
    ]
      .filter(Boolean)
      .join('; ');
    rows.push([r.name || r.id || 'fragrance', 'fragrance', '', '', '', detail]);
  }

  return `\uFEFF${rows.map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}

/**
 * Builds the Markdown outfit plan.
 * Signature follows design.md §5.5: (look, fragrance, reasons, assumptions).
 * The optional 5th argument carries pairing / slots / caveats / relaxed
 * info from the orchestrator's structured result.
 *
 * @param {object|null} look
 * @param {object|null} fragrance
 * @param {string[]} [reasons]
 * @param {string[]} [assumptions]
 * @param {object} [extra]
 * @param {object} [extra.data] Full datasets, for fragrance notes/price.
 * @param {object} [extra.pairing] Pairing result (pairing_only intent).
 * @param {object} [extra.slots] Request slots (occasion, season, budget…).
 * @param {string[]} [extra.caveats] Data caveats from the fragrance specialist.
 * @param {string[]} [extra.relaxed] Criteria relaxed to find a match.
 * @param {string} [extra.checkerNote] One-line checker verdict to record.
 * @returns {string} Markdown document.
 */
export function buildOutfitPlanMd(look, fragrance, reasons = [], assumptions = [], extra = {}) {
  const lines = [];
  const slots = extra.slots || {};
  const occasion = slots.occasion ? titleCase(String(slots.occasion).replace(/_/g, ' ')) : 'Your occasion';

  lines.push('# StyleScent outfit plan');
  lines.push('');
  lines.push(`**Occasion:** ${occasion}`);
  if (slots.season) lines.push(`**Season:** ${titleCase(slots.season)}`);
  if (slots.timeOfDay) lines.push(`**Time of day:** ${titleCase(slots.timeOfDay)}`);
  if (slots.budget) lines.push(`**Budget:** ${titleCase(slots.budget)}`);
  if (Array.isArray(slots.avoidNotes) && slots.avoidNotes.length > 0) {
    lines.push(`**Avoided notes:** ${slots.avoidNotes.join(', ')}`);
  }
  lines.push('');

  // Look / pairing
  const items = Array.isArray(look?.items) ? look.items : [];
  if (items.length > 0) {
    lines.push('## Your look');
    lines.push('');
    if (typeof look.score === 'number') lines.push(`Outfit harmony score: **${look.score}/100**`);
    lines.push('');
    lines.push('| Item | Colour | Pattern | Source |');
    lines.push('|---|---|---|---|');
    for (const it of items) {
      lines.push(`| ${titleCase(it.type || '')} | ${it.colourName || ''} (\`${it.colourHex || ''}\`) | ${titleCase(it.pattern || '')} | ${titleCase(it.source || '')} |`);
    }
    lines.push('');
    if (look.patternNote) lines.push(`*Pattern note: ${look.patternNote}*`);
    if (look.patternNote) lines.push('');
  } else if (extra.pairing?.anchor) {
    const p = extra.pairing;
    lines.push('## Pairing ideas');
    lines.push('');
    lines.push(`**Anchor:** ${p.anchor.name || ''} ${p.anchor.type || ''} (${p.anchor.pattern || ''})`);
    lines.push('');
    if (p.complementary?.length) lines.push(`- **Complementary:** ${p.complementary.map((c) => `${c.name} (\`${c.hex}\`)`).join(', ')}`);
    if (p.analogous?.length) lines.push(`- **Analogous:** ${p.analogous.map((c) => `${c.name} (\`${c.hex}\`)`).join(', ')}`);
    if (p.neutralPair?.length) lines.push(`- **Neutral pairs:** ${p.neutralPair.map((c) => `${c.name} (\`${c.hex}\`)`).join(', ')}`);
    if (p.companionPatterns?.length) lines.push(`- **Companion patterns:** ${p.companionPatterns.join(', ')}`);
    if (p.notes?.length) lines.push('', `*${p.notes.join('; ')}*`);
    lines.push('');
  }

  // Why it works
  const why = Array.isArray(reasons) ? reasons : [];
  if (why.length > 0) {
    lines.push('## Why it works');
    lines.push('');
    for (const r of why.slice(0, 5)) lines.push(`- ${r}`);
    lines.push('');
  }

  // Fragrance
  const results = Array.isArray(fragrance?.results) ? fragrance.results : [];
  lines.push('## Fragrance pick');
  lines.push('');
  if (results.length === 0) {
    lines.push('No close fragrance match was found in the curated dataset for the exact criteria. Broaden the budget tier or relax a note constraint and ask again.');
    lines.push('');
  } else {
    for (const r of results) {
      const full = findPerfume(extra.data, r.id);
      lines.push(`### ${r.name} by ${r.brand} (id: \`${r.id}\`) — ${r.score}/100`);
      lines.push('');
      if (full) {
        const n = full.notes || {};
        lines.push(`- **Notes:** Top: ${(n.top || []).join(', ') || '—'} | Heart: ${(n.heart || []).join(', ') || '—'} | Base: ${(n.base || []).join(', ') || '—'}`);
        lines.push(`- **Performance:** Projection: ${full.projection || 'unknown'} | Longevity: ${full.longevity_hours || full.longevity || 'unknown'} | Price band: ${full.price_band || 'unknown'}`);
        if (full.verified === false) lines.push('- **Data note:** this dataset entry is unverified — verify its notes before using it in the live demo.');
      }
      if (Array.isArray(r.reasons) && r.reasons.length > 0) {
        lines.push(`- **Why it matches:** ${r.reasons.slice(0, 3).join('; ')}`);
      }
      lines.push('');
    }
  }
  if (Array.isArray(extra.relaxed) && extra.relaxed.length > 0) {
    lines.push(`*Relaxed criteria to find a match: ${extra.relaxed.join(', ')}.*`);
    lines.push('');
  }

  // Assumptions
  if (Array.isArray(assumptions) && assumptions.length > 0) {
    lines.push('## Assumptions');
    lines.push('');
    for (const a of assumptions) lines.push(`- ${a}`);
    lines.push('');
  }

  // Caveats + checker
  if (Array.isArray(extra.caveats) && extra.caveats.length > 0) {
    lines.push(`*Data notes: ${extra.caveats.join('; ')}.*`);
    lines.push('');
  }
  if (extra.checkerNote) {
    lines.push(`*Checker: ${extra.checkerNote}*`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('*Generated by StyleScent from its curated dataset. Fragrance notes are team-curated sample data, not laboratory measurements.*');

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/**
 * Builds both file attachments for a finished orchestrator result.
 * Returns [] when there is nothing to file (clarification / refusal /
 * greeting paths) — the orchestrator only calls this on success paths.
 *
 * @param {object} structured Orchestrator structured result
 *   ({ look, pairing, fragrance, slots, assumptions, caveats, data }).
 * @param {object} [options]
 * @param {string} [options.checkerNote] One-line checker verdict.
 * @returns {Array<{ name: string, mime: string, buffer: Buffer }>}
 */
export function buildOutputs(structured, options = {}) {
  if (!structured) return [];
  const { look = null, pairing = null, fragrance = null, slots = {}, assumptions = [], caveats = [] } = structured;
  const hasLook = Array.isArray(look?.items) && look.items.length > 0;
  const hasPairing = Boolean(pairing?.anchor);
  const hasFragrance = Array.isArray(fragrance?.results) && fragrance.results.length > 0;
  if (!hasLook && !hasPairing && !hasFragrance) return [];

  const reasons = Array.isArray(look?.reasons) ? look.reasons : [];
  const csv = buildShoppingListCsv(look, fragrance, { data: structured.data, pairing });
  const md = buildOutfitPlanMd(look, fragrance, reasons, assumptions, {
    data: structured.data,
    pairing,
    slots,
    caveats,
    relaxed: structured.fragrance?.relaxed || [],
    checkerNote: options.checkerNote,
  });

  return [
    { name: 'stylescent-shopping-list.csv', mime: 'text/csv', buffer: Buffer.from(csv, 'utf8') },
    { name: 'stylescent-outfit-plan.md', mime: 'text/markdown', buffer: Buffer.from(md, 'utf8') },
  ];
}
