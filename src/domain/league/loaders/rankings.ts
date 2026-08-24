import { getAllGames } from '../../../db/simRepo';
import type { GameRecord } from '../../../types/db';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildScheduleGameForTeam } from '../utils/scheduleView';
// loadLeagueOrThrow / loadLeagueOptional live in leagueStore.ts

const buildGamesByTeam = (games: GameRecord[]) => {
  const byTeam = new Map<number, GameRecord[]>();
  games.forEach(game => {
    [game.teamAId, game.teamBId].forEach(teamId => {
      const teamGames = byTeam.get(teamId) ?? [];
      teamGames.push(game);
      byTeam.set(teamId, teamGames);
    });
  });
  return byTeam;
};

export const loadRankings = async () => {
  const league = await loadLeagueOrThrow();

  const games = (await getAllGames()).filter(game => game.year === league.info.currentYear);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const gamesByTeam = buildGamesByTeam(games);
  const playoffTeamIds = new Set(league.playoff.seeds);

  const rankings = league.teams
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .map(team => {
      const teamGames = gamesByTeam.get(team.id) ?? [];
      const lastWeekRecord = teamGames.find(
        game => game.weekPlayed === league.info.currentWeek - 1,
      );
      const currentWeekRecord = teamGames.find(
        game => game.weekPlayed === league.info.currentWeek,
      );

      const last_week =
        lastWeekRecord?.winnerId
          ? buildScheduleGameForTeam(team, lastWeekRecord, teamsById)
          : null;
      const current_week = currentWeekRecord
        ? buildScheduleGameForTeam(team, currentWeekRecord, teamsById)
        : null;

      return {
        ...team,
        movement: team.last_rank ? team.last_rank - team.ranking : 0,
        isPlayoffTeam: playoffTeamIds.has(team.id),
        last_week,
        current_week,
      };
    });

  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    rankings,
    conferences: league.conferences,
  };
};
