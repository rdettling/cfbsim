import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import {
  getAllGameLogs,
  getAllGames,
  getAllHistoricalPlayers,
  getAllPlays,
  getPlayerSeasonsByYearTeam,
} from '../../../../db/simRepo';
import type { PlayerRecord } from '../../../../types/db';
import type { Team } from '../../../../types/domain';
import type { TeamStatsPageResult } from '../../../../types/stats';
import { resolveStatisticsSeason } from '../stats/seasonContext';
import {
  buildDefenseStats,
  buildKickingStats,
  buildPassingStats,
  buildPlayerSeasonTotals,
  buildReceivingStats,
  buildRushingStats,
  currentSeasonGameIds,
  emptyPlayerSeasonTotals,
  type PlayerSeasonTotals,
} from '../../utils/stats/playerAggregates';
import {
  buildTeamAggregateRanks,
  buildTeamAggregateTables,
  projectArchivedTeamAggregateTables,
} from '../../utils/stats/teamAggregates';
import { listTeamNames, resolveTeam } from './shared';

interface PlayerStatsCandidate {
  id: number;
  first: string;
  last: string;
  pos: string;
  total: PlayerSeasonTotals;
}

const buildTeamPlayerStats = (
  candidates: PlayerStatsCandidate[],
  gamesPlayed: number,
): TeamStatsPageResult['playerStats'] => {
  const playerStats: TeamStatsPageResult['playerStats'] = {
    passing: [],
    rushing: [],
    receiving: [],
    defense: [],
    kicking: [],
  };

  candidates.forEach(player => {
    const identity = {
      id: player.id,
      first: player.first,
      last: player.last,
      pos: player.pos,
    };
    const total = player.total;
    if (total.pass_attempts > 0) {
      playerStats.passing.push({
        ...identity,
        stats: buildPassingStats(total, gamesPlayed),
      });
    }
    if (total.rush_attempts > 0 || total.fumbles > 0) {
      playerStats.rushing.push({
        ...identity,
        stats: buildRushingStats(total, gamesPlayed),
      });
    }
    if (total.receiving_catches > 0) {
      playerStats.receiving.push({
        ...identity,
        stats: buildReceivingStats(total, gamesPlayed),
      });
    }
    if (
      total.tackles > 0 ||
      total.sacks > 0 ||
      total.interceptions > 0 ||
      total.fumbles_forced > 0 ||
      total.fumbles_recovered > 0
    ) {
      playerStats.defense.push({ ...identity, stats: buildDefenseStats(total) });
    }
    if (total.field_goals_attempted > 0 || total.extra_points_attempted > 0) {
      playerStats.kicking.push({ ...identity, stats: buildKickingStats(total) });
    }
  });
  return playerStats;
};

const historicalTeam = (
  team: Team,
  snapshot: NonNullable<
    ReturnType<typeof resolveStatisticsSeason>['memory']
  >['teamSnapshots'][number],
): Team => ({
  ...team,
  confName: snapshot.conference,
  conference: snapshot.conference,
  rating: snapshot.rating,
  prestige: snapshot.prestige,
  ranking: snapshot.ranking,
  record: snapshot.record,
  gamesPlayed: snapshot.offense.games,
});

export const loadTeamStats = async (
  teamName?: string,
  year?: number,
): Promise<TeamStatsPageResult> => {
  const { league, players } = await loadLeaguePlayersSnapshot();
  const memories = await getAllSeasonMemories();
  const season = resolveStatisticsSeason(league.info.currentYear, memories, year);

  let team: Team;
  let teams: string[];
  let aggregateTables;
  let candidates: PlayerStatsCandidate[];

  if (season.memory) {
    const snapshotsByTeamId = new Map(
      season.memory.teamSnapshots.map(snapshot => [snapshot.teamId, snapshot]),
    );
    const availableTeams = league.teams.filter(candidate =>
      snapshotsByTeamId.has(candidate.id),
    );
    const resolved =
      availableTeams.find(candidate => candidate.name === teamName) ??
      availableTeams.find(candidate => candidate.name === league.info.team) ??
      availableTeams[0];
    if (!resolved) throw new Error(`Season ${season.selectedYear} has no team statistics.`);
    const snapshot = snapshotsByTeamId.get(resolved.id)!;
    team = historicalTeam(resolved, snapshot);
    teams = availableTeams
      .map(candidate => candidate.name)
      .sort((left, right) => left.localeCompare(right));
    aggregateTables = projectArchivedTeamAggregateTables(
      league.teams,
      season.memory.teamSnapshots,
    );
    const [playerSeasons, historicalPlayers] = await Promise.all([
      getPlayerSeasonsByYearTeam(season.selectedYear, team.id),
      getAllHistoricalPlayers(),
    ]);
    const identities = new Map(
      [...players, ...historicalPlayers].map(player => [player.id, player]),
    );
    candidates = playerSeasons.map(playerSeason => {
      const identity = identities.get(playerSeason.playerId);
      if (!identity) {
        throw new Error(`Season statistics reference missing player ${playerSeason.playerId}.`);
      }
      return {
        id: playerSeason.playerId,
        first: identity.first,
        last: identity.last,
        pos: playerSeason.position,
        total: playerSeason,
      };
    });
  } else {
    team = resolveTeam(league, teamName);
    teams = listTeamNames(league);
    const [games, plays, gameLogs] = await Promise.all([
      getAllGames(),
      getAllPlays(),
      getAllGameLogs(),
    ]);
    aggregateTables = buildTeamAggregateTables(
      league.teams,
      games,
      plays,
      league.info.currentYear,
    );
    const totals = buildPlayerSeasonTotals(
      gameLogs,
      currentSeasonGameIds(games, league.info.currentYear),
    );
    candidates = players
      .filter(player => player.teamId === team.id)
      .map((player: PlayerRecord) => ({
        id: player.id,
        first: player.first,
        last: player.last,
        pos: player.pos,
        total: totals.get(player.id) ?? emptyPlayerSeasonTotals(player.id),
      }));
  }

  const offenseRanks = buildTeamAggregateRanks(aggregateTables.offense, 'offense');
  const defenseRanks = buildTeamAggregateRanks(aggregateTables.defense, 'defense');
  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team,
    teams,
    conferences: league.conferences,
    years: season.years,
    selectedYear: season.selectedYear,
    teamStats: {
      offense: {
        values: aggregateTables.offense[team.name],
        ranks: offenseRanks.get(team.name)!,
      },
      defense: {
        values: aggregateTables.defense[team.name],
        ranks: defenseRanks.get(team.name)!,
      },
    },
    playerStats: buildTeamPlayerStats(candidates, team.gamesPlayed),
  };
};
