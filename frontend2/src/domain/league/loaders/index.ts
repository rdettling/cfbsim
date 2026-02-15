import type { Team } from '../../../types/domain';
import { getAllGames } from '../../../db/simRepo';
import { ensureRosters } from '../../roster';
import { ensureSettings, DEFAULT_SETTINGS } from '../../../types/league';
import { loadLeagueOrThrow } from '../leagueStore';
import { saveLeague } from '../../../db/leagueRepo';
import { buildScheduleGameForTeam } from '../utils/schedule';
// loadLeagueOrThrow / loadLeagueOptional live in leagueStore.ts

export const loadRankings = async () => {
  const league = await loadLeagueOrThrow();

  await ensureRosters(league);
  await saveLeague(league);

  const games = await getAllGames();
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const rankings = league.teams
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .map(team => {
      const lastWeek = league.info.currentWeek - 1;
      const currentWeek = league.info.currentWeek;
      const lastGameRecord = games.find(
        game =>
          game.weekPlayed === lastWeek &&
          (game.teamAId === team.id || game.teamBId === team.id)
      );
      const nextGameRecord = games.find(
        game =>
          game.weekPlayed === currentWeek &&
          (game.teamAId === team.id || game.teamBId === team.id)
      );

      const last_game =
        lastGameRecord && lastGameRecord.winnerId
          ? buildScheduleGameForTeam(team, lastGameRecord, teamsById)
          : null;
      const next_game = nextGameRecord
        ? buildScheduleGameForTeam(team, nextGameRecord, teamsById)
        : null;

      return {
        ...team,
        movement: team.last_rank ? team.last_rank - team.ranking : 0,
        last_game,
        next_game,
      };
    });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    rankings,
    conferences: league.conferences,
  };
};

export const loadSettings = async () => {
  const league = await loadLeagueOrThrow();

  const changed = ensureSettings(league);
  if (changed) {
    await saveLeague(league);
  }

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    settings: league.settings ?? { ...DEFAULT_SETTINGS },
  };
};
