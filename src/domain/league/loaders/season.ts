import {
  NewLeagueConfigurationError,
  type HomeData,
  type NewLeagueData,
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
export { loadNews } from './season/loadNews';
export { startNewLeague } from './season/startNewLeague';
export { loadNonCon } from './season/loadNonCon';
export { listAvailableTeams } from './season/listAvailableTeams';
export { scheduleNonConGame } from './season/scheduleNonConGame';
export {
  dismissPendingRivalry,
  removePreseasonGame,
} from './season/removePreseasonScheduleItem';

export const loadHomeData = async (): Promise<HomeData> => {
  const league = await loadLeagueOptional();
  if (!league) return { info: null, program: null };

  const team = league.teams.find(candidate => candidate.name === league.info.team);
  if (!team) {
    throw new Error(`The saved program ${league.info.team} is unavailable.`);
  }

  return {
    info: league.info,
    program: {
      name: team.name,
      record: team.record,
      ranking: team.ranking,
      conference: team.confName ?? team.conference,
      rating: team.rating,
      colorPrimary: team.colorPrimary,
    },
  };
};

export const loadNewLeagueData = async (
  year?: string,
): Promise<NewLeagueData> => {
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

  return {
    years,
    preview,
    selectedYear,
  };
};
