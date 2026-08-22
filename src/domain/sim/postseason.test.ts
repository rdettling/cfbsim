import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import { getAllGames } from '../../db/simRepo';
import { BOWL_WEEK, CONFERENCE_CHAMPIONSHIP_WEEK } from '../league/postseason';
import { buildBowlMatchups } from '../league/utils/bowlSelection';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { GameRecord } from '../../types/db';
import type { PlayoffTeamCount } from '../../types/domain';
import { REGULAR_SEASON_WEEKS } from '../schedule/constants';
import { handleSpecialWeeks } from './postseason';

const oddsContext = {
  oddsMap: {},
  maxDiff: 100,
};

const resetGames = async () => {
  const db = await getDb();
  await db.clear('games');
};

const regularSeasonGame = (
  id: number,
  teamAId: number,
  teamBId: number,
  winnerId: number | null,
): GameRecord => ({
  id,
  teamAId,
  teamBId,
  homeTeamId: teamAId,
  awayTeamId: teamBId,
  neutralSite: false,
  venue: null,
  winnerId,
  baseLabel: `Team ${teamAId} vs Team ${teamBId}`,
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: REGULAR_SEASON_WEEKS,
  year: 2025,
  rankATOG: teamAId,
  rankBTOG: teamBId,
  resultA: winnerId === null ? null : winnerId === teamAId ? 'W' : 'L',
  resultB: winnerId === null ? null : winnerId === teamBId ? 'W' : 'L',
  overtime: 0,
  quarter: winnerId === null ? 1 : 4,
  clockSecondsLeft: winnerId === null ? 900 : 0,
  scoreA: winnerId === null ? null : winnerId === teamAId ? 28 : 17,
  scoreB: winnerId === null ? null : winnerId === teamBId ? 28 : 17,
  watchability: winnerId === null ? 50 : 75,
});

const buildPostseasonLeague = (playoffTeams: PlayoffTeamCount) => {
  const teams = Array.from({ length: 42 }, (_, index) =>
    buildTestTeam({
      id: index + 1,
      name: `Team ${index + 1}`,
      abbreviation: `T${index + 1}`,
      conference: 'Independent',
      confName: 'Independent',
      ranking: index + 1,
      rating: 100 - index,
    })
  );

  return buildTestLeague('season', {
    info: {
      currentWeek: CONFERENCE_CHAMPIONSHIP_WEEK,
      lastRankingsWeek: CONFERENCE_CHAMPIONSHIP_WEEK - 1,
      currentYear: 2025,
      startYear: 2025,
      stage: 'season',
      team: teams[0].name,
      lastWeek: playoffTeams === 4 ? 17 : 19,
    },
    teams,
    conferences: [{
      id: 1,
      confName: 'Independent',
      confFullName: 'Independent',
      confGames: 0,
      info: '',
      championship: null,
      finalStandings: null,
      teams,
    }],
    settings: {
      conferencePolicy: 'historical',
      postseasonPolicy: 'custom',
      playoffTeams,
      playoffAutobids: 6,
      conferenceChampionsReceiveTopSeeds: true,
    },
    playoff: { seeds: [] },
    resumeSnapshot: null,
    idCounters: {
      game: 1,
      player: 1,
    },
  });
};

