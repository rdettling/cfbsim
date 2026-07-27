import type { Team } from '../../../types/domain';
import { getHistoryData, getPrestigeConfig, getTeamsData } from '../../../db/baseData';
import { saveLeague } from '../../../db/leagueRepo';
import { getAllGames, getAllGameLogs, getAllPlayers, getGameById } from '../../../db/simRepo';
import { buildAwards } from '../awards';
import { loadLeagueOrThrow } from '../leagueStore';
import { calculatePrestigeChanges, getPrestigeAvgRanks } from '../prestige';
import { ensureRosters } from '../../roster';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export const loadAwards = async () => {
  const league = await loadLeagueOrThrow();
  const initializedRosters = await ensureRosters(league);
  if (initializedRosters) {
    await saveLeague(league);
  }
  const [players, gameLogs, games] = await Promise.all([
    getAllPlayers(),
    getAllGameLogs(),
    getAllGames(),
  ]);

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
  };
};

export const loadSeasonSummary = async () => {
  const league = await loadLeagueOrThrow();

  const initializedRosters = await ensureRosters(league);
  if (initializedRosters) {
    await saveLeague(league);
  }
  const envelope = buildLeagueNavigationEnvelope(league);

  if (league.info.stage !== 'summary') {
    return {
      ...envelope,
      champion: null,
      awards: [],
      teams: [],
    };
  }

  const [players, gameLogs, games, historyData, teamsData, prestigeConfig] = await Promise.all([
    getAllPlayers(),
    getAllGameLogs(),
    getAllGames(),
    getHistoryData(),
    getTeamsData(),
    getPrestigeConfig(),
  ]);

  const playedGameIds = new Set(
    games.filter(game => game.year === league.info.currentYear && game.winnerId !== null).map(game => game.id)
  );
  const yearLogs = gameLogs.filter(log => playedGameIds.has(log.gameId));
  const { final } = buildAwards(league, players, yearLogs);

  let champion: Team | null = null;
  if (league.playoff?.natty) {
    const nattyGame =
      games.find(game => game.id === league.playoff?.natty) ??
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

  return {
    ...envelope,
    champion,
    awards: final,
    teams: teamsWithAvgRanks,
  };
};
