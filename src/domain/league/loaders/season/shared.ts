import { getRatingsData, getYearData, getYearsIndex } from '../../../../db/baseData';
import { getAllGames } from '../../../../db/simRepo';
import type { Team } from '../../../../types/domain';
import type { LeagueState } from '../../../../types/league';
import { buildUserScheduleFromGames } from '../../../scheduleBuilder';

export const getUserTeam = (league: LeagueState): Team =>
  league.teams.find(team => team.name === league.info.team) ?? league.teams[0];

export const getCurrentYearGames = async (league: LeagueState) =>
  (await getAllGames()).filter(game => game.year === league.info.currentYear);

export const getUserSchedule = async (league: LeagueState, weeks?: number, year?: number) => {
  const userTeam = getUserTeam(league);
  const games =
    year && year !== league.info.currentYear
      ? (await getAllGames()).filter(game => game.year === year)
      : await getCurrentYearGames(league);
  return buildUserScheduleFromGames(userTeam, league.teams, games, weeks);
};

export const primeHistoryData = async (startYear: number) => {
  const yearsIndex = await getYearsIndex();
  const years = yearsIndex.years
    .map(entry => Number(entry))
    .filter(year => year < startYear);

  await Promise.all(
    years.map(async year => {
      await Promise.all([getRatingsData(String(year)), getYearData(String(year))]);
    })
  );
};
