import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSeasonMemory } from '../../../../db/seasonMemoryRepo';
import { getAllGames } from '../../../../db/simRepo';
import {
  buildTestLeague,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../../../../test/fixtures';
import type { GameRecord } from '../../../../types/db';
import { loadLeagueOrThrow } from '../../leagueStore';
import { loadTeamSchedule } from './loadTeamSchedule';

vi.mock('../../../../db/seasonMemoryRepo');
vi.mock('../../../../db/simRepo');
vi.mock('../../leagueStore');

const game = (overrides: Partial<GameRecord>): GameRecord => ({
  id: 1,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId: 1,
  baseLabel: 'Regular Season',
  name: null,
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
  scoreA: 28,
  scoreB: 14,
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: 80,
  ...overrides,
});

describe('loadTeamSchedule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildTestLeague('season', {
      info: {
        ...buildTestLeague('season').info,
        currentYear: 2026,
      },
      teams: [
        buildTestTeam(),
        buildTestTeam({
          id: 2,
          name: 'Other State',
          abbreviation: 'OTH',
          rating: 91,
          ranking: 3,
          record: '4-0 (2-0)',
        }),
      ],
    }));
    vi.mocked(getAllGames).mockResolvedValue([
      game({ id: 1, winnerId: 1 }),
      game({ id: 2, weekPlayed: 2, winnerId: 2, resultA: 'L', resultB: 'W' }),
      game({
        id: 3,
        year: 2026,
        winnerId: null,
        resultA: null,
        resultB: null,
        scoreA: null,
        scoreB: null,
      }),
      game({
        id: 4,
        teamAId: 2,
        teamBId: 1,
        homeTeamId: 2,
        awayTeamId: 1,
        weekPlayed: 2,
        year: 2026,
        winnerId: null,
        resultA: null,
        resultB: null,
        scoreA: null,
        scoreB: null,
        moneylineA: '-210',
        moneylineB: '+180',
      }),
    ]);
    vi.mocked(getSeasonMemory).mockResolvedValue({
      year: 2025,
      playoffTeams: 12,
      teamSnapshots: [
        buildTestSeasonTeamSnapshot({
          teamId: 1,
          rating: 77,
          prestige: 3,
          ranking: 8,
          record: '9-4 (6-2)',
        }),
        buildTestSeasonTeamSnapshot({
          teamId: 2,
          rating: 70,
          prestige: 2,
          ranking: 22,
          record: '7-5 (4-4)',
        }),
      ],
      events: [],
      awards: [],
    });
  });

  it('returns complete metrics for the selected season', async () => {
    await expect(loadTeamSchedule('Test State', 2026)).resolves.toMatchObject({
      selected_year: 2026,
      selectedTeamMetrics: { record: '0-0', rating: 80, prestige: 4 },
    });
    await expect(loadTeamSchedule('Test State', 2025)).resolves.toMatchObject({
      selected_year: 2025,
      selectedTeamMetrics: { record: '1-1', rating: 77, prestige: 3 },
    });
  });

  it('uses live opponent metadata for the current season', async () => {
    const data = await loadTeamSchedule('Test State', 2026);
    expect(data.schedule[0].opponent).toEqual({
      name: 'Other State',
      rating: 91,
      ranking: 3,
      record: '4-0 (2-0)',
    });
    expect(data.schedule[0].moneyline).toBe('-150');
    expect(data.schedule[1].moneyline).toBe('+180');
    expect(getSeasonMemory).not.toHaveBeenCalled();
  });

  it('uses season-final opponent metadata for a historical season', async () => {
    const data = await loadTeamSchedule('Test State', 2025);
    expect(data.schedule[0].opponent).toEqual({
      name: 'Other State',
      rating: 70,
      ranking: 22,
      record: '7-5 (4-4)',
    });
  });

  it('rejects a historical season without the selected team snapshot', async () => {
    vi.mocked(getSeasonMemory).mockResolvedValue({
      year: 2025,
      playoffTeams: 12,
      teamSnapshots: [buildTestSeasonTeamSnapshot({
        teamId: 2,
        rating: 70,
        prestige: 2,
        ranking: 22,
        record: '7-5 (4-4)',
      })],
      events: [],
      awards: [],
    });

    await expect(loadTeamSchedule('Test State', 2025)).rejects.toThrow(
      'Season 2025 is missing the team snapshot for Test State.',
    );
  });

  it('rejects a historical opponent without its team snapshot', async () => {
    vi.mocked(getSeasonMemory).mockResolvedValue({
      year: 2025,
      playoffTeams: 12,
      teamSnapshots: [buildTestSeasonTeamSnapshot({
        teamId: 1,
        rating: 77,
        prestige: 3,
        ranking: 8,
        record: '9-4 (6-2)',
      })],
      events: [],
      awards: [],
    });

    await expect(loadTeamSchedule('Test State', 2025)).rejects.toThrow(
      'Season 2025 is missing the team snapshot for Other State.',
    );
  });
});
