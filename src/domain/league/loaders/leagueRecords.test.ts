import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHistoryData } from '../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import { getAllGames } from '../../../db/simRepo';
import {
  buildTestLeague,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import { SeasonMemoryDataIntegrityError } from '../../../types/memory';
import { loadLeagueRecords } from './leagueRecords';

vi.mock('../../../db/baseData');
vi.mock('../../../db/leagueRepo');
vi.mock('../../../db/seasonMemoryRepo');
vi.mock('../../../db/simRepo');

const game = (
  id: number,
  teamAId: number,
  teamBId: number,
  winnerId: number,
  gameType: GameRecord['gameType'],
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: gameType,
  name: gameType,
  gameType,
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 18,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 31,
  scoreB: 24,
  watchability: 80,
});

describe('loadLeagueRecords', () => {
  const userTeam = buildTestTeam();
  const otherTeam = buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH' });
  const newTeam = buildTestTeam({ id: 3, name: 'New University', abbreviation: 'NEW' });

  beforeEach(() => {
    vi.resetAllMocks();
    const baseLeague = buildTestLeague('summary');
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('summary', {
        teams: [userTeam, otherTeam, newTeam],
        conferences: [{ ...baseLeague.conferences[0], teams: [userTeam, otherTeam, newTeam] }],
        info: { ...baseLeague.info, currentYear: 2026, startYear: 2025 },
      }),
      players: [],
    });
  });

  it('aggregates historical and archived seasons across active and inactive programs', async () => {
    vi.mocked(getHistoryData).mockResolvedValue({
      years: [2000, 2021, 2022, 2023, 2025, 2026],
      conf_index: { Independent: 0, 'Old Conference': 1, 'Test Conference': 2 },
      teams: {
        'Test State': [
          [2021, 2, 5, 10, 2, 4],
          [2022, 2, 3, 10, 2, 4],
          [2023, 2, 3, 10, 2, 4],
          [2025, 2, 8, 8, 4, 4],
          [2026, 2, 1, 15, 0, 5],
        ],
        'Other State': [[2025, 2, 12, 9, 4, 3]],
        'Old College': [[2000, 1, 1, 12, 0, 5]],
      },
    });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([
      buildTestSeasonMemory({
        teamSnapshots: [
          buildTestSeasonTeamSnapshot(),
          buildTestSeasonTeamSnapshot({ teamId: 2 }),
          buildTestSeasonTeamSnapshot({ teamId: 3 }),
        ],
        postseason: {
          playoff: {
            format: 2,
            seeds: [1, 2],
            autobids: 0,
            conferenceChampionsReceiveTopSeeds: false,
            games: { championship: 1 },
          },
          conferenceChampions: [{
            conferenceName: 'Test Conference',
            teamId: 1,
            championshipGameId: null,
          }],
          bowls: [{ gameId: 2, name: 'Test Bowl', tier: 'other' }],
        },
        awards: [{ categorySlug: 'heisman', playerId: 10, teamId: 1 }],
      }),
    ]);
    vi.mocked(getAllGames).mockResolvedValue([
      game(1, 1, 2, 1, 'national_championship'),
      game(2, 2, 3, 2, 'bowl'),
    ]);

    const result = await loadLeagueRecords();
    expect(result.coverage).toEqual({
      firstCompletedYear: 2000,
      lastCompletedYear: 2025,
      firstDynastyYear: 2025,
      lastDynastyYear: 2025,
    });
    expect(result.hasCompletedSeasons).toBe(true);
    expect(result.programs.find(program => program.name === 'Test State')).toMatchObject({
      active: true,
      conference: 'Test Conference',
      seasons: 4,
      wins: 38,
      losses: 10,
      winPercentage: 38 / 48,
      bestSeason: { year: 2023, wins: 10, losses: 2, finalRank: 3 },
      bestFinalRank: 3,
      nationalTitles: 1,
      conferenceTitles: 1,
      playoffAppearances: 1,
      bowlWins: 0,
      awardWinners: 1,
    });
    expect(result.programs.find(program => program.name === 'Other State')).toMatchObject({
      playoffAppearances: 1,
      bowlWins: 1,
    });
    expect(result.programs.find(program => program.name === 'Old College')).toMatchObject({
      active: false,
      conference: 'Old Conference',
      bestFinalRank: 1,
      nationalTitles: 0,
    });
    expect(result.programs.find(program => program.name === 'New University')).toMatchObject({
      active: true,
      seasons: 0,
      wins: 0,
      losses: 0,
      winPercentage: null,
      bestSeason: null,
      bestFinalRank: null,
    });
  });

  it('excludes Summary-stage dynasty rows until a season archive exists', async () => {
    vi.mocked(getHistoryData).mockResolvedValue({
      years: [2024, 2025],
      conf_index: { 'Test Conference': 1 },
      teams: { 'Test State': [[2024, 1, 10, 9, 4, 4], [2025, 1, 1, 15, 0, 5]] },
    });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);
    vi.mocked(getAllGames).mockResolvedValue([]);

    const result = await loadLeagueRecords();
    expect(result.programs.find(program => program.name === 'Test State')).toMatchObject({
      seasons: 1,
      wins: 9,
      losses: 4,
    });
    expect(result.coverage.lastCompletedYear).toBe(2024);
    expect(result.coverage.firstDynastyYear).toBeNull();
  });

  it('returns an explicit empty result when no program has a completed row', async () => {
    vi.mocked(getHistoryData).mockResolvedValue({ years: [], conf_index: {}, teams: {} });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);
    vi.mocked(getAllGames).mockResolvedValue([]);

    const result = await loadLeagueRecords();
    expect(result.hasCompletedSeasons).toBe(false);
    expect(result.coverage.firstCompletedYear).toBeNull();
    expect(result.programs).toHaveLength(3);
  });

  it('rejects missing authoritative postseason game references', async () => {
    vi.mocked(getHistoryData).mockResolvedValue({ years: [], conf_index: {}, teams: {} });
    vi.mocked(getAllSeasonMemories).mockResolvedValue([buildTestSeasonMemory()]);
    vi.mocked(getAllGames).mockResolvedValue([]);

    await expect(loadLeagueRecords()).rejects.toBeInstanceOf(SeasonMemoryDataIntegrityError);
  });
});
