import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllGames, getGameById, getGameDetailsByYear } from '../../../db/simRepo';
import {
  buildTestLeague,
  buildTestTeam,
  TEST_BETTING_ODDS_DATA,
} from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import type { PlayoffTeamCount } from '../../../types/domain';
import { buildOddsContext, loadOddsContext } from '../../odds';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildPlayoffSelection } from '../utils/playoffSelection';
import { buildResumeComparisonSnapshot } from '../utils/resumeComparison';
import { loadBowlGames } from './postseason/loadBowlGames';
import { loadPlayoffBracket } from './postseason/loadPlayoffBracket';
import { loadResumeComparison } from './postseason/loadResumeComparison';

vi.mock('../../../db/simRepo');
vi.mock('../leagueStore');
vi.mock('../../odds', async importOriginal => ({
  ...await importOriginal<typeof import('../../odds')>(),
  loadOddsContext: vi.fn(),
}));

const buildTeams = (count: number) => Array.from({ length: count }, (_, index) => buildTestTeam({
  id: index + 1,
  name: `Team ${index + 1}`,
  abbreviation: `T${index + 1}`,
  ranking: index + 1,
  poll_score: 100 - index,
  wins_over_expectation: (count - index) * 10,
  conference: 'Test Conference',
  confName: 'Test Conference',
}));

const buildGame = (
  id: number,
  teamAId: number,
  teamBId: number,
  winnerId: number,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId,
  baseLabel: 'Regular Season',
  name: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.5,
  winProbB: 0.5,
  weekPlayed: 1,
  year: 2025,
  rankATOG: 99,
  rankBTOG: 98,
  resultA: winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 24,
  scoreB: 17,
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: 0,
});

const buildLeagueWithTeams = (count: number, playoffTeams: PlayoffTeamCount = 12) => {
  const teams = buildTeams(count);
  return buildTestLeague('season', {
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
    settings: {
      ...buildTestLeague('season').settings,
      playoffTeams,
      playoffAutobids: playoffTeams === 12 ? 1 : 0,
    },
    playoff: { seeds: [] },
  });
};

