import { listAvailableTeams as listTeamsForWeek } from '../../../scheduleBuilder';
import { loadLeagueOptional } from '../../leagueStore';
import { getCurrentYearGames, getUserSchedule, getUserTeam } from './shared';

export const listAvailableTeams = async (week: number): Promise<string[]> => {
  const league = await loadLeagueOptional();
  if (!league) return [];

  const userTeam = getUserTeam(league);
  const schedule = await getUserSchedule(league, undefined, league.info.currentYear);
  const games = await getCurrentYearGames(league);
  return listTeamsForWeek(schedule, userTeam, league.teams, week, games);
};
