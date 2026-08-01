import type { NonConData } from '../../../../types/league';
import { loadLeagueOrThrow } from '../../leagueStore';
import { buildLeagueNavigationEnvelope } from '../navigationEnvelope';
import { getRivalriesData } from '../../../../db/baseData';
import { buildUserScheduleFromGames } from '../../../schedule/projection';
import { getCurrentYearGames, getUserTeam } from './shared';
import {
  resolveRivalries,
  withoutDeclinedRivalries,
} from '../../../rivalryScheduling';
import { buildNonConData } from './nonConData';

export const loadNonCon = async (): Promise<NonConData> => {
  const league = await loadLeagueOrThrow();

  const envelope = buildLeagueNavigationEnvelope(league);
  if (league.info.stage !== 'preseason') {
    return {
      ...envelope,
      schedule: [],
      pending_rivalries: [],
      rivalryWarnings: [],
    };
  }

  const games = await getCurrentYearGames(league);
  const schedule = buildUserScheduleFromGames(
    getUserTeam(league),
    league.teams,
    games,
  );
  const rivalryResolution = resolveRivalries({
    teams: league.teams,
    rivalries: withoutDeclinedRivalries(
      await getRivalriesData(),
      league.declinedRivalries,
    ),
    existingGames: games,
    year: league.info.currentYear,
  });
  return buildNonConData(league, schedule, rivalryResolution);
};
