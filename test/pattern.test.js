/**
 * Unit Tests for Pattern Tool.
 *
 * What: Validates order-insensitive pattern pairing lookup, fallback rules,
 * companion pattern recommendations, and scale advice retrieval.
 * Why: Ensures pattern rules are deterministic and handle commutative pairings properly.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPatternPairing,
  suggestCompanions,
  scaleAdvice,
} from '../src/tools/pattern.js';

describe('Pattern Tool', () => {
  const patternsFixture = {
    patterns: ['solid', 'stripes', 'checks', 'floral', 'polka'],
    pairing_rules: [
      {
        a: 'solid',
        b: 'stripes',
        verdict: 'good',
        reason: 'Solids anchor stripes.',
      },
      {
        a: 'solid',
        b: 'checks',
        verdict: 'good',
        reason: 'Solids anchor checks.',
      },
      {
        a: 'stripes',
        b: 'checks',
        verdict: 'avoid',
        reason: 'Directional clash.',
      },
    ],
    scale_rule: 'Mix different print scales and share one common colour.',
  };

  test('pairing lookup is order-insensitive', () => {
    const forward = checkPatternPairing('solid', 'stripes', patternsFixture);
    const reverse = checkPatternPairing('stripes', 'solid', patternsFixture);

    assert.equal(forward.verdict, 'good');
    assert.equal(reverse.verdict, 'good');
    assert.equal(forward.reason, reverse.reason);
  });

  test('returns fallback verdict when no explicit rule exists', () => {
    const result = checkPatternPairing('floral', 'polka', patternsFixture);
    assert.equal(result.verdict, 'ok');
    assert.equal(result.reason, 'no specific rule');
  });

  test('suggestCompanions returns alphabetical patterns with "good" verdict', () => {
    const companions = suggestCompanions('solid', patternsFixture);
    assert.deepEqual(companions, ['checks', 'stripes']);
  });

  test('unknown pattern throws error', () => {
    assert.throws(
      () => checkPatternPairing('solid', 'camouflage', patternsFixture),
      /Unknown pattern: "camouflage"/
    );
    assert.throws(
      () => suggestCompanions('tie_dye', patternsFixture),
      /Unknown pattern: "tie_dye"/
    );
  });

  test('scaleAdvice returns scale_rule string', () => {
    const advice = scaleAdvice(patternsFixture);
    assert.equal(advice, 'Mix different print scales and share one common colour.');
  });
});
