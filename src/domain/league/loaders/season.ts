import {
  NewLeagueConfigurationError,
  type LaunchProps,
} from '../../../types/league';
import {
  getYearsIndex,
} from '../../../db/baseData';
import { buildPreviewData } from '../../baseData';
import { loadLeagueOptional } from '../leagueStore';
export { loadGame } from './season/loadGame';
export { loadTeamSchedule } from './season/loadTeamSchedule';
export { loadWeekSchedule } from './season/loadWeekSchedule';
export { loadDashboard } from './season/loadDashboard';
export { startNewLeague } from './season/startNewLeague';
export { loadNonCon } from './season/loadNonCon';
export { listAvailableTeams } from './season/listAvailableTeams';
export { scheduleNonConGame } from './season/scheduleNonConGame';
export {
  dismissPendingRivalry,
  removePreseasonGame,
} from './season/removePreseasonScheduleItem';

export const loadHomeData = async (year?: string): Promise<LaunchProps> => {
  const yearsIndex = await getYearsIndex();
  const years = Array.isArray(yearsIndex.years)
    ? yearsIndex.years.filter(
        candidate => typeof candidate === 'string' && candidate.length > 0,
      )
    : [];
  const selectedYear = year || years[0] || null;
  if (year && !years.includes(year)) {
    throw new NewLeagueConfigurationError(
      `The ${year} season is not supported.`,
    );
  }
  const preview = selectedYear ? await buildPreviewData(selectedYear) : null;
  const league = await loadLeagueOptional();

  return {
    info: league?.info ?? null,
    years,
    preview,
    selected_year: selectedYear,
  };
};
