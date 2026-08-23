import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../../test/fixtures';
import {
  getEvidenceScore,
  getResumeScore,
  getTeamScore,
} from '../../../sim/rankingScores';
import { buildAdvancedTeamStats } from './advancedStats';
describe('advanced statistics poll projection', () => {
  it('uses neutral performance before games and orders ties by team ID', () => {
    const rows = buildAdvancedTeamStats(
      [
        buildTestTeam({ rating: 90, gamesPlayed: 0, record: '0-0 (0-0)' }),
        buildTestTeam({
          id: 2,
          name: 'Alpha Tech',
          rating: 80,
          gamesPlayed: 0,
          record: '0-0 (0-0)',
        }),
        buildTestTeam({
          id: 3,
          name: 'Beta State',
          rating: 70,
          gamesPlayed: 0,
          record: '0-0 (0-0)',
        }),
      ],
      [],
      [],
    );

    expect(rows.map(row => row.teamId)).toEqual([1, 2, 3]);
    expect(rows.every(row => row.performanceIndex === 50)).toBe(true);
    const expectedEvidence = getEvidenceScore({
      resumeScore: getResumeScore(buildTestTeam({ gamesPlayed: 0 })),
      performanceIndex: 50,
    });
    rows.forEach(row => expect(row.evidenceScore).toBeCloseTo(expectedEvidence));
    expect(rows.map(row => row.teamRating)).toEqual([90, 80, 70]);
    expect(rows.every(row => row.offense.successRate === 0)).toBe(true);
  });

  it('labels score-order differences only in an explicit postseason context', () => {
    const teams = [
      buildTestTeam({
        rating: 90,
        gamesPlayed: 0,
        record: '0-0 (0-0)',
        ranking: 2,
        poll_score: getTeamScore(90),
      }),
      buildTestTeam({
        id: 2,
        name: 'Alpha Tech',
        rating: 80,
        gamesPlayed: 0,
        record: '0-0 (0-0)',
        ranking: 1,
        poll_score: getTeamScore(80),
      }),
    ];
    const regularRows = buildAdvancedTeamStats(teams, [], []);
    const rows = buildAdvancedTeamStats(
      teams,
      [],
      [],
      'playoff_selection',
    );

    const stronger = rows.find(row => row.teamId === 1)!;
    expect(stronger).toMatchObject({
      pollRank: 2,
      teamRatingPriorWeight: 1,
      evidenceScoreContribution: 0,
      pollScoreMatchesProjection: true,
      pollRankOverrideReason: 'playoff_selection',
    });
    expect(stronger.pollScore).toBeCloseTo(getTeamScore(90));
    expect(stronger.projectedPollScore).toBeCloseTo(getTeamScore(90));
    expect(regularRows.every(row => row.pollRankOverrideReason === null)).toBe(true);
    expect(rows.every(row =>
      row.pollRankOverrideReason === 'playoff_selection')).toBe(true);
  });

  it('keeps a stale published Poll Score separate from the current projection', () => {
    const [row] = buildAdvancedTeamStats(
      [buildTestTeam({
        rating: 90,
        gamesPlayed: 0,
        record: '0-0 (0-0)',
        poll_score: 75,
      })],
      [],
      [],
    );

    expect(row.pollScore).toBe(75);
    expect(row.projectedPollScore).toBeCloseTo(getTeamScore(90));
    expect(row.pollScoreMatchesProjection).toBe(false);
  });
});
