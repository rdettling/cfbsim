import { describe, expect, it } from 'vitest';
import {
  AWARD_SCORING_CONFIG,
  AWARD_SCORING_POLICY,
  AWARD_TUNING_CONTROLS,
  validateAwardScoringConfig,
} from './awardScoringConfig';

describe('award scoring configuration', () => {
  it('validates the shipped weights, bounds, and weight sums', () => {
    expect(validateAwardScoringConfig(AWARD_SCORING_CONFIG)).toEqual([]);
    expect(Object.values(AWARD_SCORING_CONFIG.metricWeights).every(weights =>
      Math.abs(Object.values(weights).reduce((sum, weight) => sum + (weight ?? 0), 0) - 1) < 1e-9,
    )).toBe(true);

    const invalid = structuredClone(AWARD_SCORING_CONFIG);
    invalid.metricWeights.quarterback.totalOffenseYardsPerGame = 0.9;
    invalid.eligibility.receiverCatchesPerGame = 20;
    invalid.nagurskiDefensiveImpactShare = 0.8;
    invalid.heismanOffensiveImpactShare = 0.8;
    invalid.teamRankShares.standard = 0.15;
    invalid.teamRankShares.heisman = 0.15;
    expect(validateAwardScoringConfig(invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('metricWeights.quarterback must sum to 1'),
      expect.stringContaining('eligibility.receiverCatchesPerGame must be between'),
      expect.stringContaining('nagurskiDefensiveImpactShare must be between 0.2 and 0.4'),
      expect.stringContaining('heismanOffensiveImpactShare must be between 0.3 and 0.7'),
      expect.stringContaining('teamRankShares.heisman must be at least 0.05 greater'),
    ]));
  });

  it('keeps product rules locked and outside the editable control registry', () => {
    expect(AWARD_SCORING_POLICY).toEqual(expect.objectContaining({
      eligibleGameTypes: ['regular_season', 'conference_championship'],
      ratingPriorByGames: [0, 0.20, 0.16, 0.12, 0.08, 0.04, 0],
      multipleAwardWinnersAllowed: true,
    }));
    expect(AWARD_SCORING_CONFIG).toEqual(expect.objectContaining({
      version: 4,
      heismanOffensiveImpactShare: 0.50,
      teamRankShares: { standard: 0.10, heisman: 0.15 },
      nagurskiDefensiveImpactShare: 0.30,
    }));
    const paths = AWARD_TUNING_CONTROLS.map(control => control.path);
    expect(paths).toEqual(expect.arrayContaining([
      'teamRankShares.standard',
      'teamRankShares.heisman',
      'heismanOffensiveImpactShare',
    ]));
    expect(AWARD_TUNING_CONTROLS.find(control => control.path === 'teamRankShares.standard'))
      .toEqual(expect.objectContaining({ minimum: 0.025, maximum: 0.15, maximumDelta: 0.025 }));
    expect(AWARD_TUNING_CONTROLS.find(control => control.path === 'teamRankShares.heisman'))
      .toEqual(expect.objectContaining({ minimum: 0.10, maximum: 0.25, maximumDelta: 0.025 }));
    expect(AWARD_TUNING_CONTROLS.find(control => control.path === 'heismanOffensiveImpactShare'))
      .toEqual(expect.objectContaining({ minimum: 0.30, maximum: 0.70, maximumDelta: 0.05 }));
    expect(paths.some(path => path.startsWith('heismanCohortFactors.'))).toBe(false);
    expect(paths.some(path => path.includes('ratingPrior')
      || path.includes('eligibleGameTypes') || path.includes('multipleAward'))).toBe(false);
  });

});
