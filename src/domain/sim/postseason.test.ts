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
    idCounters: {
      game: 1,
      player: 1,
    },
  });
};

describe('postseason bowl scheduling', () => {
  beforeEach(resetGames);

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
        game.name?.includes('Bowl')
      );
      expect(scheduledBowls.length).toBeGreaterThan(0);
      expect(new Set(scheduledBowls.map(game => game.weekPlayed))).toEqual(
        new Set([BOWL_WEEK])
      );

      league.info.currentWeek = championshipWeek;
      await handleSpecialWeeks(league, oddsContext);

      const gamesAfterChampionship = await getAllGames();
      expect(
        gamesAfterChampionship.filter(game => game.name?.includes('Bowl'))
      ).toHaveLength(scheduledBowls.length);
      expect(
        gamesAfterChampionship.filter(
          game =>
            game.weekPlayed === championshipWeek &&
            game.name?.includes('Bowl')
        )
      ).toHaveLength(0);
    }
  );
});
