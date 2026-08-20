import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import { getGameLogsByYear, getGamesByYear } from '../../../db/simRepo';
import {
  buildTestLeague,
  buildTestPlayer,
} from '../../../test/fixtures';
import type { GameLogRecord, GameRecord } from '../../../types/db';
import type { LeagueStage } from '../../../types/domain';
import { loadAwards } from './awards';

vi.mock('../../../db/leagueRepo');
vi.mock('../../../db/simRepo');

const game = (id: number, winnerId: number | null): GameRecord => ({
  id,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: 'Test Game',
  name: 'Test Game',
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 1,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === null ? null : 'W',
  resultB: winnerId === null ? null : 'L',
  overtime: 0,
  quarter: winnerId === null ? 1 : 4,
  clockSecondsLeft: winnerId === null ? 900 : 0,
  scoreA: winnerId === null ? null : 31,
  scoreB: winnerId === null ? null : 24,
  watchability: 80,
});

const log = (gameId: number, passYards: number): GameLogRecord => ({
  playerId: 1,
  gameId,
  pass_yards: passYards,
  pass_attempts: 30,
  pass_completions: 20,
  pass_touchdowns: 3,
  pass_interceptions: 1,
  rush_yards: 25,
  rush_attempts: 5,
  rush_touchdowns: 1,
  receiving_yards: 0,
  receiving_catches: 0,
  receiving_touchdowns: 0,
  fumbles: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  fumbles_forced: 0,
  fumbles_recovered: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  extra_points_made: 0,
  extra_points_attempted: 0,
});

const mockLeague = (stage: LeagueStage) => {
  vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
    league: buildTestLeague(stage),
    players: [buildTestPlayer()],
  });
};

describe('loadAwards', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getGamesByYear).mockResolvedValue([game(1, 1), game(2, null)]);
    vi.mocked(getGameLogsByYear).mockResolvedValue([log(1, 300), log(2, 900)]);
  });

  it.each([
    ['season', 'live'],
    ['summary', 'final'],
  ] as const)('returns normalized %s awards', async (stage, expectedMode) => {
    mockLeague(stage);

    const result = await loadAwards();

    expect(result.mode).toBe(expectedMode);
    expect(result.awards.map(award => award.categorySlug)).toEqual([
      'heisman',
      'maxwell',
      'davey_obrien',
      'doak_walker',
      'biletnikoff',
      'mackey',
      'bednarik',
      'nagurski',
      'ted_hendricks',
      'butkus',
      'thorpe',
      'lou_groza',
    ]);
    expect(result.awards[0].placements[0].statLine).toBe(
      '20/30, 300 pass yds, 3 pass TD, 1 INT · 5 carries, 25 rush yds, 1 rush TD',
    );
    expect(getGamesByYear).toHaveBeenCalledWith(2025);
    expect(getGameLogsByYear).toHaveBeenCalledWith(2025);
  });

  it.each(['preseason', 'realignment'] as const)(
    'skips award queries during %s',
    async stage => {
      mockLeague(stage);

      await expect(loadAwards()).resolves.toMatchObject({ mode: null, awards: [] });
      expect(getGamesByYear).not.toHaveBeenCalled();
      expect(getGameLogsByYear).not.toHaveBeenCalled();
    },
  );
});
