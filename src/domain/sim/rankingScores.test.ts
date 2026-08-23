import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import {
  RANKING_RECORD_WEIGHT,
  RANKING_WINS_OVER_EXPECTATION_WEIGHT,
  comparePollOrder,
  getEvidenceScore,
  getResumeScore,
  getTeamScore,
  getTeamRatingPriorWeight,
  getWeeklyPollScore,
  getWeeklyPollScoreBreakdown,
} from './rankingScores';

describe('ranking score components', () => {
  it('orders Poll Score ties by résumé, performance, and team ID', () => {
    const entries = [
      { teamId: 4, pollScore: 80, resumeScore: 70, performanceIndex: 60 },
      { teamId: 3, pollScore: 80, resumeScore: 75, performanceIndex: 50 },
      { teamId: 2, pollScore: 80, resumeScore: 75, performanceIndex: 55 },
      { teamId: 1, pollScore: 80, resumeScore: 75, performanceIndex: 55 },
    ];

    expect(entries.sort(comparePollOrder).map(entry => entry.teamId))
      .toEqual([1, 2, 3, 4]);
  });

  it('weights record 70% and schedule-adjusted wins 30% in the résumé', () => {
    expect(RANKING_RECORD_WEIGHT).toBe(0.7);
    expect(RANKING_WINS_OVER_EXPECTATION_WEIGHT).toBe(0.3);
  });

  it('uses the exact résumé and performance weights', () => {
    expect(getEvidenceScore({
      resumeScore: 100,
      performanceIndex: 0,
    })).toBeCloseTo(100 * 13 / 18);
    expect(getEvidenceScore({
      resumeScore: 0,
      performanceIndex: 100,
    })).toBeCloseTo(100 * 5 / 18);
  });

  it.each([
    [0, 1],
    [1, 0.9],
    [2, 0.8],
    [3, 0.7],
    [4, 0.6],
    [5, 0.45],
    [6, 0.3],
    [7, 0.15],
    [8, 0],
    [12, 0],
  ])('uses a %i-game Team Rating prior of %f', (games, expected) => {
    expect(getTeamRatingPriorWeight(games)).toBe(expected);
  });

  it('blends Team Score into Poll Score only while the prior remains', () => {
    expect(getWeeklyPollScore({
      evidenceScore: 40,
      teamScore: 80,
      gamesPlayed: 1,
    })).toBe(76);
    expect(getWeeklyPollScore({
      evidenceScore: 40,
      teamScore: 80,
      gamesPlayed: 8,
    })).toBe(40);
  });

  it('returns the exact shared Poll Score contribution breakdown', () => {
    const breakdown = getWeeklyPollScoreBreakdown({
      evidenceScore: 40,
      teamScore: 80,
      gamesPlayed: 2,
    });
    expect(breakdown).toMatchObject({
      priorWeight: 0.8,
      teamScoreContribution: 64,
      pollScore: 72,
    });
    expect(breakdown.evidenceWeight).toBeCloseTo(0.2);
    expect(breakdown.evidenceScoreContribution).toBeCloseTo(8);
  });

  it('maps Team Rating and résumé inputs to their fixed score scales', () => {
    expect(getTeamScore(25)).toBe(0);
    expect(getTeamScore(99)).toBe(100);
    expect(getResumeScore(buildTestTeam({
      totalWins: 1,
      totalLosses: 0,
      gamesPlayed: 1,
      wins_over_expectation_per_game: 0.5,
    }))).toBeCloseTo(88.461538);
  });
});