describe('postseason page loaders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildLeagueWithTeams(30));
    vi.mocked(getAllGames).mockResolvedValue([]);
    vi.mocked(getGameById).mockResolvedValue(undefined);
    vi.mocked(getGameDetailsByYear).mockResolvedValue([]);
    vi.mocked(loadOddsContext).mockResolvedValue(buildOddsContext(TEST_BETTING_ODDS_DATA));
  });

  it('returns only bracket page data for the bracket route', async () => {
    const result = await loadPlayoffBracket();

    expect(result).toHaveProperty('bracket');
    expect(result).toMatchObject({ format: 12, isProjection: true, hasTeams: true });
    expect(getAllGames).toHaveBeenCalledOnce();
  });

  it('shows a projected spread only for the favorite in hypothetical matchups', async () => {
    const result = await loadPlayoffBracket();

    if (!('left_bracket' in result.bracket)) throw new Error('Expected a 12-team bracket.');
    expect(result.bracket.left_bracket.first_round[1]).toMatchObject({
      team1: 'Team 5',
      team2: 'Team 12',
      spread1: '-3',
      spread2: null,
    });
    expect(loadOddsContext).toHaveBeenCalledOnce();
  });

  it('calculates the spread when known teams do not yet have a scheduled game', async () => {
    const league = buildLeagueWithTeams(30, 2);
    league.teams[0].rating = 88;
    league.teams[1].rating = 80;
    league.playoff.seeds = league.teams.slice(0, 2).map(team => team.id);
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadPlayoffBracket();

    if (!('championship' in result.bracket)) throw new Error('Expected a playoff bracket.');
    expect(result.bracket.championship).toMatchObject({
      team1: 'Team 1',
      team2: 'Team 2',
      spread1: '-7',
      spread2: null,
    });
  });

  it('uses the persisted favorite spread for a scheduled playoff game', async () => {
    const league = buildLeagueWithTeams(30);
    league.playoff.seeds = league.teams.slice(0, 12).map(team => team.id);
    league.playoff.left_r1_2 = 200;
    const scheduledGame: GameRecord = {
      ...buildGame(200, league.teams[4].id, league.teams[11].id, league.teams[4].id),
      winnerId: null,
      resultA: null,
      resultB: null,
      scoreA: null,
      scoreB: null,
      spreadA: '+7',
      spreadB: '-7',
    };
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);
    vi.mocked(getGameById).mockImplementation(async id =>
      id === scheduledGame.id ? scheduledGame : undefined);

    const result = await loadPlayoffBracket();

    if (!('left_bracket' in result.bracket)) throw new Error('Expected a 12-team bracket.');
    expect(result.bracket.left_bracket.first_round[1]).toMatchObject({
      game_id: 200,
      team1: 'Team 5',
      team2: 'Team 12',
      spread1: null,
      spread2: '-7',
    });
    expect(loadOddsContext).toHaveBeenCalledOnce();
  });

  it('returns every team with presentation-ready resume context', async () => {
    const league = buildLeagueWithTeams(30);
    league.playoff.seeds = league.teams.slice(0, 12).map(team => team.id);
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadResumeComparison();

    expect(result.teams).toHaveLength(30);
    expect(result.teams.map(team => team.ranking)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(result.teams[0]).toMatchObject({
      name: 'Team 1',
      resumeScoreRank: 1,
      performanceIndexRank: 1,
      top25Record: '0-0',
      bestWin: null,
      worstLoss: null,
      seed: 1,
      isAutobid: true,
      hasBye: true,
      isChampion: true,
    });
    expect(result.teams[12]).toMatchObject({ seed: null, isAutobid: false, hasBye: false });
    expect(result).toMatchObject({ format: 12, isProjection: false });
  });

  it('derives Top-25 record and best/worst results from opponents current rankings', async () => {
    const league = buildLeagueWithTeams(40);
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);
    vi.mocked(getAllGames).mockResolvedValue([
      buildGame(1, 1, 10, 1),
      buildGame(2, 1, 30, 30),
      buildGame(3, 1, 40, 1),
      buildGame(4, 1, 10, 10),
      { ...buildGame(5, 1, 2, 1), year: 2024 },
    ]);

    const result = await loadResumeComparison();
    const team = result.teams[0];

    expect(team.top25Record).toBe('1-1');
    expect(team.bestWin).toMatchObject({ opponent: 'Team 10', opponentRanking: 10 });
    expect(team.worstLoss).toMatchObject({ opponent: 'Team 30', opponentRanking: 30 });
  });

  it('reads frozen resume rows without consulting later league or game state', async () => {
    const league = buildLeagueWithTeams(30);
    league.resumeSnapshot = buildResumeComparisonSnapshot({
      league,
      games: [],
      details: [],
      selection: buildPlayoffSelection(league, [league.teams[0]]),
      championIds: new Set([league.teams[0].id]),
    });
    const frozenFirst = structuredClone(league.resumeSnapshot.teams[0]);
    league.teams[0].ranking = 30;
    league.teams[0].poll_score = 1;
    league.teams[0].totalLosses = 5;
    league.settings.playoffTeams = 4;
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadResumeComparison();

    expect(result.isProjection).toBe(false);
    expect(result.format).toBe(12);
    expect(result.teams[0]).toMatchObject({
      name: frozenFirst.name,
      ranking: frozenFirst.ranking,
      record: frozenFirst.record,
      resumeScoreRank: frozenFirst.resumeScoreRank,
      performanceIndexRank: frozenFirst.performanceIndexRank,
    });
    expect(getAllGames).not.toHaveBeenCalled();
    expect(getGameDetailsByYear).not.toHaveBeenCalled();
    expect(loadOddsContext).not.toHaveBeenCalled();
  });

  it('returns one projected bowl slate when no games are scheduled', async () => {
    const result = await loadBowlGames();

    expect(result.games[0]).toMatchObject({
      gameId: null,
      status: 'projected',
      tier: 'other',
    });
    expect(result.games[0].teams.map(team => team.spread)).toEqual([
      expect.stringMatching(/^-/),
      null,
    ]);
    expect(result.games.every(game => game.tier !== 'playoff')).toBe(true);
    expect(loadOddsContext).toHaveBeenCalledOnce();
  });

  it.each([
    {
      format: 2 as const,
      matchups: [['National Championship', 'Team 1', 'Team 2']],
    },
    {
      format: 4 as const,
      matchups: [
        ['Playoff Semifinal', 'Team 1', 'Team 4'],
        ['Playoff Semifinal', 'Team 2', 'Team 3'],
      ],
    },
  ])('folds projected $format-team playoff games into Bowl Games', async ({ format, matchups }) => {
    const league = buildLeagueWithTeams(30, format);
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadBowlGames();
    const playoffGames = result.games.filter(game => game.tier === 'playoff');

    expect(playoffGames.map(game => [
      game.name,
      game.teams[0].name,
      game.teams[1].name,
    ])).toEqual(matchups);
    expect(playoffGames).toHaveLength(format === 2 ? 1 : 2);
    expect(playoffGames.every(game => game.status === 'projected')).toBe(true);
    expect(playoffGames.every(game =>
      Boolean(game.teams[0].spread) !== Boolean(game.teams[1].spread)
    )).toBe(true);
  });

  it('returns scheduled and final bowls in one actual slate', async () => {
    const scheduled = {
      ...buildGame(101, 1, 2, 1),
      name: 'Alamo Bowl',
      gameType: 'bowl' as const,
      winnerId: null,
      resultA: null,
      resultB: null,
      scoreA: null,
      scoreB: null,
    };
    const final = {
      ...buildGame(102, 3, 4, 4),
      name: 'Citrus Bowl',
      gameType: 'bowl' as const,
    };
    vi.mocked(getAllGames).mockResolvedValue([scheduled, final]);

    const result = await loadBowlGames();

    expect(result.games).toMatchObject([
      {
        gameId: 101,
        status: 'scheduled',
        teams: [{ spread: '-3', score: null, isWinner: false }, { spread: null }],
      },
      {
        gameId: 102,
        status: 'final',
        teams: [
          { spread: null, score: 24, isWinner: false },
          { spread: null, score: 17, isWinner: true },
        ],
      },
    ]);
    expect(loadOddsContext).not.toHaveBeenCalled();
  });

  it('keeps scheduled four-team semifinals in Bowl Games after projections become real', async () => {
    const league = buildLeagueWithTeams(30, 4);
    league.playoff.seeds = league.teams.slice(0, 4).map(team => team.id);
    const semifinals: GameRecord[] = [
      {
        ...buildGame(201, 1, 4, 1),
        name: 'Playoff semifinal',
        gameType: 'playoff_semifinal',
        winnerId: null,
        scoreA: null,
        scoreB: null,
        resultA: null,
        resultB: null,
      },
      {
        ...buildGame(202, 2, 3, 2),
        name: 'Playoff semifinal',
        gameType: 'playoff_semifinal',
        winnerId: null,
        scoreA: null,
        scoreB: null,
        resultA: null,
        resultB: null,
      },
    ];
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);
    vi.mocked(getAllGames).mockResolvedValue(semifinals);

    const result = await loadBowlGames();
    const playoffGames = result.games.filter(game => game.tier === 'playoff');

    expect(playoffGames).toHaveLength(2);
    expect(playoffGames.map(game => game.name)).toEqual([
      'Playoff Semifinal',
      'Playoff Semifinal',
    ]);
    expect(playoffGames.map(game => game.gameId)).toEqual([201, 202]);
    expect(playoffGames.every(game => game.status === 'scheduled')).toBe(true);
    expect(loadOddsContext).not.toHaveBeenCalled();
  });
});
