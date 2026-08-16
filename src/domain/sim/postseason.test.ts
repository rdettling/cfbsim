import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import { getAllGames } from '../../db/simRepo';
import { BOWL_WEEK, CONFERENCE_CHAMPIONSHIP_WEEK } from '../league/postseason';
import { buildBowlMatchups } from '../league/utils/bowlSelection';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { PlayoffTeamCount } from '../../types/domain';
import { handleSpecialWeeks } from './postseason';

const oddsContext = {
  oddsMap: {},
  maxDiff: 100,
};

const resetGames = async () => {
  const db = await getDb();
  await db.clear('games');
};

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
    conferences: [],
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

describe('postseason bowl scheduling', () => {
  beforeEach(resetGames);

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
      championship: null,
      teams: [champion, challenger],
    }];

    league.teams.forEach((team, index) => {
      team.poll_score = 100 - index * 0.5;
    });
    const pollScores = new Map(league.teams.map(team => [team.id, team.poll_score]));

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
