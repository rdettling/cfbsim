import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllGames, getGameById } from '../../../db/simRepo';
import { buildTestLeague, buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import type { PlayoffTeamCount } from '../../../types/domain';
import { loadOddsContext } from '../../odds';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildPlayoffSelection } from '../utils/playoffSelection';
import { buildResumeComparisonSnapshot } from '../utils/resumeComparison';
import { loadBowlGames } from './postseason/loadBowlGames';
import { loadPlayoffBracket } from './postseason/loadPlayoffBracket';
import { loadPlayoffPicture } from './postseason/loadPlayoffPicture';
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
    vi.mocked(loadOddsContext).mockResolvedValue({ oddsMap: {}, maxDiff: 100 });
  });

  it('returns only bracket page data for the bracket route', async () => {
    const result = await loadPlayoffBracket();

    expect(result).toHaveProperty('bracket');
    expect(result).toHaveProperty('playoff_teams');
    expect(result).not.toHaveProperty('bubble_teams');
    expect(result).not.toHaveProperty('resume_teams');
    expect(result).not.toHaveProperty('bowl_games');
    expect(getAllGames).toHaveBeenCalledOnce();
  });

  it.each([2, 4, 12] as const)('uses projected rankings until a complete %i-team field is saved', async format => {
    const league = buildLeagueWithTeams(30, format);
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const projected = await loadPlayoffPicture();
    expect(projected.is_projection).toBe(true);
    expect(projected.playoff_teams).toHaveLength(format);

    league.playoff.seeds = league.teams.slice(0, format).reverse().map(team => team.id);
    const final = await loadPlayoffPicture();
    expect(final.is_projection).toBe(false);
    expect(final.playoff_teams.map(team => team.name)).toEqual(
      league.teams.slice(0, format).reverse().map(team => team.name),
    );
  });

  it('returns the five highest-ranked non-selected teams', async () => {
    const league = buildLeagueWithTeams(30);
    league.playoff.seeds = [
      ...league.teams.slice(0, 11).map(team => team.id),
      league.teams[19].id,
    ];
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadPlayoffPicture();

    expect(result.bubble_teams.map(team => team.ranking)).toEqual([12, 13, 14, 15, 16]);
    expect(result.bubble_teams.map(team => team.name)).not.toContain('Team 20');
    expect(result.conference_champions[0]).toMatchObject({
      name: 'Team 1',
      seed: 1,
      is_projected: true,
    });
    expect(result).not.toHaveProperty('resume_teams');
    expect(result).not.toHaveProperty('bracket');
    expect(getAllGames).toHaveBeenCalledOnce();
  });

  it('labels a completed conference-title winner as an actual champion', async () => {
    const league = buildLeagueWithTeams(30);
    const conferenceTeams = league.teams.slice(0, 2);
    league.teams.slice(2).forEach(team => {
      team.conference = 'Independent';
      team.confName = 'Independent';
    });
    league.conferences = [{
      ...league.conferences[0],
      championship: 100,
      finalStandings: {
        year: league.info.currentYear,
        entries: [
          { teamId: conferenceTeams[0].id, pollRank: 1, resolvedBy: null },
          { teamId: conferenceTeams[1].id, pollRank: 2, resolvedBy: null },
        ],
      },
      teams: conferenceTeams,
    }];
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);
    vi.mocked(getAllGames).mockResolvedValue([{
      ...buildGame(100, conferenceTeams[0].id, conferenceTeams[1].id, conferenceTeams[1].id),
      homeTeamId: null,
      awayTeamId: null,
      neutralSite: true,
      gameType: 'conference_championship',
      name: 'Test Conference championship',
      weekPlayed: 15,
    }]);

    const result = await loadPlayoffPicture();

    expect(result.conference_champions).toEqual([
      expect.objectContaining({ name: 'Team 2', is_projected: false }),
    ]);
  });

  it('returns every team with presentation-ready resume context', async () => {
    const league = buildLeagueWithTeams(30);
    league.playoff.seeds = league.teams.slice(0, 12).map(team => team.id);
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadResumeComparison();

    expect(result.resume_teams).toHaveLength(30);
    expect(result.resume_teams.map(team => team.ranking)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(result.resume_teams[0]).toMatchObject({
      name: 'Team 1',
      poll_score: 100,
      top_25_record: '0-0',
      best_win: null,
      worst_loss: null,
      seed: 1,
      is_autobid: true,
      has_bye: true,
      is_champ: true,
      wins_over_expectation_rank: 1,
      sos_rank: null,
    });
    expect(result.resume_teams[12]).toMatchObject({ seed: null, is_autobid: false, has_bye: false });
    expect(result.is_frozen).toBe(false);
    expect(result).not.toHaveProperty('selected_team_names');
    expect(result).not.toHaveProperty('bubble_teams');
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
    const team = result.resume_teams[0];

    expect(team.top_25_record).toBe('1-1');
    expect(team.best_win).toEqual({ opponent: 'Team 10', opponent_ranking: 10 });
    expect(team.worst_loss).toEqual({ opponent: 'Team 30', opponent_ranking: 30 });
  });

  it('reads frozen resume rows without consulting later league or game state', async () => {
    const league = buildLeagueWithTeams(30);
    league.resumeSnapshot = buildResumeComparisonSnapshot({
      league,
      games: [],
      selection: buildPlayoffSelection(league, [league.teams[0]]),
      championIds: new Set([league.teams[0].id]),
      oddsContext: { oddsMap: {}, maxDiff: 100 },
    });
    const frozenFirst = structuredClone(league.resumeSnapshot.teams[0]);
    league.teams[0].ranking = 30;
    league.teams[0].poll_score = 1;
    league.teams[0].totalLosses = 5;
    league.settings.playoffTeams = 4;
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(league);

    const result = await loadResumeComparison();

    expect(result.is_frozen).toBe(true);
    expect(result.frozen_after_week).toBe(15);
    expect(result.playoff.teams).toBe(12);
    expect(result.resume_teams[0]).toMatchObject({
      name: frozenFirst.name,
      ranking: frozenFirst.ranking,
      poll_score: frozenFirst.pollScore,
      record: frozenFirst.record,
      wins_over_expectation_rank: frozenFirst.winsOverExpectationRank,
    });
    expect(getAllGames).not.toHaveBeenCalled();
    expect(loadOddsContext).not.toHaveBeenCalled();
  });

  it('returns actual and projected bowl collections only for Bowl Games', async () => {
    const result = await loadBowlGames();

    expect(result.bowl_games).toEqual([]);
    expect(result.bowl_projections).toBeDefined();
    expect(result).not.toHaveProperty('playoff_teams');
    expect(result).not.toHaveProperty('resume_teams');
  });
});
