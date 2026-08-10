import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import {
  getAllGameLogs,
  getAllGames,
  getAllHistoricalPlayers,
  getAllPlays,
  getPlayerSeasonsByYearTeam,
} from '../../../../db/simRepo';
import type { GameLogRecord, GameRecord } from '../../../../types/db';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestPlayerSeason,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
  buildTestTeamAggregateTotals,
} from '../../../../test/fixtures';
import { loadTeamStats } from './loadTeamStats';

vi.mock('../../../../db/leagueRepo');
vi.mock('../../../../db/seasonMemoryRepo');
vi.mock('../../../../db/simRepo');

const game = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: 'Test Stadium',
  winnerId: 1,
  baseLabel: 'Week 1',
  name: null,
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
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  scoreA: 21,
  scoreB: 7,
  watchability: 50,
  ...overrides,
});

const log = (playerId: number, overrides: Partial<GameLogRecord> = {}): GameLogRecord => ({
  playerId,
  gameId: 1,
  pass_yards: 0,
  pass_attempts: 0,
  pass_completions: 0,
  pass_touchdowns: 0,
  pass_interceptions: 0,
  rush_yards: 0,
  rush_attempts: 0,
  rush_touchdowns: 0,
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
  ...overrides,
});

describe('loadTeamStats', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);
    vi.mocked(getAllHistoricalPlayers).mockResolvedValue([]);
    vi.mocked(getPlayerSeasonsByYearTeam).mockResolvedValue([]);
    const teams = [
      buildTestTeam({ gamesPlayed: 1 }),
      buildTestTeam({ id: 2, name: 'Alpha Tech', abbreviation: 'ALP', gamesPlayed: 1 }),
    ];
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('season', { teams }),
      players: [
        buildTestPlayer({ id: 1, teamId: 1, pos: 'qb' }),
        buildTestPlayer({ id: 2, teamId: 1, pos: 'rb', starter: false }),
        buildTestPlayer({ id: 3, teamId: 1, pos: 'wr' }),
        buildTestPlayer({ id: 4, teamId: 1, pos: 'lb' }),
        buildTestPlayer({ id: 5, teamId: 1, pos: 'k' }),
        buildTestPlayer({ id: 6, teamId: 2, pos: 'qb' }),
      ],
    });
    vi.mocked(getAllGames).mockResolvedValue([
      game(),
      game({ id: 2, winnerId: null, scoreA: null, scoreB: null }),
      game({ id: 3, year: 2024 }),
    ]);
    vi.mocked(getAllPlays).mockResolvedValue([]);
    vi.mocked(getAllGameLogs).mockResolvedValue([
      log(1, { pass_attempts: 20, pass_completions: 12, pass_yards: 180, pass_touchdowns: 2 }),
      log(2, { rush_attempts: 8, rush_yards: 50, rush_touchdowns: 1 }),
      log(3, { receiving_catches: 4, receiving_yards: 70, receiving_touchdowns: 1 }),
      log(4, { tackles: 7, sacks: 1, fumbles_forced: 1 }),
      log(5, {
        field_goals_made: 2,
        field_goals_attempted: 3,
        extra_points_made: 2,
        extra_points_attempted: 2,
      }),
      log(6, { pass_attempts: 10, pass_yards: 100 }),
      log(2, { gameId: 2, rush_attempts: 20, rush_yards: 200 }),
      log(2, { gameId: 3, rush_attempts: 20, rush_yards: 300 }),
    ]);
  });

  it('returns the requested team, ranks, and every active contributor category', async () => {
    const result = await loadTeamStats('Test State');

    expect(result.teams).toEqual(['Alpha Tech', 'Test State']);
    expect(result.team.id).toBe(1);
    expect(result.teamStats.offense.ranks.ppg).toBeGreaterThan(0);
    expect(result.playerStats.passing.map(player => player.id)).toEqual([1]);
    expect(result.playerStats.rushing).toEqual([
      expect.objectContaining({ id: 2, stats: expect.objectContaining({ yards: 50 }) }),
    ]);
    expect(result.playerStats.receiving.map(player => player.id)).toEqual([3]);
    expect(result.playerStats.defense.map(player => player.id)).toEqual([4]);
    expect(result.playerStats.kicking).toEqual([
      expect.objectContaining({
        id: 5,
        stats: expect.objectContaining({ points: 8, field_goal_percent: 66.7 }),
      }),
    ]);
  });

  it('falls back to the user team for an unknown route team', async () => {
    await expect(loadTeamStats('Missing Team')).resolves.toMatchObject({
      team: { id: 1, name: 'Test State' },
    });
  });

  it('returns zero aggregates and empty player categories before games are completed', async () => {
    const snapshot = await loadLeaguePlayersSnapshot();
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      ...snapshot,
      league: {
        ...snapshot.league,
        teams: snapshot.league.teams.map(team => ({ ...team, gamesPlayed: 0 })),
      },
    });
    vi.mocked(getAllGames).mockResolvedValue([]);

    const result = await loadTeamStats('Test State');

    expect(result.teamStats.offense.values).toMatchObject({ games: 0, ppg: 0, yardspg: 0 });
    expect(result.playerStats).toEqual({
      passing: [],
      rushing: [],
      receiving: [],
      defense: [],
      kicking: [],
    });
  });

  it('loads archived team and retired-player statistics without game detail reads', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([{
      year: 2024,
      playoffTeams: 12,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot({
          conference: 'Old Conference',
          rating: 77,
          prestige: 3,
          ranking: 8,
          record: '9-4 (6-2)',
          offense: buildTestTeamAggregateTotals({ games: 13, points: 390 }),
          defense: buildTestTeamAggregateTotals({ games: 13, points: 260 }),
        }),
        buildTestSeasonTeamSnapshot({
          teamId: 2,
          offense: buildTestTeamAggregateTotals({ games: 13, points: 260 }),
          defense: buildTestTeamAggregateTotals({ games: 13, points: 390 }),
        }),
      ],
      events: [],
      awards: [],
    }]);
    vi.mocked(getPlayerSeasonsByYearTeam).mockResolvedValue([
      buildTestPlayerSeason({
        playerId: 99,
        teamId: 1,
        pass_attempts: 200,
        pass_completions: 120,
        pass_yards: 2400,
        pass_touchdowns: 20,
      }),
    ]);
    vi.mocked(getAllHistoricalPlayers).mockResolvedValue([{
      id: 99,
      first: 'Retired',
      last: 'Quarterback',
      pos: 'qb',
      stars: 4,
      development_trait: 3,
    }]);

    const result = await loadTeamStats('Test State', 2024);

    expect(result).toMatchObject({
      selectedYear: 2024,
      years: [2025, 2024],
      team: {
        conference: 'Old Conference',
        rating: 77,
        prestige: 3,
        ranking: 8,
        record: '9-4 (6-2)',
      },
      teamStats: { offense: { values: { games: 13, ppg: 30 } } },
    });
    expect(result.playerStats.passing[0]).toMatchObject({
      id: 99,
      first: 'Retired',
      stats: { yards: 2400 },
    });
    expect(getPlayerSeasonsByYearTeam).toHaveBeenCalledWith(2024, 1);
    expect(getAllGames).not.toHaveBeenCalled();
    expect(getAllPlays).not.toHaveBeenCalled();
    expect(getAllGameLogs).not.toHaveBeenCalled();
  });

  it('falls back to the live season for an unavailable year', async () => {
    const result = await loadTeamStats('Test State', 1900);

    expect(result.selectedYear).toBe(2025);
    expect(getAllGames).toHaveBeenCalledOnce();
  });
});
