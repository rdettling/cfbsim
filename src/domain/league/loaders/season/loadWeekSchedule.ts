import { getAllGames } from '../../../../db/simRepo';
import { saveLeague } from '../../../../db/leagueRepo';
import { loadLeagueOrThrow } from '../../leagueStore';
import { ensureRosters } from '../../../roster';
import { getUserTeam } from './shared';

export const loadWeekSchedule = async (week: number) => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const games = await getAllGames();
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const weekGames = games
    .filter(game => game.weekPlayed === week && game.year === league.info.currentYear)
    .map(game => {
      const teamA = teamsById.get(game.teamAId)!;
      const teamB = teamsById.get(game.teamBId)!;
      return {
        id: game.id,
        label: game.baseLabel,
        base_label: game.baseLabel,
        teamA,
        teamB,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        neutralSite: game.neutralSite,
        rankATOG: game.rankATOG,
        rankBTOG: game.rankBTOG,
        scoreA: game.scoreA ?? undefined,
        scoreB: game.scoreB ?? undefined,
        spreadA: game.spreadA,
        spreadB: game.spreadB,
        winner: Boolean(game.winnerId),
        overtime: game.overtime,
        watchability: game.watchability ?? 0,
      };
    })
    .sort((a, b) => b.watchability - a.watchability);

  return {
    info: league.info,
    team: getUserTeam(league),
    games: weekGames,
    conferences: league.conferences,
  };
};
