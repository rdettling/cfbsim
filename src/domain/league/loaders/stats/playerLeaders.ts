import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import {
  getAllGameLogs,
  getAllGames,
  getAllHistoricalPlayers,
  getPlayerSeasonsByYear,
} from '../../../../db/simRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import type { PlayerLeadersPageResult } from '../../../../types/stats';
import {
  buildPassingStats,
  buildPlayerSeasonTotals,
  buildReceivingStats,
  buildRushingStats,
  currentSeasonGameIds,
  emptyPlayerSeasonTotals,
} from '../../utils/stats/playerAggregates';
import { resolveStatisticsSeason } from './seasonContext';

const MIN_YARDS = 100;

export const loadPlayerLeaders = async (
  year?: number,
): Promise<PlayerLeadersPageResult> => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const memories = await getAllSeasonMemories();
  const season = resolveStatisticsSeason(league.info.currentYear, memories, year);
  const [gameLogs, games, archivedSeasonRows, historicalPlayers] = season.memory
    ? await Promise.all([
        Promise.resolve([]),
        Promise.resolve([]),
        getPlayerSeasonsByYear(season.selectedYear),
        getAllHistoricalPlayers(),
      ])
    : await Promise.all([
        getAllGameLogs(),
        getAllGames(),
        Promise.resolve([]),
        Promise.resolve([]),
      ]);
  const archivedSeasons = archivedSeasonRows.filter(
    playerSeason => playerSeason.year === season.selectedYear,
  );
  const totals = season.memory
    ? new Map(archivedSeasons.map(playerSeason => [playerSeason.playerId, playerSeason]))
    : buildPlayerSeasonTotals(
        gameLogs,
        currentSeasonGameIds(games, league.info.currentYear),
      );
  const identities = new Map(
    [...players, ...historicalPlayers].map(player => [player.id, player]),
  );
  const candidates = season.memory
    ? archivedSeasons.map(playerSeason => ({
        id: playerSeason.playerId,
        teamId: playerSeason.teamId,
        pos: playerSeason.position,
        starter: playerSeason.starter,
      }))
    : players;
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const snapshotsByTeamId = new Map(
    season.memory?.teamSnapshots.map(snapshot => [snapshot.teamId, snapshot]) ?? [],
  );
  const passing: PlayerLeadersPageResult['stats']['passing'] = {};
  const rushing: PlayerLeadersPageResult['stats']['rushing'] = {};
  const receiving: PlayerLeadersPageResult['stats']['receiving'] = {};

  const addIdentity = (player: (typeof candidates)[number]) => {
    const identity = identities.get(player.id);
    if (!identity) throw new Error(`Season statistics reference missing player ${player.id}.`);
    return identity;
  };
  const gamesPlayed = (teamId: number) =>
    season.memory
      ? snapshotsByTeamId.get(teamId)?.offense.games ?? 0
      : teamsById.get(teamId)?.gamesPlayed ?? 0;

  candidates.filter(player => player.starter && player.pos === 'qb').forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const identity = addIdentity(player);
    const stats = buildPassingStats(
      totals.get(player.id) ?? emptyPlayerSeasonTotals(player.id),
      gamesPlayed(team.id),
    );
    passing[String(player.id)] = {
      id: player.id,
      first: identity.first,
      last: identity.last,
      pos: player.pos,
      team: team.name,
      gamesPlayed: gamesPlayed(team.id),
      stats,
    };
  });

  candidates.filter(player => player.starter && (player.pos === 'qb' || player.pos === 'rb')).forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const identity = addIdentity(player);
    const stats = buildRushingStats(
      totals.get(player.id) ?? emptyPlayerSeasonTotals(player.id),
      gamesPlayed(team.id),
    );
    if (stats.yards < MIN_YARDS) return;
    rushing[String(player.id)] = {
      id: player.id,
      first: identity.first,
      last: identity.last,
      pos: player.pos,
      team: team.name,
      gamesPlayed: gamesPlayed(team.id),
      stats,
    };
  });

  candidates.filter(player => player.starter && ['rb', 'wr', 'te'].includes(player.pos)).forEach(player => {
    const team = teamsById.get(player.teamId);
    if (!team) return;
    const identity = addIdentity(player);
    const stats = buildReceivingStats(
      totals.get(player.id) ?? emptyPlayerSeasonTotals(player.id),
      gamesPlayed(team.id),
    );
    if (stats.yards < MIN_YARDS) return;
    receiving[String(player.id)] = {
      id: player.id,
      first: identity.first,
      last: identity.last,
      pos: player.pos,
      team: team.name,
      gamesPlayed: gamesPlayed(team.id),
      stats,
    };
  });

  return {
    info: league.info,
    team: league.teams.find(entry => entry.name === league.info.team) ?? league.teams[0],
    conferences: league.conferences,
    years: season.years,
    selectedYear: season.selectedYear,
    stats: { passing, rushing, receiving },
  };
};
