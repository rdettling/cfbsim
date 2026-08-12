import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHistoricalGamesIndex,
  getHistoricalGamesSeason,
  getHistoryData,
  getYearData,
} from '../../../../db/baseData';
import { getSeasonMemory } from '../../../../db/seasonMemoryRepo';
import { getAllGames } from '../../../../db/simRepo';
import {
  buildTestLeague,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../../../../test/fixtures';
import type { HistoricalGame } from '../../../../types/baseData';
import type { GameRecord } from '../../../../types/db';
import type { TeamScheduleGameRow } from '../../../../types/scheduleTypes';
import { loadLeagueOrThrow } from '../../leagueStore';
import { loadTeamSchedule } from './loadTeamSchedule';

vi.mock('../../../../db/baseData');
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

const historicalGame = (
  overrides: Partial<HistoricalGame> = {},
): HistoricalGame => ({
  sourceId: 101,
  year: 2025,
  weekPlayed: 1,
  seasonType: 'regular',
  homeTeam: 'Test State',
  awayTeam: 'Other State',
  homeScore: 31,
  awayScore: 17,
  homeRank: 4,
  awayRank: 12,
  neutralSite: false,
  venue: 'Historic Stadium',
  name: null,
  label: 'Conference: Test Conference',
  ...overrides,
});

const getGameRows = (value: Awaited<ReturnType<typeof loadTeamSchedule>>) =>
  value.schedule.filter(
    (row): row is TeamScheduleGameRow => row.kind === 'game',
  );

describe('loadTeamSchedule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildTestLeague('season', {
      info: {
        ...buildTestLeague('season').info,
        currentYear: 2026,
        startYear: 2025,
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
    vi.mocked(getHistoricalGamesIndex).mockResolvedValue({
      generated_at: '2026-01-01T00:00:00.000Z',
      source: 'CollegeFootballData.com',
      years: [2025],
    });
    vi.mocked(getHistoryData).mockResolvedValue({
      generated_at: '2026-01-01T00:00:00.000Z',
      years: [2025],
      conf_index: { 'Test Conference': 1 },
      teams: { 'Test State': [[2025, 1, 8, 9, 4, 5]] },
    });
    vi.mocked(getHistoricalGamesSeason).mockResolvedValue({
      year: 2025,
      games: [historicalGame()],
    });
    vi.mocked(getYearData).mockResolvedValue({
      playoff: { teams: 12, conf_champ_autobids: 5, conf_champ_top_4: false },
      conferences: {},
      independents: {},
    });
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

  it('uses live and archived dynasty snapshots for simulated seasons', async () => {
    await expect(loadTeamSchedule('Test State', 2026)).resolves.toMatchObject({
      selected_year: 2026,
      selectedTeamMetrics: {
        record: '0-0',
        rating: 80,
        prestige: 4,
        ranking: 1,
        conference: 'Test Conference',
      },
    });
    await expect(loadTeamSchedule('Test State', 2025)).resolves.toMatchObject({
      selected_year: 2025,
      selectedTeamMetrics: { record: '1-1', rating: 77, prestige: 3 },
    });
    expect(getHistoricalGamesSeason).not.toHaveBeenCalled();
  });

  it('uses live opponent metadata and preserves multiple simulated games per week', async () => {
    const data = await loadTeamSchedule('Test State', 2026);
    const rows = getGameRows(data);
    expect(rows).toHaveLength(2);
    expect(rows[0].opponent).toEqual({
      name: 'Other State',
      rating: 91,
      ranking: 3,
      record: '4-0 (2-0)',
      canOpen: true,
    });
    expect(rows[0].moneyline).toBe('-150');
    expect(rows[1].moneyline).toBe('+180');
    expect(rows.map(row => row.weekPlayed)).toEqual([1, 2]);
    expect(getSeasonMemory).not.toHaveBeenCalled();
    expect(getHistoricalGamesSeason).not.toHaveBeenCalled();
  });

  it('rejects an archived dynasty season without the selected team snapshot', async () => {
    vi.mocked(getSeasonMemory).mockResolvedValue({
      year: 2025,
      playoffTeams: 12,
      teamSnapshots: [buildTestSeasonTeamSnapshot({ teamId: 2 })],
      events: [],
      awards: [],
    });

    await expect(loadTeamSchedule('Test State', 2025)).rejects.toThrow(
      'Season 2025 is missing the team snapshot for Test State.',
    );
  });

  it('exposes and loads indexed pre-dynasty history without loading season memory', async () => {
    const league = await vi.mocked(loadLeagueOrThrow)();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue({
      ...league,
      info: { ...league.info, startYear: 2026 },
    });
    vi.mocked(getAllGames).mockResolvedValue([
      game({ id: 3, year: 2026, winnerId: null, scoreA: null, scoreB: null }),
    ]);
    vi.mocked(getHistoricalGamesSeason).mockResolvedValue({
      year: 2025,
      games: [
        historicalGame(),
        historicalGame({
          sourceId: 102,
          homeTeam: 'Lower College',
          awayTeam: 'Test State',
          homeScore: 24,
          awayScore: 21,
          homeRank: 0,
          awayRank: 4,
          neutralSite: true,
          venue: 'Neutral Field',
          label: 'Non-Conference: Test Conference vs FCS',
        }),
        historicalGame({
          sourceId: 103,
          weekPlayed: 19,
          seasonType: 'postseason',
          homeTeam: 'Test State',
          awayTeam: 'Other State',
          homeScore: 27,
          awayScore: 24,
          neutralSite: true,
          name: 'National Championship',
          label: 'National Championship',
        }),
      ],
    });

    const current = await loadTeamSchedule('Test State', 2026);
    expect(current.years).toEqual([2026, 2025]);
    expect(getHistoricalGamesSeason).not.toHaveBeenCalled();

    const historical = await loadTeamSchedule('Test State', 2025);
    const rows = getGameRows(historical);
    expect(historical.years).toEqual([2026, 2025]);
    expect(historical.selectedTeamMetrics).toEqual({
      record: '9-4',
      rating: null,
      prestige: 5,
      ranking: 8,
      conference: 'Test Conference',
    });
    expect(rows).toHaveLength(3);
    expect(rows.slice(0, 2).map(row => row.weekPlayed)).toEqual([1, 1]);
    expect(rows[0]).toMatchObject({
      source: 'historical',
      result: 'W',
      score: '31-17',
      spread: null,
      moneyline: null,
      gameId: null,
      location: 'Home',
      venue: 'Historic Stadium',
      label: 'Conference: Test Conference',
      opponent: { ranking: 12, rating: null, record: null, canOpen: true },
    });
    expect(rows[1]).toMatchObject({
      result: 'L',
      score: '21-24',
      location: 'Neutral',
      opponent: { name: 'Lower College', canOpen: false },
    });
    expect(historical.schedule).toHaveLength(20);
    expect(historical.schedule[historical.schedule.length - 1]).toMatchObject({
      weekPlayed: 19,
    });
    expect(getSeasonMemory).not.toHaveBeenCalled();
    expect(getYearData).toHaveBeenCalledWith('2025');
  });

  it('does not expose history for a team without a history row', async () => {
    const league = await vi.mocked(loadLeagueOrThrow)();
    const newTeam = buildTestTeam({ id: 3, name: 'New State' });
    vi.mocked(loadLeagueOrThrow).mockResolvedValue({
      ...league,
      info: { ...league.info, startYear: 2026 },
      teams: [...league.teams, newTeam],
    });
    vi.mocked(getAllGames).mockResolvedValue([]);

    const data = await loadTeamSchedule('New State', 2025);
    expect(data.years).toEqual([2026]);
    expect(data.selected_year).toBe(2026);
    expect(getHistoricalGamesSeason).not.toHaveBeenCalled();
  });
});
