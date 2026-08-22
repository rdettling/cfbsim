import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllGames } from '../../../db/simRepo';
import { buildTestLeague, buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import { loadLeagueOrThrow } from '../leagueStore';
import { loadStandings } from './standings';
import { loadOddsContext } from '../../odds';

vi.mock('../../../db/simRepo');
vi.mock('../leagueStore');
vi.mock('../../odds', async importOriginal => ({
  ...await importOriginal<typeof import('../../odds')>(),
  loadOddsContext: vi.fn(),
}));

const teams = [
  buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP', ranking: 3 }),
  buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET', ranking: 1 }),
  buildTestTeam({ id: 3, name: 'Gamma', abbreviation: 'GAM', ranking: 2 }),
];

const championshipGame = (winnerId: number | null): GameRecord => ({
  id: 10,
  teamAId: 1,
  teamBId: 3,
  homeTeamId: null,
  awayTeamId: null,
  neutralSite: true,
  venue: null,
  winnerId,
  baseLabel: 'Test Conference Championship',
  name: 'Test Conference Championship',
  gameType: 'conference_championship',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: 15,
  year: 2025,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === null ? null : winnerId === 1 ? 'W' : 'L',
  resultB: winnerId === null ? null : winnerId === 3 ? 'W' : 'L',
  overtime: 0,
  quarter: winnerId === null ? 1 : 4,
  clockSecondsLeft: winnerId === null ? 900 : 0,
  scoreA: winnerId === null ? null : 24,
  scoreB: winnerId === null ? null : 17,
  watchability: winnerId === null ? 0 : 80,
});

const buildLeague = () => buildTestLeague('season', {
  info: {
    ...buildTestLeague('season').info,
    currentWeek: 15,
    currentYear: 2025,
    lastRankingsWeek: 14,
  },
  teams,
  conferences: [{
    id: 1,
    confName: 'Test Conference',
    confFullName: 'Test Conference',
    confGames: 8,
    info: '',
    championship: null,
    finalStandings: null,
    teams,
  }],
});

describe('standings loader championship view', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(loadOddsContext).mockResolvedValue({
      oddsMap: {
        '0': {
          favSpread: '-1.5',
          udSpread: '+1.5',
          favWinProb: 0.55,
          udWinProb: 0.45,
          favMoneyline: '-115',
          udMoneyline: '+105',
        },
      },
      maxDiff: 0,
    });
  });

  it('returns the current derived top two as an unscheduled projection', async () => {
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildLeague());

    const result = await loadStandings('Test Conference');

    expect(result.teams.map(team => team.id)).toEqual([2, 3, 1]);
    expect(result.championship).toMatchObject({
      status: 'projected',
      gameId: null,
      teamA: { id: 2 },
      teamB: { id: 3 },
      spreadA: '-1.5',
      spreadB: '+1.5',
    });
  });

  it.each([
    { winnerId: null, status: 'scheduled' },
    { winnerId: 1, status: 'complete' },
  ] as const)('returns frozen $status participants and game data', async ({ winnerId, status }) => {
    const league = buildLeague();
    league.conferences[0].championship = 10;
    league.conferences[0].finalStandings = {
      year: 2025,
      entries: [
        { teamId: 1, pollRank: 1, resolvedBy: 'overall_record' },
        { teamId: 3, pollRank: 2, resolvedBy: 'poll_rank' },
        { teamId: 2, pollRank: 3, resolvedBy: null },
      ],
    };
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);
    vi.mocked(getAllGames).mockResolvedValue([championshipGame(winnerId)]);

    const result = await loadStandings('Test Conference');

    expect(result.teams.map(team => team.id)).toEqual([1, 3, 2]);
    expect(result.championship).toMatchObject({
      status,
      gameId: 10,
      teamA: { id: 1 },
      teamB: { id: 3 },
      winnerId,
      spreadA: '-3',
      spreadB: '+3',
    });
    expect(loadOddsContext).not.toHaveBeenCalled();
  });

  it('does not expose a championship for independents', async () => {
    const independent = buildTestTeam({
      id: 4,
      name: 'Independent State',
      conference: 'Independent',
      confName: 'Independent',
    });
    const league = buildLeague();
    league.teams = [independent];
    league.conferences = [];
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadStandings('Independent');

    expect(result.championship).toBeNull();
  });
});
