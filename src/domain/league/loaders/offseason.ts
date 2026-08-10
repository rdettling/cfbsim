import type { Team } from '../../../types/domain';
import {
  getHistoryData,
  getPrestigeConfig,
  getRivalriesData,
  getTeamsData,
} from '../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import {
  getAllGames,
  getAllGameLogs,
  getAllPlays,
  getAllHistoricalPlayers,
  getAllPlayerSeasons,
  getGameById,
} from '../../../db/simRepo';
import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import { buildAwards, getAwardName } from '../awards';
import { calculatePrestigeChanges, getPrestigeAvgRanks } from '../prestige';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';
import { buildSeasonMemory } from '../memory';
import {
  buildSeasonMilestones,
  buildTeamAccomplishments,
  formatAwardStats,
  selectSignatureGames,
} from '../memoryProjection';

export const loadAwards = async () => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const [gameLogs, games, memories, historicalPlayers, playerSeasons] = await Promise.all([
    getAllGameLogs(),
    getAllGames(),
    getAllSeasonMemories(),
    getAllHistoricalPlayers(),
    getAllPlayerSeasons(),
  ]);
  const identities = new Map(
    [...players, ...historicalPlayers].map(player => [player.id, player]),
  );
  const seasonsByKey = new Map(
    playerSeasons.map(season => [`${season.year}:${season.playerId}`, season]),
  );
  const teamsById = new Map(league.teams.map(team => [team.id, team]));

  const playedGameIds = new Set(
    games.filter(game => game.year === league.info.currentYear && game.winnerId !== null).map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const { favorites, final } = buildAwards(league, players, yearLogs);

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    favorites,
    final: league.info.stage === 'summary' ? final : [],
    history: memories.map(memory => ({
      year: memory.year,
      winners: memory.awards.flatMap(winner => {
        const player = identities.get(winner.playerId);
        const season = seasonsByKey.get(`${memory.year}:${winner.playerId}`);
        const winnerTeam = teamsById.get(winner.teamId);
        if (!player || !season || !winnerTeam) return [];
        return [{
          ...winner,
          categoryName: getAwardName(winner.categorySlug),
          first: player.first,
          last: player.last,
          position: player.pos,
          teamName: winnerTeam.name,
          statLine: formatAwardStats(season),
        }];
      }),
    })),
  };
};

export const loadSeasonSummary = async () => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const envelope = buildLeagueNavigationEnvelope(league);

  if (league.info.stage !== 'summary') {
    return {
      ...envelope,
      champion: null,
      awards: [],
      teams: [],
      legacy: null,
    };
  }

  const [
    gameLogs,
    games,
    historyData,
    teamsData,
    prestigeConfig,
    priorMemories,
    rivalries,
    plays,
  ] = await Promise.all([
    getAllGameLogs(),
    getAllGames(),
    getHistoryData(),
    getTeamsData(),
    getPrestigeConfig(),
    getAllSeasonMemories(),
    getRivalriesData(),
    getAllPlays(),
  ]);

  const playedGameIds = new Set(
    games.filter(game => game.year === league.info.currentYear && game.winnerId !== null).map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const { final } = buildAwards(league, players, yearLogs);
  const memory = buildSeasonMemory(league, games, players, yearLogs, plays);

  let champion: Team | null = null;
  if (league.playoff.natty) {
    const nattyGame =
      games.find(game => game.id === league.playoff.natty) ??
      (await getGameById(league.playoff.natty));
    if (nattyGame?.winnerId) {
      champion = league.teams.find(team => team.id === nattyGame.winnerId) ?? null;
    }
  }

  const displayLeague =
    league.info.stage === 'summary' ? structuredClone(league) : league;
  const avgRanks = league.info.stage === 'summary'
    ? calculatePrestigeChanges(
        displayLeague,
        historyData,
        teamsData,
        prestigeConfig,
      )
    : getPrestigeAvgRanks(displayLeague, historyData);

  const teamsWithAvgRanks = displayLeague.teams.map(team => ({
    ...team,
    avg_rank_before: avgRanks[team.name]?.before ?? null,
    avg_rank_after: avgRanks[team.name]?.after ?? null,
  }));
  const userTeam =
    league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const gamesById = new Map(games.map(game => [game.id, game]));
  const previousRows = (historyData.teams[userTeam.name] ?? []).filter(
    row => row[0] >= league.info.startYear && row[0] < league.info.currentYear,
  );
  const legacy = {
    accomplishments: buildTeamAccomplishments(
      userTeam.id,
      memory,
      gamesById,
    ),
    signatureGames: selectSignatureGames({
      teamId: userTeam.id,
      memory,
      games: games.filter(game => game.year === league.info.currentYear),
      teams: league.teams,
      rivalries,
    }),
    milestones: buildSeasonMilestones({
      teamId: userTeam.id,
      current: memory,
      previous: priorMemories,
      games,
      currentWins: userTeam.totalWins,
      currentRank: userTeam.ranking,
      previousRows,
    }),
  };

  return {
    ...envelope,
    champion,
    awards: final,
    teams: teamsWithAvgRanks,
    legacy,
  };
};
