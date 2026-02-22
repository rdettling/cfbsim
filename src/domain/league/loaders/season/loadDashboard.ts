import { buildFullScheduleFromExisting } from '../../../scheduleBuilder';
import { initializeSimData } from '../../../sim';
import { loadLeagueOrThrow } from '../../leagueStore';
import { getCurrentYearGames, getUserSchedule, getUserTeam } from './shared';

export const loadDashboard = async () => {
  const league = await loadLeagueOrThrow();

  if (!league.scheduleBuilt) {
    const userTeam = getUserTeam(league);
    const existingGames = await getCurrentYearGames(league);
    const { newGames } = buildFullScheduleFromExisting(userTeam, league.teams, existingGames);
    league.info.stage = 'season';
    league.scheduleBuilt = true;
    await initializeSimData(league, newGames);
  }

  const userTeam = getUserTeam(league);
  const confTeams = league.teams
    .filter(team => team.conference === userTeam.conference)
    .sort((a, b) => a.ranking - b.ranking);

  const top10 = [...league.teams].sort((a, b) => a.ranking - b.ranking).slice(0, 10);

  const schedule = await getUserSchedule(league, league.info.lastWeek || 14, league.info.currentYear);
  const currentWeekIndex = Math.max(league.info.currentWeek - 1, 0);
  const prevGame = currentWeekIndex > 0 ? schedule[currentWeekIndex - 1] : null;
  const currGame = schedule[currentWeekIndex] ?? null;

  const lastWeek = Math.max(league.info.currentWeek - 1, 1);
  const games = await getCurrentYearGames(league);
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
