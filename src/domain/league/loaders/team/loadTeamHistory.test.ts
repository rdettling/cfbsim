import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHistoryData, getRivalriesData } from '../../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import { getAllGameLogs, getGamesByTeam } from '../../../../db/simRepo';
import { buildTestLeague } from '../../../../test/fixtures';
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
      generated_at: '2026-01-01T00:00:00.000Z',
      years: [2024, 2025],
      conf_index: { 'Test Conference': 1 },
      teams: {
        'Test State': [
          [2025, 1, 8, 9, 4, 5],
          [2024, 1, 12, 8, 5, 2],
        ],
      },
    });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([{
      year: 2025,
      playoffTeams: 12,
      teamSnapshots: [
        { teamId: 1, rating: 77, prestige: 3, ranking: 8, record: '9-4 (6-2)' },
      ],
      events: [],
      awards: [],
    }]);
    vi.mocked(getRivalriesData).mockResolvedValue({ rivalries: [] });
    vi.mocked(getGamesByTeam).mockResolvedValue([]);
    vi.mocked(getAllGameLogs).mockResolvedValue([]);
  });

  it('uses snapshots for dynasty metrics and archives for pre-dynasty prestige', async () => {
    await expect(loadTeamHistory('Test State')).resolves.toMatchObject({
      years: [
        { year: 2025, rating: 77, prestige: 3, era: 'dynasty' },
        { year: 2024, rating: null, prestige: 2, era: 'historical' },
      ],
    });
  });

  it('rejects a dynasty history row without its team snapshot', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([{
      year: 2025,
      playoffTeams: 12,
      teamSnapshots: [],
      events: [],
      awards: [],
    }]);

    await expect(loadTeamHistory('Test State')).rejects.toBeInstanceOf(
      SeasonMemoryDataIntegrityError,
    );
  });
});
