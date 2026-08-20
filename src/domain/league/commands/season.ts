import { ROUTES } from '../../../constants/routes';
import { loadLeagueOrThrow } from '../leagueStore';
import { getCurrentYearGames } from '../loaders/season/shared';
import { initializeSeasonSchedule } from '../seasonInitialization';

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

  const existingGames = await getCurrentYearGames(league);
  await initializeSeasonSchedule(league, existingGames);

  return {
    stage: league.info.stage,
    year: league.info.currentYear,
    route: ROUTES.DASHBOARD,
  };
};