describe('postseason scheduling', () => {
  beforeEach(resetGames);

  it('waits for every final regular-season game before setting conference championships', async () => {
    const league = buildPostseasonLeague(2);
    const conferenceTeams = league.teams.slice(0, 2);
    conferenceTeams.forEach(team => {
      team.conference = 'Test Conference';
      team.confName = 'Test Conference';
    });
    league.info.currentWeek = REGULAR_SEASON_WEEKS;
    league.info.lastRankingsWeek = REGULAR_SEASON_WEEKS - 1;
    league.conferences = [{
      id: 1,
      confName: 'Test Conference',
      confFullName: 'Test Conference',
      confGames: 8,
      info: '',
      championship: null,
      finalStandings: null,
      teams: conferenceTeams,
    }];
    league.settings.playoffAutobids = 0;
    league.settings.conferenceChampionsReceiveTopSeeds = false;
    league.idCounters.game = 3;

    const db = await getDb();
    await db.put('games', regularSeasonGame(1, 5, 6, 5));
    await db.put('games', regularSeasonGame(2, 7, 8, null));

    await handleSpecialWeeks(league, oddsContext);

    expect(league.conferences[0].championship).toBeNull();
    expect((await getAllGames()).filter(
      game => game.gameType === 'conference_championship',
    )).toHaveLength(0);

    await db.put('games', regularSeasonGame(2, 7, 8, 7));
    await handleSpecialWeeks(league, oddsContext);
    expect(league.conferences[0].championship).toBeNull();

    league.info.lastRankingsWeek = REGULAR_SEASON_WEEKS;
    await handleSpecialWeeks(league, oddsContext);

    expect(league.conferences[0].championship).toBe(3);
    expect(league.conferences[0].finalStandings?.entries).toHaveLength(2);
    expect((await getAllGames()).filter(
      game => game.gameType === 'conference_championship',
    )).toHaveLength(1);

    await handleSpecialWeeks(league, oddsContext);
    expect((await getAllGames()).filter(
      game => game.gameType === 'conference_championship',
    )).toHaveLength(1);
  });

  it('rejects a singleton conference before allocating championship state', async () => {
    const league = buildPostseasonLeague(2);
    const onlyTeam = league.teams[0];
    onlyTeam.conference = 'Test Conference';
    onlyTeam.confName = 'Test Conference';
    league.info.currentWeek = REGULAR_SEASON_WEEKS;
    league.info.lastRankingsWeek = REGULAR_SEASON_WEEKS;
    league.conferences = [{
      id: 1,
      confName: 'Test Conference',
      confFullName: 'Test Conference',
      confGames: 0,
      info: '',
      championship: null,
      finalStandings: null,
      teams: [onlyTeam],
    }];
    const nextGameId = league.idCounters.game;

    await expect(handleSpecialWeeks(league, oddsContext))
      .rejects.toThrow('requires at least two teams');
    expect(league.idCounters.game).toBe(nextGameId);
    expect(league.conferences[0]).toMatchObject({
      championship: null,
      finalStandings: null,
    });
    expect(await getAllGames()).toEqual([]);
  });

  it.each([2, 4, 12] as const)(
    'freezes the %i-team resume snapshot before later postseason mutations',
    async playoffTeams => {
      const league = buildPostseasonLeague(playoffTeams);

      await handleSpecialWeeks(league, oddsContext);

      expect(league.resumeSnapshot).not.toBeNull();
      expect(league.resumeSnapshot).toMatchObject({
        year: 2025,
        frozenAfterWeek: CONFERENCE_CHAMPIONSHIP_WEEK,
        playoff: { teams: playoffTeams },
      });
      expect(league.resumeSnapshot!.teams).toHaveLength(league.teams.length);
      expect(league.resumeSnapshot!.teams.filter(team => team.seed)).toHaveLength(playoffTeams);
      const frozen = structuredClone(league.resumeSnapshot);

      league.teams[0].ranking = league.teams.length;
      league.teams[0].poll_score = 0;
      league.teams[0].totalLosses += 1;
      league.info.currentWeek += 1;
      await handleSpecialWeeks(league, oddsContext);

      expect(league.resumeSnapshot).toEqual(frozen);
    },
  );

  it.each([
    { playoffTeams: 4 as const, championshipWeek: 17 },
    { playoffTeams: 12 as const, championshipWeek: 19 },
  ])(
    'schedules $playoffTeams-team format bowls once in the fixed bowl week',
    async ({ playoffTeams, championshipWeek }) => {
      const league = buildPostseasonLeague(playoffTeams);

      await handleSpecialWeeks(league, oddsContext);
      await handleSpecialWeeks(league, oddsContext);

      const scheduledBowls = (await getAllGames()).filter(game =>
        game.gameType === 'bowl'
      );
      expect(scheduledBowls.length).toBeGreaterThan(0);
      expect(new Set(scheduledBowls.map(game => game.weekPlayed))).toEqual(
        new Set([BOWL_WEEK])
      );

      league.info.currentWeek = championshipWeek;
      await handleSpecialWeeks(league, oddsContext);

      const gamesAfterChampionship = await getAllGames();
      expect(
        gamesAfterChampionship.filter(game => game.gameType === 'bowl')
      ).toHaveLength(scheduledBowls.length);
      expect(
        gamesAfterChampionship.filter(
          game =>
            game.weekPlayed === championshipWeek &&
            game.gameType === 'bowl'
        )
      ).toHaveLength(0);
    }
  );

  it.each([2, 4, 12] as const)(
    'schedules the shared bowl policy for the %i-team format',
    async playoffTeams => {
      const league = buildPostseasonLeague(playoffTeams);

      await handleSpecialWeeks(league, oddsContext);

      const expected = buildBowlMatchups({
        teams: league.teams,
        playoffTeamIds: new Set(league.playoff.seeds),
        year: league.info.currentYear,
        playoffTeams,
        requireEligibility: true,
      })
        .map(matchup => ({
          name: matchup.name,
          teamAId: matchup.teamA.id,
          teamBId: matchup.teamB.id,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      const scheduled = (await getAllGames())
        .filter(game => game.gameType === 'bowl')
        .map(game => ({
          name: game.name,
          teamAId: game.teamAId,
          teamBId: game.teamBId,
        }))
        .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));

      expect(scheduled).toEqual(expected);
    },
  );

  it('hosts 12-team first-round games at the higher seeds', async () => {
    const league = buildPostseasonLeague(12);

    await handleSpecialWeeks(league, oddsContext);

    const games = (await getAllGames())
      .filter(game => game.gameType === 'playoff_first_round')
      .map(game => ({
        teamAId: game.teamAId,
        teamBId: game.teamBId,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        neutralSite: game.neutralSite,
      }));

    expect(games).toEqual([
      { teamAId: 8, teamBId: 9, homeTeamId: 8, awayTeamId: 9, neutralSite: false },
      { teamAId: 5, teamBId: 12, homeTeamId: 5, awayTeamId: 12, neutralSite: false },
      { teamAId: 7, teamBId: 10, homeTeamId: 7, awayTeamId: 10, neutralSite: false },
      { teamAId: 6, teamBId: 11, homeTeamId: 6, awayTeamId: 11, neutralSite: false },
    ]);
  });

  it('applies 12-team committee order without replacing weekly poll scores', async () => {
    const league = buildPostseasonLeague(12);
    league.settings.playoffAutobids = 1;
    league.settings.conferenceChampionsReceiveTopSeeds = true;

    const champion = league.teams[19];
    const challenger = league.teams[20];
    champion.conference = 'Test Conference';
    champion.confName = 'Test Conference';
    champion.confWins = 8;
    champion.confLosses = 0;
    challenger.conference = 'Test Conference';
    challenger.confName = 'Test Conference';
    challenger.confWins = 7;
    challenger.confLosses = 1;
    league.conferences = [{
      id: 1,
      confName: 'Test Conference',
      confFullName: 'Test Conference',
      confGames: 8,
      info: '',
      championship: 1,
      finalStandings: {
        year: 2025,
        entries: [
          { teamId: champion.id, pollRank: champion.ranking, resolvedBy: null },
          { teamId: challenger.id, pollRank: challenger.ranking, resolvedBy: null },
        ],
      },
      teams: [champion, challenger],
    }];
    league.idCounters.game = 2;

    league.teams.forEach((team, index) => {
      team.poll_score = 100 - index * 0.5;
    });
    const pollScores = new Map(league.teams.map(team => [team.id, team.poll_score]));
    const db = await getDb();
    await db.put('games', {
      ...regularSeasonGame(1, champion.id, challenger.id, champion.id),
      homeTeamId: null,
      awayTeamId: null,
      neutralSite: true,
      name: 'Test Conference championship',
      gameType: 'conference_championship',
      weekPlayed: CONFERENCE_CHAMPIONSHIP_WEEK,
    });

    await handleSpecialWeeks(league, oddsContext);

    expect(league.playoff.seeds).toEqual([
      champion.id,
      ...league.teams.slice(0, 11).map(team => team.id),
    ]);
    expect(champion).toMatchObject({ ranking: 1, last_rank: 20 });
    expect(league.teams[0]).toMatchObject({ ranking: 2, last_rank: 1 });
    expect(league.teams[10]).toMatchObject({ ranking: 12, last_rank: 11 });
    expect(league.teams[11]).toMatchObject({ ranking: 13, last_rank: 12 });
    expect(league.teams.every(team =>
      team.poll_score === pollScores.get(team.id)
    )).toBe(true);
  });
});
