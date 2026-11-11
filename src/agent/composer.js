/**
 * Response Composer for StyleScent AI.
 *
 * What: Deterministically assembles the final Markdown response. Employs the LLM for
 * concise styling prose (why_it_works, fragrance_why, tip) while enforcing strict guardrails
 * against hallucinated fragrance names and formatting errors.
 * Why: Guarantees consistent, predictable Markdown structure with verified tables, scores,
 * and note details. If LLM fails or hallucinates unrecommended fragrances, automatically
 * degrades to pure deterministic fallback copy without crashing or going silent.
 */

import { COMPOSE_SYSTEM } from './prompts.js';
import { MESSAGES } from './messages.js';

/**
 * Builds deterministic fallback sentences when LLM output is unavailable or discarded.
 *
 * @param {Object} structured
 * @returns {{ why_it_works: string, fragrance_why: string, tip: string }}
 */
function getFallbackProse(structured) {
  const look = structured.look;
  const topReason = look?.reasons?.[0] || 'Harmonised colour palette with balanced neutrality and tone.';
  const topFragrance = structured.fragrance?.results?.[0];

  let fragranceWhy = 'Selected for occasion alignment, seasonal notes, and balanced performance.';
  if (topFragrance?.reasons?.[0]) {
    fragranceWhy = topFragrance.reasons[0];
  }

  return {
    why_it_works: `This ensemble balances visual contrast and colour harmony. ${topReason}`,
    fragrance_why: fragranceWhy,
    tip: 'Ensure garments fit comfortably and apply fragrance to pulse points for lasting projection.',
  };
}

/**
 * Checks whether LLM prose mentions any fragrance name in the database that is not among the shown results.
 *
 * @param {string} text Combined LLM prose
 * @param {Array<any>} shownResults Shown fragrance results
 * @param {Array<any>} allPerfumes All perfumes in database
 * @returns {boolean} True if a forbidden fragrance name was hallucinated/mentioned
 */
