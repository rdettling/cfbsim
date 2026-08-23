import { describe, expect, it } from 'vitest';
import { evaluatePerformanceIndexAudit } from './evaluation';

describe('Performance Index audit', () => {
  it('accepts useful opponent adjustment and exact replay', () => {
    const result = evaluatePerformanceIndexAudit({
      games: 100,
      adjustedCorrect: 70,
      rawCorrect: 68,
      secondHalfGames: 50,
      secondHalfAdjustedCorrect: 35,
      secondHalfRawCorrect: 34,
      finiteScores: true,
    }, true);

    expect(result.passed).toBe(true);
    expect(result.secondHalfAdjustedWinnerAccuracy).toBe(0.7);
  });

  it('rejects material regression, invalid scores, and replay drift', () => {
    const result = evaluatePerformanceIndexAudit({
      games: 100,
      adjustedCorrect: 60,
      rawCorrect: 70,
      secondHalfGames: 50,
      secondHalfAdjustedCorrect: 25,
      secondHalfRawCorrect: 35,
      finiteScores: false,
    }, false);

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(3);
  });
});
