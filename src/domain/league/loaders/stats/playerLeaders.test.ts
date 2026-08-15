import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import {
  getAllGameLogs,
  getAllGames,
  getAllHistoricalPlayers,
  getPlayerSeasonsByYear,
} from '../../../../db/simRepo';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestPlayerSeason,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../../../../test/fixtures';
import { loadPlayerLeaders } from './playerLeaders';

vi.mock('../../../../db/leagueRepo');
vi.mock('../../../../db/seasonMemoryRepo');
vi.mock('../../../../db/simRepo');

describe('loadPlayerLeaders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const teams = [
      buildTestTeam(),
      buildTestTeam({ id: 2, name: 'Alpha Tech', abbreviation: 'ALP' }),
    ];
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('season', { teams }),
      players: [buildTestPlayer({ id: 1 })],
    });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);
    vi.mocked(getAllGameLogs).mockResolvedValue([]);
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(getAllHistoricalPlayers).mockResolvedValue([]);
    vi.mocked(getPlayerSeasonsByYear).mockResolvedValue([]);
  });

  it('preserves archived starter and yardage qualifications and player identities', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([buildTestSeasonMemory({
      year: 2024,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot(),
        buildTestSeasonTeamSnapshot({ teamId: 2 }),
      ],
    })]);
    vi.mocked(getPlayerSeasonsByYear).mockResolvedValue([
      buildTestPlayerSeason({
        playerId: 10,
        teamId: 2,
        position: 'qb',
        pass_attempts: 250,
        pass_completions: 150,
        pass_yards: 2500,
      }),
      buildTestPlayerSeason({
        playerId: 11,
        position: 'rb',
        starter: false,
        rush_attempts: 100,
        rush_yards: 900,
      }),
      buildTestPlayerSeason({
        playerId: 12,
        position: 'wr',
        receiving_catches: 8,
        receiving_yards: 101,
      }),
      buildTestPlayerSeason({
        year: 2023,
        playerId: 13,
        pass_attempts: 300,
        pass_yards: 3000,
      }),
    ]);
    vi.mocked(getAllHistoricalPlayers).mockResolvedValue([
      { id: 10, first: 'Transfer', last: 'Quarterback', pos: 'qb', stars: 4, development_trait: 3 },
      { id: 11, first: 'Reserve', last: 'Runner', pos: 'rb', stars: 3, development_trait: 2 },
      { id: 12, first: 'Retired', last: 'Receiver', pos: 'wr', stars: 3, development_trait: 2 },
      { id: 13, first: 'Wrong', last: 'Year', pos: 'qb', stars: 3, development_trait: 2 },
    ]);

    const result = await loadPlayerLeaders(2024);

    expect(result.selectedYear).toBe(2024);
    expect(result.stats.passing['10']).toMatchObject({
      first: 'Transfer',
      team: 'Alpha Tech',
      stats: { yards: 2500 },
    });
    expect(result.stats.rushing).not.toHaveProperty('11');
    expect(result.stats.receiving['12']).toMatchObject({
      last: 'Receiver',
      stats: { yards: 101 },
    });
    expect(result.stats.passing).not.toHaveProperty('13');
    expect(getAllGameLogs).not.toHaveBeenCalled();
    expect(getAllGames).not.toHaveBeenCalled();
  });

  it('resolves an unavailable year to the current season', async () => {
    const result = await loadPlayerLeaders(1900);

    expect(result.selectedYear).toBe(2025);
    expect(result.years).toEqual([2025]);
    expect(getAllGameLogs).toHaveBeenCalledOnce();
    expect(getAllGames).toHaveBeenCalledOnce();
  });
});
