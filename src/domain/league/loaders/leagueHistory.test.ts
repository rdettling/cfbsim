import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import {
  getAllHistoricalPlayers,
  getGamesByYear,
} from '../../../db/simRepo';
import {
  buildTestAwardStats,
  buildTestLeague,
  buildTestPlayer,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
} from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import { loadLeagueHistory } from './leagueHistory';

vi.mock('../../../db/leagueRepo');
vi.mock('../../../db/seasonMemoryRepo');
vi.mock('../../../db/simRepo');

const game = (
  id: number,
  teamAId: number,
  teamBId: number,
  winnerId: number,
  gameType: GameRecord['gameType'],
  name: string,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: name,
  name,
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
  rankATOG: teamAId,
  rankBTOG: teamBId,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: winnerId === teamAId ? 31 : 24,
  scoreB: winnerId === teamBId ? 31 : 24,
  watchability: 90,
});

describe('loadLeagueHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const userTeam = buildTestTeam();
    const runnerUp = buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH', ranking: 2 });
    vi.mocked(loadLeaguePlayersSnapshot).mockResolvedValue({
      league: buildTestLeague('season', {
        teams: [userTeam, runnerUp],
        conferences: [{
          ...buildTestLeague('season').conferences[0],
          teams: [userTeam, runnerUp],
        }],
        info: { ...buildTestLeague('season').info, currentYear: 2026, startYear: 2025 },
      }),
      players: [buildTestPlayer()],
    });
    vi.mocked(getAllHistoricalPlayers).mockResolvedValue([]);
  });

  it('returns a navbar-enabled empty result before a season is archived', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([]);

    await expect(loadLeagueHistory()).resolves.toMatchObject({
      years: [],
      season: null,
      info: { currentYear: 2026 },
      team: { name: 'Test State' },
    });
    expect(getGamesByYear).not.toHaveBeenCalled();
  });

  it('selects the newest archive on the base route and rejects unavailable years', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([
      buildTestSeasonMemory({
        year: 2025,
        teamSnapshots: [
          buildTestSeasonTeamSnapshot(),
          buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2 }),
        ],
      }),
      buildTestSeasonMemory({
        year: 2024,
        teamSnapshots: [
          buildTestSeasonTeamSnapshot(),
          buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2 }),
        ],
      }),
    ]);
    vi.mocked(getGamesByYear).mockResolvedValue([
      game(1, 1, 2, 1, 'national_championship', 'National Championship'),
    ]);

    const result = await loadLeagueHistory();
    expect(result.years).toEqual([2025, 2024]);
    expect(result.season?.year).toBe(2025);
    await expect(loadLeagueHistory(2023)).rejects.toThrow(
      'League history is unavailable for the 2023 season.',
    );
    await expect(loadLeagueHistory(Number.NaN)).rejects.toThrow('Invalid league history season.');
  });

  it('projects the complete selected season book from normalized references', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([
      buildTestSeasonMemory({
        teamSnapshots: [
          buildTestSeasonTeamSnapshot(),
          buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2, rating: 79, record: '11-1 (7-1)' }),
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
            championshipGameId: 2,
          }],
          bowls: [{ gameId: 3, name: 'Rose Bowl', tier: 'ny6' }],
        },
        awards: [{
          categorySlug: 'nagurski',
          playerId: 1,
          teamId: 1,
          stats: buildTestAwardStats({
            pass_yards: 4_200,
            pass_attempts: 400,
            pass_completions: 280,
            pass_touchdowns: 40,
            pass_interceptions: 5,
            rush_yards: 420,
            rush_attempts: 80,
            rush_touchdowns: 6,
          }),
        }],
      }),
    ]);
    vi.mocked(getGamesByYear).mockResolvedValue([
      game(1, 1, 2, 1, 'national_championship', 'National Championship'),
      game(2, 1, 2, 1, 'conference_championship', 'Test Conference Championship'),
      game(3, 1, 2, 1, 'bowl', 'Rose Bowl'),
    ]);

    const result = await loadLeagueHistory(2025);
    expect(result.season).toMatchObject({
      championship: {
        gameId: 1,
        champion: { name: 'Test State' },
        runnerUp: { name: 'Other State' },
        championScore: 31,
        runnerUpScore: 24,
      },
      userTeam: {
        name: 'Test State',
        accomplishments: expect.arrayContaining([
          { type: 'national_champion', label: 'National Champion' },
          { type: 'conference_champion', label: 'Test Conference Champion' },
          { type: 'bowl_win', label: 'Rose Bowl Winner' },
        ]),
      },
      finalRankings: [{ name: 'Test State' }, { name: 'Other State' }],
      conferenceChampions: [{ team: { name: 'Test State' }, championshipGameId: 2 }],
      bowls: [{ id: 3, name: 'Rose Bowl', is_ny6: true, winner: 'Test State' }],
      awards: [{
        categorySlug: 'nagurski',
        categoryName: 'Bronko Nagurski Trophy',
        categoryDescription: 'Outstanding defensive player',
        group: 'defense',
        placements: [{
          key: 'first',
          player: {
            id: 1,
            first: 'Pat',
            last: 'Player',
            teamName: 'Test State',
            position: 'qb',
          },
          score: null,
          statLine: '280/400, 4200 pass yds, 40 pass TD, 5 INT · 80 carries, 420 rush yds, 6 rush TD',
        }],
      }],
    });
  });

  it('rejects an archived award with an unknown category', async () => {
    vi.mocked(getAllSeasonMemories).mockResolvedValue([
      buildTestSeasonMemory({
        teamSnapshots: [
          buildTestSeasonTeamSnapshot(),
          buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2 }),
        ],
        awards: [{
          categorySlug: 'unknown_award',
          playerId: 1,
          teamId: 1,
          stats: buildTestAwardStats(),
        }],
      }),
    ]);
    vi.mocked(getGamesByYear).mockResolvedValue([
      game(1, 1, 2, 1, 'national_championship', 'National Championship'),
    ]);

    await expect(loadLeagueHistory(2025)).rejects.toThrow(
      'Unknown award category: unknown_award.',
    );
  });
});
