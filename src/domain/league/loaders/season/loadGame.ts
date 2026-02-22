import {
  getAllGameLogs,
  getAllGames,
  getAllPlayers,
  getAllPlays,
  getDrivesByGame,
  getGameById,
  getPlaysByGame,
} from '../../../../db/simRepo';
import { buildDriveResponse } from '../../../sim';
import { loadLeagueOrThrow } from '../../leagueStore';
import {
  buildLastFiveGamesForTeam,
  buildTeamStatsAndRanks,
  buildTopStartersForTeam,
} from '../../utils/gamePreview';
import { buildGameResultSummary } from '../../utils/gameResult';
import { getUserTeam } from './shared';

export const loadGame = async (gameId: number) => {
  const league = await loadLeagueOrThrow();

  const record = await getGameById(gameId);
  if (!record) {
    throw new Error('Game not found.');
  }

  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const teamA = teamsById.get(record.teamAId);
  const teamB = teamsById.get(record.teamBId);
  if (!teamA || !teamB) {
    throw new Error('Game teams not found.');
  }

  const game = {
    id: record.id,
    label: record.baseLabel,
    base_label: record.baseLabel,
    name: record.name,
    weekPlayed: record.weekPlayed,
    year: record.year,
    teamA,
    teamB,
    homeTeamId: record.homeTeamId,
    awayTeamId: record.awayTeamId,
    neutralSite: record.neutralSite,
    rankATOG: record.rankATOG,
    rankBTOG: record.rankBTOG,
    spreadA: record.spreadA,
    spreadB: record.spreadB,
    moneylineA: record.moneylineA,
    moneylineB: record.moneylineB,
    winProbA: record.winProbA,
    winProbB: record.winProbB,
    winnerId: record.winnerId,
    scoreA: record.scoreA ?? 0,
    scoreB: record.scoreB ?? 0,
    resultA: record.resultA ?? '',
    resultB: record.resultB ?? '',
    overtime: record.overtime ?? 0,
    headline: record.headline ?? null,
    headline_subtitle: record.headline_subtitle ?? null,
    headline_tags: record.headline_tags ?? null,
  };

  const [allGames, allPlays, allPlayers] = await Promise.all([
    getAllGames(),
    getAllPlays(),
    getAllPlayers(),
  ]);
  const pregameGames = allGames.filter(
    game =>
      game.year === record.year &&
      game.winnerId !== null &&
      game.weekPlayed < record.weekPlayed
  );
  const pregameGamesPlayedByTeamId = new Map<number, number>();
  pregameGames.forEach(game => {
    pregameGamesPlayedByTeamId.set(game.teamAId, (pregameGamesPlayedByTeamId.get(game.teamAId) ?? 0) + 1);
    pregameGamesPlayedByTeamId.set(game.teamBId, (pregameGamesPlayedByTeamId.get(game.teamBId) ?? 0) + 1);
  });
  const { teamStatsById, ranksByTeamId } = buildTeamStatsAndRanks(
    league.teams,
    allGames,
    allPlays,
    record
  );

  const preview = {
    teamA: {
      gamesPlayed: pregameGamesPlayedByTeamId.get(teamA.id) ?? 0,
      stats: teamStatsById.get(teamA.id)!,
      ranks: ranksByTeamId.get(teamA.id)!,
      topStarters: buildTopStartersForTeam(teamA.id, allPlayers),
      lastFiveGames: buildLastFiveGamesForTeam(teamA.id, allGames, teamsById, record),
    },
    teamB: {
      gamesPlayed: pregameGamesPlayedByTeamId.get(teamB.id) ?? 0,
      stats: teamStatsById.get(teamB.id)!,
      ranks: ranksByTeamId.get(teamB.id)!,
      topStarters: buildTopStartersForTeam(teamB.id, allPlayers),
      lastFiveGames: buildLastFiveGamesForTeam(teamB.id, allGames, teamsById, record),
    },
  };

  const gamePlays = await getPlaysByGame(gameId);
  const gameLogs = record.winnerId
    ? (await getAllGameLogs()).filter(log => log.gameId === gameId)
    : [];
  const resultSummary = record.winnerId
    ? buildGameResultSummary(game, gamePlays, gameLogs, allPlayers, teamsById)
    : null;

  const drives = record.winnerId
    ? buildDriveResponse(
        await getDrivesByGame(gameId),
        gamePlays,
        teamsById
      )
    : [];

  return {
    info: league.info,
    team: getUserTeam(league),
    conferences: league.conferences,
    game,
    preview,
    resultSummary,
    drives,
  };
};
