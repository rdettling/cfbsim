import type { LaunchProps } from '../../../types/league';
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

export const loadHomeData = async (year?: string): Promise<LaunchProps> => {
  const yearsIndex = await getYearsIndex();
  const years = yearsIndex.years;
  const selectedYear = year || years[0] || null;
  const preview = selectedYear ? await buildPreviewData(selectedYear) : null;
  const league = await loadLeagueOptional();

  return {
    info: league?.info ?? null,
    years,
    preview,
    selected_year: selectedYear,
  };
};
