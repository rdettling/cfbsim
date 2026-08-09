import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import { getAllGames } from '../../db/simRepo';
import { BOWL_WEEK, CONFERENCE_CHAMPIONSHIP_WEEK } from '../league/postseason';
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
});
