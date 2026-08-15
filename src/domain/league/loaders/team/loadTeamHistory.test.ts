import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHistoricalGamesIndex,
  getHistoryData,
  getRivalriesData,
} from '../../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import { getAllGameLogs, getAllPlays, getGamesByTeam } from '../../../../db/simRepo';
import {
  buildTestLeague,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
} from '../../../../test/fixtures';
import { SeasonMemoryDataIntegrityError } from '../../../../types/memory';
import { loadTeamHistory } from './loadTeamHistory';

vi.mock('../../../../db/baseData');
vi.mock('../../../../db/leagueRepo');
vi.mock('../../../../db/seasonMemoryRepo');
vi.mock('../../../../db/simRepo');

describe('loadTeamHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('season', {
        info: {
          ...buildTestLeague('season').info,
          currentYear: 2026,
          startYear: 2025,
        },
      }),
      players: [],
    });
    vi.mocked(getHistoryData).mockResolvedValue({
      years: [2024, 2025],
      conf_index: { 'Test Conference': 1 },
      teams: {
        'Test State': [
          [2025, 1, 8, 9, 4, 5],
          [2024, 1, 12, 8, 5, 2],
        ],
      },
    });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([buildTestSeasonMemory({
      year: 2025,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot({
          rating: 77,
          prestige: 3,
          ranking: 8,
          record: '9-4 (6-2)',
        }),
      ],
    })]);
    vi.mocked(getRivalriesData).mockResolvedValue({ rivalries: [] });
    vi.mocked(getHistoricalGamesIndex).mockResolvedValue({
      source: 'CollegeFootballData.com',
      years: [2024],
    });
    vi.mocked(getGamesByTeam).mockResolvedValue([]);
    vi.mocked(getAllGameLogs).mockResolvedValue([]);
    vi.mocked(getAllPlays).mockResolvedValue([]);
  });

  it('uses snapshots for dynasty metrics and archives for pre-dynasty prestige', async () => {
    await expect(loadTeamHistory('Test State')).resolves.toMatchObject({
      years: [
        {
          year: 2025,
          rating: 77,
          prestige: 3,
          era: 'dynasty',
          hasSchedule: false,
        },
        {
          year: 2024,
          rating: null,
          prestige: 2,
          era: 'historical',
          hasSchedule: true,
        },
      ],
    });
  });

  it('only enables indexed seasons before the dynasty start year', async () => {
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('season', {
        info: {
          ...buildTestLeague('season').info,
          currentYear: 2026,
          startYear: 2026,
        },
      }),
      players: [],
    });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);
    vi.mocked(getHistoricalGamesIndex).mockResolvedValue({
      source: 'CollegeFootballData.com',
      years: [2025],
    });

    await expect(loadTeamHistory('Test State')).resolves.toMatchObject({
      years: [
        { year: 2025, era: 'historical', hasSchedule: true },
        { year: 2024, era: 'historical', hasSchedule: false },
      ],
    });
  });

  it('rejects a dynasty history row without its team snapshot', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([buildTestSeasonMemory({
      year: 2025,
      teamSnapshots: [],
    })]);

    await expect(loadTeamHistory('Test State')).rejects.toBeInstanceOf(
      SeasonMemoryDataIntegrityError,
    );
  });
});
