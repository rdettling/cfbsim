import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllGames, getGameDetailsByYear } from '../../../../db/simRepo';
import { buildTestLeague, buildTestTeam } from '../../../../test/fixtures';
import {
  getEvidenceScore,
  getResumeScore,
  getTeamScore,
} from '../../../sim/rankingScores';
import { loadLeagueOrThrow } from '../../leagueStore';
import { loadAdvancedStats } from './advancedStats';

vi.mock('../../../../db/simRepo');
vi.mock('../../leagueStore');

describe('loadAdvancedStats', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const teams = [
      buildTestTeam({ rating: 90, gamesPlayed: 0, poll_score: getTeamScore(90) }),
      buildTestTeam({
        id: 2,
        name: 'Alpha Tech',
        ranking: 2,
        rating: 70,
        gamesPlayed: 0,
        poll_score: getTeamScore(70),
      }),
    ];
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildTestLeague('season', { teams }));
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(getGameDetailsByYear).mockResolvedValue([]);
  });

  it('projects the current season from authoritative games and details', async () => {
    const result = await loadAdvancedStats();

    expect(getAllGames).toHaveBeenCalledOnce();
    expect(getGameDetailsByYear).toHaveBeenCalledWith(2025);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      teamId: 1,
      teamName: 'Test State',
      pollRank: 1,
      pollScore: getTeamScore(90),
      projectedPollScore: getTeamScore(90),
      pollScoreMatchesProjection: true,
      teamRatingPriorWeight: 1,
      teamScore: getTeamScore(90),
      teamScoreContribution: getTeamScore(90),
      evidenceScoreContribution: 0,
      performanceIndex: 50,
    });
    expect(result.rows[0].evidenceScore).toBeCloseTo(getEvidenceScore({
      resumeScore: getResumeScore(buildTestTeam({ gamesPlayed: 0 })),
      performanceIndex: 50,
    }));
    expect(result.info.currentYear).toBe(2025);
  });

  it.each([
    {
      stage: 'season' as const,
      seeds: [] as number[],
      expected: null,
    },
    {
      stage: 'season' as const,
      seeds: [1, 2],
      expected: 'playoff_selection',
    },
    {
      stage: 'summary' as const,
      seeds: [1, 2],
      expected: 'championship_placement',
    },
  ])('uses explicit $stage override context with seeds $seeds', async ({
    stage,
    seeds,
    expected,
  }) => {
    const teams = [
      buildTestTeam({
        ranking: 2,
        rating: 90,
        gamesPlayed: 0,
        poll_score: getTeamScore(90),
      }),
      buildTestTeam({
        id: 2,
        name: 'Alpha Tech',
        ranking: 1,
        rating: 70,
        gamesPlayed: 0,
        poll_score: getTeamScore(70),
      }),
    ];
    const league = buildTestLeague(stage, { teams, playoff: { seeds } });
    league.settings.playoffTeams = 2;
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadAdvancedStats();

    expect(result.rows.map(row => row.pollRankOverrideReason)).toEqual([
      expected,
      expected,
    ]);
  });
});