function mentionsUnshownFragrance(text, shownResults, allPerfumes) {
  if (!text || !allPerfumes || allPerfumes.length === 0) return false;

  const lowerText = text.toLowerCase();
  const shownIds = new Set((shownResults || []).map((p) => p.id));
  const forbiddenPerfumes = allPerfumes.filter((p) => !shownIds.has(p.id));

  for (const p of forbiddenPerfumes) {
    if (!p.name) continue;
    const nameLower = p.name.toLowerCase();
    // Only match names longer than 3 characters to avoid trivial substring false positives
    if (nameLower.length >= 4 && lowerText.includes(nameLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Renders the deterministic Markdown response from structured components and prose.
 *
 * @param {Object} structured
 * @param {{ why_it_works?: string, fragrance_why?: string, tip?: string }} prose
 * @returns {string} Markdown response
 */
function assembleMarkdown(structured, prose) {
  const { intent, look, pairing, fragrance, assumptions, caveats } = structured;
  const sections = [];

  // 1. LOOK OR PAIRING SECTION
  if (intent === 'pairing_only' && pairing) {
    let pairingMd = `## Pairing ideas\n\n`;
    pairingMd += `**Anchor:** ${pairing.anchor.name} ${pairing.anchor.type} (${pairing.anchor.pattern})\n\n`;
    pairingMd += `### Colour Harmonies\n`;
    if (pairing.complementary?.length > 0) {
      pairingMd += `- **Complementary:** ${pairing.complementary.map((c) => `${c.name} (\`${c.hex}\`)`).join(', ')}\n`;
    }
    if (pairing.analogous?.length > 0) {
      pairingMd += `- **Analogous:** ${pairing.analogous.map((c) => `${c.name} (\`${c.hex}\`)`).join(', ')}\n`;
    }
    if (pairing.neutralPair?.length > 0) {
      pairingMd += `- **Neutral Pairs:** ${pairing.neutralPair.map((c) => `${c.name} (\`${c.hex}\`)`).join(', ')}\n`;
    }
    if (pairing.companionPatterns?.length > 0) {
      pairingMd += `- **Companion Patterns:** ${pairing.companionPatterns.join(', ')}\n`;
    }
    if (pairing.notes?.length > 0) {
      pairingMd += `\n*${pairing.notes.join('; ')}*\n`;
    }
    sections.push(pairingMd.trim());
  } else if (look) {
    let lookMd = `## Your look\n\n`;
    lookMd += `Outfit harmony score: **${look.score}/100**\n\n`;
    lookMd += `| Item | Colour | Pattern | Source |\n`;
    lookMd += `|---|---|---|---|\n`;
    for (const item of look.items) {
      const typeCap = item.type.charAt(0).toUpperCase() + item.type.slice(1);
      const patCap = item.pattern.charAt(0).toUpperCase() + item.pattern.slice(1);
      const srcCap = item.source.charAt(0).toUpperCase() + item.source.slice(1);
      lookMd += `| ${typeCap} | ${item.colourName} (\`${item.colourHex}\`) | ${patCap} | ${srcCap} |\n`;
    }
    if (look.patternNote) {
      lookMd += `\n*Pattern Note: ${look.patternNote}*\n`;
    }
    sections.push(lookMd.trim());
  }

  // 2. WHY IT WORKS
  if (prose.why_it_works || (look?.reasons && look.reasons.length > 0)) {
    let whyMd = `## Why it works\n`;
    if (prose.why_it_works) {
      whyMd += `${prose.why_it_works}\n\n`;
    }
    if (look?.reasons && look.reasons.length > 0) {
      const topReasons = look.reasons.slice(0, 3);
      for (const r of topReasons) {
        whyMd += `- ${r}\n`;
      }
    }
    sections.push(whyMd.trim());
  }

  // 3. FRAGRANCE PICK
  if (intent !== 'pairing_only' && fragrance) {
    let fragMd = `## Fragrance pick\n`;
    const results = fragrance.results || [];

    if (results.length > 0) {
      const top = results[0];
      fragMd += `**${top.name}** by ${top.brand} (id: \`${top.id}\`) — Match score: **${top.score}/100**\n`;

      const topNotes = top.top_notes?.join(', ') || 'None listed';
      const heartNotes = top.heart_notes?.join(', ') || 'None listed';
      const baseNotes = top.base_notes?.join(', ') || 'None listed';
      fragMd += `- **Notes:** Top: ${topNotes} | Heart: ${heartNotes} | Base: ${baseNotes}\n`;

      const proj = top.projection ? top.projection : 'moderate';
      const longHrs = top.longevity_hours ? `~${top.longevity_hours} hrs` : 'medium';
      fragMd += `- **Performance:** Projection: ${proj} | Longevity: ${longHrs}\n\n`;

      if (prose.fragrance_why) {
        fragMd += `${prose.fragrance_why}\n\n`;
      }

      if (results.length > 1) {
        fragMd += `**Alternatives:**\n`;
        const alts = results.slice(1, 3);
        for (const alt of alts) {
          const altNotes = alt.top_notes?.slice(0, 3).join(', ') || 'Fresh notes';
          fragMd += `- **${alt.name}** by ${alt.brand} (id: \`${alt.id}\`) — Match: ${alt.score}/100, Notes: ${altNotes}\n`;
        }
      }

      if (fragrance.relaxed && fragrance.relaxed.length > 0) {
        fragMd += `\n*Note: Relaxed criteria to find matching perfumes: ${fragrance.relaxed.join(', ')}.*\n`;
      }
    } else {
      fragMd += `${MESSAGES.notices.noCloseMatch}\n`;
      if (fragrance.relaxed && fragrance.relaxed.length > 0) {
        fragMd += `\n*Relaxed constraints evaluated: ${fragrance.relaxed.join(', ')}.*\n`;
      }
    }

    sections.push(fragMd.trim());
  }

  // 4. TIP
  if (prose.tip) {
    sections.push(`💡 **Stylist Tip:** ${prose.tip}`);
  }

  // 5. ASSUMPTIONS
  if (Array.isArray(assumptions) && assumptions.length > 0) {
    let assMd = `## Assumptions\n`;
    for (const a of assumptions) {
      assMd += `- ${a}\n`;
    }
    sections.push(assMd.trim());
  }

  // 6. CAVEATS NOTE
  if (Array.isArray(caveats) && caveats.length > 0) {
    sections.push(`*Data notes: ${caveats.join('; ')}.*`);
  }

  return sections.join('\n\n');
}

/**
 * Deterministically renders a fallback reply directly from tool reasons.
 *
 * @param {Object} structured
 * @returns {string}
 */
export function renderFallbackReply(structured) {
  const fallbackProse = getFallbackProse(structured);
  return assembleMarkdown(structured, fallbackProse);
}

/**
 * Composes the complete Markdown reply using one structured JSON LLM call for prose snippets.
 *
 * @param {Object} structured
 * @param {Object|null} llm Provider client with generateJson
 * @returns {Promise<string>}
 */
export function composeReply(structured, llm) {
  if (!llm || typeof llm.generateJson !== 'function') {
    return Promise.resolve(renderFallbackReply(structured));
  }

  // Prepare minimal structured payload for the LLM turn
  const topFragrance = structured.fragrance?.results?.[0];
  const payload = {
    intent: structured.intent,
    occasion: structured.slots?.occasion,
    items: structured.look?.items?.map((it) => `${it.type}: ${it.colourName} (${it.pattern})`) || [],
    outfitScore: structured.look?.score,
    reasons: structured.look?.reasons?.slice(0, 3) || [],
    topFragrance: topFragrance
      ? {
          name: topFragrance.name,
          brand: topFragrance.brand,
          notes: topFragrance.top_notes?.concat(topFragrance.heart_notes || []),
          score: topFragrance.score,
        }
      : null,
  };

  const userTurn = `Write styling prose for these structured results:\n${JSON.stringify(payload, null, 2)}`;

  return llm
    .generateJson(userTurn, { system: COMPOSE_SYSTEM, temperature: 0.2 })
    .then((output) => {
      let prose = {
        why_it_works: typeof output?.why_it_works === 'string' ? output.why_it_works : '',
        fragrance_why: typeof output?.fragrance_why === 'string' ? output.fragrance_why : '',
        tip: typeof output?.tip === 'string' ? output.tip : '',
      };

      // Guard check against hallucinated fragrance names
      const combinedProse = `${prose.why_it_works} ${prose.fragrance_why} ${prose.tip}`;
      const shownResults = structured.fragrance?.results || [];
      const allPerfumes = structured.data?.perfumes || [];

      if (mentionsUnshownFragrance(combinedProse, shownResults, allPerfumes)) {
        prose = getFallbackProse(structured);
      }

      return assembleMarkdown(structured, prose);
    })
    .catch(() => {
      // Degrade gracefully on any LLM timeout or parsing error
      return renderFallbackReply(structured);
    });
}
