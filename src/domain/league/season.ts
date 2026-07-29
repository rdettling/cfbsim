import { ROUTES } from '../../constants/routes';
import { buildFullScheduleFromExisting } from '../scheduleBuilder';
import { initializeSimData } from '../sim';
import { loadLeagueOrThrow } from './leagueStore';
import {
  getCurrentYearGames,
  getUserTeam,
} from './loaders/season/shared';

export const initializeSeason = async (expectedYear: number) => {
  const league = await loadLeagueOrThrow();
  if (
    league.info.stage !== 'preseason' ||
    league.info.currentYear !== expectedYear
  ) {
    throw new Error(
      `Cannot initialize season ${expectedYear}; the persisted league is at ${league.info.stage} ${league.info.currentYear}.`,
    );
  }
  if (league.scheduleBuilt || league.simInitialized) {
    throw new Error('The preseason already contains initialized season data.');
  }

  const userTeam = getUserTeam(league);
  const existingGames = await getCurrentYearGames(league);
  const { newGames } = buildFullScheduleFromExisting(
    userTeam,
    league.teams,
    existingGames,
  );
  league.info.stage = 'season';
  league.scheduleBuilt = true;
  await initializeSimData(league, newGames);

  return {
    stage: league.info.stage,
    year: league.info.currentYear,
    route: ROUTES.DASHBOARD,
  };
};
