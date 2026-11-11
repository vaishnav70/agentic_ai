/**
 * Deterministic Pattern Pairing Tool for StyleScent.
 *
 * What: Evaluates pattern harmony, companion suggestions, and scale advice based on curated rules.
 * Why: Provides deterministic, order-insensitive pattern clash checking and recommendations
 * without reliance on LLM generation.
 */

/**
 * Validates that pattern name exists in the allowed patterns list.
 *
 * @param {string} pattern
 * @param {object} patternsData
 */
function assertValidPattern(pattern, patternsData) {
  if (!patternsData || !Array.isArray(patternsData.patterns)) {
    throw new Error('Invalid patterns dataset provided.');
  }
  if (!patternsData.patterns.includes(pattern)) {
    throw new Error(
      `Unknown pattern: "${pattern}". Valid patterns: ${patternsData.patterns.join(', ')}`
    );
  }
}

/**
 * Checks the compatibility between two patterns (order-insensitive).
 *
 * @param {string} a
 * @param {string} b
 * @param {object} patternsData
 * @returns {{ verdict: 'good'|'ok'|'avoid', reason: string }}
 */
export function checkPatternPairing(a, b, patternsData) {
  assertValidPattern(a, patternsData);
  assertValidPattern(b, patternsData);

  const rule = patternsData.pairing_rules.find(
    (r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)
  );

  if (rule) {
    return {
      verdict: rule.verdict,
      reason: rule.reason,
    };
  }

  return {
    verdict: 'ok',
    reason: 'no specific rule',
  };
}

/**
 * Returns an alphabetical list of companion patterns whose pairing verdict is "good".
 *
 * @param {string} pattern
 * @param {object} patternsData
 * @returns {string[]}
 */
export function suggestCompanions(pattern, patternsData) {
  assertValidPattern(pattern, patternsData);

  const companions = patternsData.patterns.filter((p) => {
    const check = checkPatternPairing(pattern, p, patternsData);
    return check.verdict === 'good';
  });

  return companions.sort((a, b) => a.localeCompare(b));
}

/**
 * Returns general scale and print mixing advice.
 *
 * @param {object} patternsData
 * @returns {string}
 */
export function scaleAdvice(patternsData) {
  if (!patternsData || typeof patternsData.scale_rule !== 'string') {
    throw new Error('Invalid patterns dataset: missing scale_rule.');
  }
  return patternsData.scale_rule;
}
