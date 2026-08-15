import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLeague } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import { getAllGames, getAllPlays } from '../../../../db/simRepo';
import {
  buildTestLeague,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
  buildTestTeamAggregateTotals,
} from '../../../../test/fixtures';
import { loadTeamRankings } from './teamRankings';

vi.mock('../../../../db/leagueRepo');
vi.mock('../../../../db/seasonMemoryRepo');
vi.mock('../../../../db/simRepo');

describe('loadTeamRankings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const teams = [
      buildTestTeam(),
      buildTestTeam({ id: 2, name: 'Alpha Tech', abbreviation: 'ALP' }),
    ];
    vi.mocked(loadLeague).mockResolvedValue(buildTestLeague('season', { teams }));
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(getAllPlays).mockResolvedValue([]);
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);
  });

  it('reconstructs archived values and averages without detailed game reads', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([buildTestSeasonMemory({
      year: 2024,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot({
          offense: buildTestTeamAggregateTotals({ games: 10, points: 300 }),
          defense: buildTestTeamAggregateTotals({ games: 10, points: 200 }),
        }),
        buildTestSeasonTeamSnapshot({
          teamId: 2,
          offense: buildTestTeamAggregateTotals({ games: 10, points: 200 }),
          defense: buildTestTeamAggregateTotals({ games: 10, points: 300 }),
        }),
      ],
    })]);

    const result = await loadTeamRankings(2024);

    expect(result).toMatchObject({
      selectedYear: 2024,
      years: [2025, 2024],
      offense: {
        'Test State': { ppg: 30 },
        'Alpha Tech': { ppg: 20 },
      },
      defense: {
        'Test State': { ppg: 20 },
        'Alpha Tech': { ppg: 30 },
      },
      offense_averages: { ppg: 25 },
    });
    expect(getAllGames).not.toHaveBeenCalled();
    expect(getAllPlays).not.toHaveBeenCalled();
  });

  it('orders years descending and resolves invalid years to live data', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([
      buildTestSeasonMemory({ year: 2022, teamSnapshots: [] }),
      buildTestSeasonMemory({ year: 2024, teamSnapshots: [] }),
    ]);

    const result = await loadTeamRankings(Number.NaN);

    expect(result.selectedYear).toBe(2025);
    expect(result.years).toEqual([2025, 2024, 2022]);
    expect(getAllGames).toHaveBeenCalledOnce();
    expect(getAllPlays).toHaveBeenCalledOnce();
  });
});
