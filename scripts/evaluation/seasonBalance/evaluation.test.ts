import { describe, expect, it } from 'vitest';
import {
  buildSeasonBalanceDiagnosticGaps,
  buildSeasonBalanceGaps,
  calculateRecordProbabilities,
  calculateSeasonBalanceMetrics,
  seasonBalanceExitCode,
  seasonBalanceStatus,
  type SeasonBalanceMetrics,
  type SeasonBalanceSeasonArtifact,
} from './evaluation';

const artifact = (
  seed: number,
  overrides: Partial<SeasonBalanceSeasonArtifact> = {},
): SeasonBalanceSeasonArtifact => ({
  seed,
  year: 2026,
  teamCount: 138,
  regularGameCount: 828,
  minimumGamesPerTeam: 12,
  maximumGamesPerTeam: 12,
  undefeatedTeams: 1,
  oneLossOrBetterTeams: 5,
  top5AverageLosses: 1.2,
  top10AverageLosses: 1.7,
  top25AverageLosses: 2.5,
  oddsImplied: { undefeatedTeams: 0.8, oneLossOrBetterTeams: 4 },
  prestige7: {
    teamCount: 6,
    ratingMean: 90,
    ratingStandardDeviation: 2,
    lossesMean: 2,
    lossesStandardDeviation: 1,
    oneLossOrBetterTeams: 2,
    oneLossOrBetterShare: 0.333333,
  },
  numberOne: { teamId: 1, team: 'One', wins: 9, losses: 3 },
  topRatedTeam: {
    teamId: 2,
    team: 'Two',
    rating: 95,
    wins: 11,
    losses: 1,
    expectedLosses: 1.25,
  },
  marginHistogram: { '6': 1, '14': 2, '24': 1, '34': 1 },
  ...overrides,
});

describe('season-balance metrics', () => {
  it('calculates odds-implied undefeated and clean-record probabilities', () => {
    expect(calculateRecordProbabilities([0.5, 0.5])).toEqual({
      undefeated: 0.25,
      oneLossOrBetter: 0.75,
    });
  });

  it('calculates elite cohorts, no-undefeated share, and margins', () => {
    const metrics = calculateSeasonBalanceMetrics([
      artifact(1),
      artifact(2, {
        undefeatedTeams: 0,
        oneLossOrBetterTeams: 7,
        top5AverageLosses: 1.4,
        top10AverageLosses: 1.9,
        top25AverageLosses: 2.7,
        oddsImplied: { undefeatedTeams: 1.2, oneLossOrBetterTeams: 6 },
        prestige7: {
          teamCount: 6,
          ratingMean: 92,
          ratingStandardDeviation: 4,
          lossesMean: 3,
          lossesStandardDeviation: 2,
          oneLossOrBetterTeams: 3,
          oneLossOrBetterShare: 0.5,
        },
        numberOne: { teamId: 3, team: 'Three', wins: 12, losses: 0 },
        topRatedTeam: {
          teamId: 3,
          team: 'Three',
          rating: 94,
          wins: 10,
          losses: 2,
          expectedLosses: 1.5,
        },
      }),
    ]);
    expect(metrics).toMatchObject({
      meanUndefeatedTeams: 0.5,
      noUndefeatedSeasonShare: 0.5,
      meanOneLossOrBetterTeams: 6,
      top5AverageLosses: 1.3,
      top10AverageLosses: 1.8,
      top25AverageLosses: 2.6,
      meanOddsImpliedUndefeatedTeams: 1,
      meanOddsImpliedOneLossOrBetterTeams: 5,
      meanPrestige7Rating: 91,
      meanPrestige7RatingStandardDeviation: 3,
      meanPrestige7Losses: 2.5,
      meanPrestige7LossStandardDeviation: 1.5,
      meanPrestige7OneLossOrBetterTeams: 2.5,
      meanPrestige7OneLossOrBetterShare: 0.416667,
      meanNumberOneLosses: 1.5,
      meanTopRatedTeamLosses: 1.5,
      meanTopRatedExpectedLosses: 1.375,
      marginMean: 18.4,
      marginP50: 14,
    });
  });

  it('never treats the independent No. 1 record as a balance violation', () => {
    const metrics: SeasonBalanceMetrics = {
      meanUndefeatedTeams: 1.2,
      noUndefeatedSeasonShare: 0.25,
      meanOneLossOrBetterTeams: 5.5,
      top5AverageLosses: 1.3,
      top10AverageLosses: 1.75,
      top25AverageLosses: 2.55,
      meanOddsImpliedUndefeatedTeams: 1,
      meanOddsImpliedOneLossOrBetterTeams: 5.5,
      meanPrestige7Rating: 90,
      meanPrestige7RatingStandardDeviation: 2.5,
      meanPrestige7Losses: 2.4,
      meanPrestige7LossStandardDeviation: 1.4,
      meanPrestige7OneLossOrBetterTeams: 2,
      meanPrestige7OneLossOrBetterShare: 0.333333,
      meanNumberOneLosses: 3,
      meanTopRatedTeamLosses: 1.3,
      meanTopRatedExpectedLosses: 1.25,
      marginMean: 16.304,
      marginStandardDeviation: 12.802,
      marginP25: 6,
      marginP50: 14,
      marginP75: 24,
      marginP90: 34,
    };
    expect(buildSeasonBalanceGaps(metrics)).toEqual([]);
  });

  it('reports every ranked-cohort record inversion without creating a violation', () => {
    const metrics = calculateSeasonBalanceMetrics([
      artifact(1, {
        top5AverageLosses: 1.6,
        top10AverageLosses: 2.1,
        top25AverageLosses: 3,
      }),
    ]);
    expect(buildSeasonBalanceGaps(metrics).map(gap => gap.metric))
      .not.toContain('top5AverageLosses');
    expect(buildSeasonBalanceGaps(metrics).map(gap => gap.metric))
      .not.toContain('top10AverageLosses');
    expect(buildSeasonBalanceGaps(metrics).map(gap => gap.metric))
      .not.toContain('top25AverageLosses');
    expect(buildSeasonBalanceDiagnosticGaps(metrics).map(gap => gap.metric))
      .toEqual([
        'top5AverageLosses',
        'top10AverageLosses',
        'top25AverageLosses',
      ]);
  });
});

describe('season-balance status', () => {
  it('reserves balance exit code 2 for acceptance', () => {
    const gap = [{}];
    expect(seasonBalanceExitCode('smoke', [], [], gap)).toBe(0);
    expect(seasonBalanceExitCode('iterate', [], [], gap)).toBe(0);
    expect(seasonBalanceExitCode('acceptance', [], [], gap)).toBe(2);
    expect(seasonBalanceStatus('acceptance', 2, gap)).toBe('needs_tuning');
    expect(seasonBalanceStatus('acceptance', 0, [])).toBe('pass');
  });

  it('makes structural and replay failures invalid for every profile', () => {
    expect(seasonBalanceExitCode('smoke', ['bad'], [], [])).toBe(1);
    expect(seasonBalanceExitCode('acceptance', [], [{
      seed: 1,
      expected: 'a',
      actual: 'b',
      matches: false,
    }], [])).toBe(1);
    expect(seasonBalanceStatus('smoke', 1, [])).toBe('invalid');
  });
});
