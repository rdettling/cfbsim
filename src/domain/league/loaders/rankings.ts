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

const latestCompletedGame = (games: GameRecord[]) => games
  .filter(game => game.winnerId !== null)
  .sort((left, right) =>
    right.weekPlayed - left.weekPlayed || right.id - left.id
  )[0] ?? null;

const earliestUpcomingGame = (games: GameRecord[]) => games
  .filter(game => game.winnerId === null)
  .sort((left, right) =>
    left.weekPlayed - right.weekPlayed || left.id - right.id
  )[0] ?? null;

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
      const lastGameRecord = latestCompletedGame(teamGames);
      const nextGameRecord = earliestUpcomingGame(teamGames);

      const last_game =
        lastGameRecord
          ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
          : null;
      const next_game = nextGameRecord
        ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
        : null;

      return {
        ...team,
        movement: team.last_rank ? team.last_rank - team.ranking : 0,
        isPlayoffTeam: playoffTeamIds.has(team.id),
        last_game,
        next_game,
      };
    });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    rankings,
    conferences: league.conferences,
    hasUpcomingGames: games.some(game => game.winnerId === null),
  };
};
