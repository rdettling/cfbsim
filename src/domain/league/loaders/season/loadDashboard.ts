import type { Conference, Info, ScheduleGame, Team } from '../../../../types/domain';
import { buildUserScheduleFromGames } from '../../../schedule/projection';
import { loadLeagueOrThrow } from '../../leagueStore';
import {
  getCurrentYearGames,
  getUserTeam,
} from './shared';
import { getNewsByWeek } from '../../../../db/newsRepo';
import { sortNewsItems } from '../../../news/ordering';
import type { NewsItem } from '../../../../types/news';

export interface DashboardPageResult {
  info: Info;
  prev_game: ScheduleGame | null;
  curr_game: ScheduleGame | null;
  team: Team;
  confTeams: Team[];
  top_10: Team[];
  topStories: NewsItem[];
  conferences: Conference[];
}

export const loadDashboard = async (): Promise<DashboardPageResult> => {
  const league = await loadLeagueOrThrow();

  const userTeam = getUserTeam(league);
  const confTeams = league.teams
    .filter(team => team.conference === userTeam.conference)
    .sort((a, b) => a.ranking - b.ranking);

  const top10 = [...league.teams].sort((a, b) => a.ranking - b.ranking).slice(0, 10);

  const games = await getCurrentYearGames(league);
  const schedule = buildUserScheduleFromGames(
    userTeam,
    league.teams,
    games,
    league.info.lastWeek || 14,
  );
  const currentWeekIndex = Math.max(league.info.currentWeek - 1, 0);
  const prevGame = currentWeekIndex > 0 ? schedule[currentWeekIndex - 1] : null;
  const currGame = schedule[currentWeekIndex] ?? null;

  const lastWeek = Math.max(league.info.currentWeek - 1, 1);
  const weekStories = await getNewsByWeek(league.info.currentYear, lastWeek);
  const preseasonStories = league.info.currentWeek === 1
    ? await getNewsByWeek(league.info.currentYear, 0)
    : [];
  const topStories = sortNewsItems([...weekStories, ...preseasonStories])
    .slice(0, 5);

  return {
    info: league.info,
    prev_game: prevGame,
    curr_game: currGame,
    team: userTeam,
    confTeams,
    top_10: top10,
    topStories,
    conferences: league.conferences,
  };
};
