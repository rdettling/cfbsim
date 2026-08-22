import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllGames } from '../../../db/simRepo';
import { buildTestLeague, buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import type { LeagueStage } from '../../../types/domain';
import { loadLeagueOrThrow } from '../leagueStore';
import { loadRankings } from './rankings';

vi.mock('../../../db/simRepo');
vi.mock('../leagueStore');

const game = ({
  id,
  week,
  teamAId,
  teamBId,
  winnerId,
  year = 2025,
  gameType = 'regular_season',
}: {
  id: number;
  week: number;
  teamAId: number;
  teamBId: number;
  winnerId: number | null;
  year?: number;
  gameType?: GameRecord['gameType'];
}): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId,
  baseLabel: gameType === 'national_championship'
    ? 'National Championship'
    : `Team ${teamAId} vs Team ${teamBId}`,
  name: gameType === 'national_championship' ? 'National Championship' : null,
  gameType,
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: week,
  year,
  rankATOG: teamAId,
  rankBTOG: teamBId,
  resultA: winnerId === null ? null : winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === null ? null : winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: winnerId === null ? 1 : 4,
  clockSecondsLeft: winnerId === null ? 900 : 0,
  scoreA: winnerId === null ? null : winnerId === teamAId ? 28 : 17,
  scoreB: winnerId === null ? null : winnerId === teamBId ? 28 : 17,
  watchability: 50,
});

const buildLeague = (stage: LeagueStage = 'season') => {
  const teams = [
    buildTestTeam({
      id: 1,
      name: 'Team 1',
      abbreviation: 'T1',
      ranking: 1,
      last_rank: 2,
      gamesPlayed: 14,
      strength_of_record: 6.3,
      strength_of_record_avg: 0.45,
    }),
    buildTestTeam({
      id: 2,
      name: 'Team 2',
      abbreviation: 'T2',
      ranking: 2,
      last_rank: 1,
      gamesPlayed: 15,
      strength_of_record: 6.711,
      strength_of_record_avg: 0.4474,
    }),
    buildTestTeam({
      id: 3,
      name: 'Team 3',
      abbreviation: 'T3',
      ranking: 3,
      last_rank: 3,
      gamesPlayed: 15,
      strength_of_record: 6.708,
      strength_of_record_avg: 0.4472,
    }),
  ];
  return buildTestLeague(stage, {
    info: {
      currentWeek: 7,
      lastRankingsWeek: 6,
      currentYear: 2025,
      startYear: 2025,
      stage,
      team: teams[0].name,
      lastWeek: 19,
    },
    teams,
    conferences: [],
    playoff: { seeds: [2] },
    settings: {
      ...buildTestLeague(stage).settings,
      playoffTeams: 4,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    },
  });
};

describe('rankings page loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildLeague());
    vi.mocked(getAllGames).mockResolvedValue([]);
  });

  it('projects playoff status and the exact last and current weeks', async () => {
    const league = buildLeague();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);
    vi.mocked(getAllGames).mockResolvedValue([
      game({ id: 1, week: 5, teamAId: 1, teamBId: 3, winnerId: 1 }),
      game({ id: 2, week: 6, teamAId: 1, teamBId: 2, winnerId: 2 }),
      game({ id: 3, week: 7, teamAId: 1, teamBId: 3, winnerId: null }),
      game({ id: 4, week: 8, teamAId: 1, teamBId: 2, winnerId: null }),
    ]);

    const result = await loadRankings();
    const [first, second, third] = result.rankings;

    expect(first).toMatchObject({
      isPlayoffTeam: false,
      movement: 1,
      last_week: { weekPlayed: 6, result: 'L' },
      current_week: { weekPlayed: 7 },
    });
    expect(second).toMatchObject({
      isPlayoffTeam: true,
      last_week: { weekPlayed: 6 },
      current_week: null,
    });
    expect(third).toMatchObject({
      isPlayoffTeam: false,
      last_week: null,
      current_week: { weekPlayed: 7 },
    });
  });

  it('ignores last-week and current-week games from other seasons', async () => {
    vi.mocked(getAllGames).mockResolvedValue([
      game({ id: 1, week: 6, teamAId: 1, teamBId: 2, winnerId: 1, year: 2024 }),
      game({ id: 2, week: 7, teamAId: 1, teamBId: 3, winnerId: null, year: 2024 }),
    ]);

    const result = await loadRankings();

    expect(result.rankings.every(team => team.last_week === null)).toBe(true);
    expect(result.rankings.every(team => team.current_week === null)).toBe(true);
  });
});
