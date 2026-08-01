import type { Conference, Info, ScheduleGame, Team } from '../../../../types/domain';
import { buildUserScheduleFromGames } from '../../../schedule/projection';
import { loadLeagueOrThrow } from '../../leagueStore';
import {
  getCurrentYearGames,
  getUserTeam,
} from './shared';

export interface DashboardHeadline {
  id: number;
  headline: string;
  subtitle: string | null;
  tags: string[];
}

export interface DashboardPageResult {
  info: Info;
  prev_game: ScheduleGame | null;
  curr_game: ScheduleGame | null;
  team: Team;
  confTeams: Team[];
  top_10: Team[];
  top_games: DashboardHeadline[];
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
  const top_games = games
    .filter(
      game =>
        game.weekPlayed === lastWeek &&
        game.winnerId !== null &&
        game.headline
    )
    .sort((a, b) => (b.watchability ?? 0) - (a.watchability ?? 0))
    .slice(0, 5)
    .map(game => ({
      id: game.id,
      headline: game.headline ?? '',
      subtitle: game.headline_subtitle ?? null,
      tags: game.headline_tags ?? [],
    }));

  return {
    info: league.info,
    prev_game: prevGame,
    curr_game: currGame,
    team: userTeam,
    confTeams,
    top_10: top10,
    top_games,
    conferences: league.conferences,
  };
};
