import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import { loadLeaguePlayersSnapshot } from '../../../db/leagueRepo';
import {
  getAllHistoricalPlayers,
  getGamesByYear,
  getPlayerSeasonsByYear,
} from '../../../db/simRepo';
import type { GameRecord } from '../../../types/db';
import type { Team } from '../../../types/domain';
import {
  SeasonMemoryDataIntegrityError,
  type SeasonMemory,
  type SeasonTeamSnapshot,
} from '../../../types/memory';
import { getAwardName } from '../awards';
import { formatAwardStats, buildTeamAccomplishments } from '../memoryProjection';
import type {
  BowlGameEntry,
  PlayoffBracket,
  PlayoffMatchup,
} from './playoff';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export interface LeagueHistoryTeam {
  id: number;
  name: string;
  conference: string;
  record: string;
  ranking: number;
  rating: number;
  prestige: number;
}

const requireValue = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new SeasonMemoryDataIntegrityError(message);
  }
  return value;
};

const toHistoryTeam = (
  teamId: number,
  teamsById: Map<number, Team>,
  snapshotsByTeamId: Map<number, SeasonTeamSnapshot>,
  year: number,
): LeagueHistoryTeam => {
  const team = requireValue(
    teamsById.get(teamId),
    `Season ${year} references missing team ${teamId}.`,
  );
  const snapshot = requireValue(
    snapshotsByTeamId.get(teamId),
    `Season ${year} is missing the ${team.name} team snapshot.`,
  );
  return {
    id: team.id,
    name: team.name,
    conference: snapshot.conference,
    record: snapshot.record,
    ranking: snapshot.ranking,
    rating: snapshot.rating,
    prestige: snapshot.prestige,
  };
};

const buildMatchup = (
  gameId: number,
  memory: SeasonMemory,
  gamesById: Map<number, GameRecord>,
  teamsById: Map<number, Team>,
  id?: string,
  nextGame?: string,
): PlayoffMatchup => {
  const game = requireValue(
    gamesById.get(gameId),
    `Season ${memory.year} references missing playoff game ${gameId}.`,
  );
  const teamA = requireValue(
    teamsById.get(game.teamAId),
    `Season ${memory.year} playoff game ${gameId} references a missing team.`,
  );
  const teamB = requireValue(
    teamsById.get(game.teamBId),
    `Season ${memory.year} playoff game ${gameId} references a missing team.`,
  );
  const seed = (teamId: number) => {
    const index = memory.postseason.playoff.seeds.indexOf(teamId);
    return index < 0 ? null : index + 1;
  };
  return {
    id,
    next_game: nextGame,
    game_id: game.id,
    team1: teamA.name,
    team2: teamB.name,
    seed1: seed(teamA.id),
    seed2: seed(teamB.id),
    score1: game.scoreA,
    score2: game.scoreB,
    winner:
      game.winnerId === teamA.id
        ? teamA.name
        : game.winnerId === teamB.id
          ? teamB.name
          : null,
  };
};

const buildArchivedBracket = (
  memory: SeasonMemory,
  gamesById: Map<number, GameRecord>,
  teamsById: Map<number, Team>,
): PlayoffBracket => {
  const playoff = memory.postseason.playoff;
  const matchup = (gameId: number, id?: string, nextGame?: string) =>
    buildMatchup(gameId, memory, gamesById, teamsById, id, nextGame);
  if (playoff.format === 2) {
    return { championship: matchup(playoff.games.championship, 'championship') };
  }
  if (playoff.format === 4) {
    return {
      semifinals: [
        matchup(playoff.games.leftSemifinal, 'left_semi', 'championship'),
        matchup(playoff.games.rightSemifinal, 'right_semi', 'championship'),
      ],
      championship: matchup(playoff.games.championship, 'championship'),
    };
  }
  return {
    left_bracket: {
      first_round: [
        matchup(playoff.games.leftFirstRound1, 'left_r1_1', 'left_quarter_1'),
        matchup(playoff.games.leftFirstRound2, 'left_r1_2', 'left_quarter_2'),
      ],
      quarterfinals: [
        matchup(playoff.games.leftQuarterfinal1, 'left_quarter_1', 'left_semi'),
        matchup(playoff.games.leftQuarterfinal2, 'left_quarter_2', 'left_semi'),
      ],
      semifinal: matchup(playoff.games.leftSemifinal, 'left_semi', 'championship'),
    },
    right_bracket: {
      first_round: [
        matchup(playoff.games.rightFirstRound1, 'right_r1_1', 'right_quarter_1'),
        matchup(playoff.games.rightFirstRound2, 'right_r1_2', 'right_quarter_2'),
      ],
      quarterfinals: [
        matchup(playoff.games.rightQuarterfinal1, 'right_quarter_1', 'right_semi'),
        matchup(playoff.games.rightQuarterfinal2, 'right_quarter_2', 'right_semi'),
      ],
      semifinal: matchup(playoff.games.rightSemifinal, 'right_semi', 'championship'),
    },
    championship: matchup(playoff.games.championship, 'championship'),
  };
};

const buildBowlEntries = (
  memory: SeasonMemory,
  gamesById: Map<number, GameRecord>,
  teamsById: Map<number, Team>,
  snapshotsByTeamId: Map<number, SeasonTeamSnapshot>,
): BowlGameEntry[] => {
  const championIds = new Set(
    memory.postseason.conferenceChampions.map(entry => entry.teamId),
  );
  return memory.postseason.bowls.map(entry => {
    const game = requireValue(
      gamesById.get(entry.gameId),
      `Season ${memory.year} references missing bowl game ${entry.gameId}.`,
    );
    const teamA = requireValue(teamsById.get(game.teamAId), 'Bowl team is missing.');
    const teamB = requireValue(teamsById.get(game.teamBId), 'Bowl team is missing.');
    const snapshotA = requireValue(
      snapshotsByTeamId.get(teamA.id),
      `Season ${memory.year} is missing the ${teamA.name} snapshot.`,
    );
    const snapshotB = requireValue(
      snapshotsByTeamId.get(teamB.id),
      `Season ${memory.year} is missing the ${teamB.name} snapshot.`,
    );
    return {
      id: game.id,
      name: entry.name,
      week: game.weekPlayed,
      teamA: teamA.name,
      teamB: teamB.name,
      teamA_conf: snapshotA.conference,
      teamB_conf: snapshotB.conference,
      teamA_is_champ: championIds.has(teamA.id),
      teamB_is_champ: championIds.has(teamB.id),
      rankA: game.rankATOG,
      rankB: game.rankBTOG,
      recordA: snapshotA.record,
      recordB: snapshotB.record,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      winner:
        game.winnerId === teamA.id
          ? teamA.name
          : game.winnerId === teamB.id
            ? teamB.name
            : null,
      is_ny6: entry.tier === 'ny6',
      is_projection: false,
    };
  });
};

export const loadLeagueHistory = async (requestedYear?: number) => {
  if (requestedYear !== undefined && !Number.isInteger(requestedYear)) {
    throw new Error('Invalid league history season.');
  }
  const { league, players } = await loadLeaguePlayersSnapshot();
  const memories = await getAllSeasonMemories();
  const years = memories.map(memory => memory.year);
  const envelope = buildLeagueNavigationEnvelope(league);
  if (!memories.length) return { ...envelope, years, season: null };

  const selectedYear = requestedYear ?? years[0];
  const memory = memories.find(entry => entry.year === selectedYear);
  if (!memory) {
    throw new Error(`League history is unavailable for the ${selectedYear} season.`);
  }

  const [games, historicalPlayers, playerSeasons] = await Promise.all([
    getGamesByYear(selectedYear),
    getAllHistoricalPlayers(),
    getPlayerSeasonsByYear(selectedYear),
  ]);
  const gamesById = new Map(games.map(game => [game.id, game]));
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const snapshotsByTeamId = new Map(
    memory.teamSnapshots.map(snapshot => [snapshot.teamId, snapshot]),
  );
  const identitiesById = new Map(
    [...players, ...historicalPlayers].map(player => [player.id, player]),
  );
  const playerSeasonsById = new Map(
    playerSeasons.map(season => [season.playerId, season]),
  );
  const championshipGame = requireValue(
    gamesById.get(memory.postseason.playoff.games.championship),
    `Season ${selectedYear} is missing its national championship game.`,
  );
  const championId = requireValue(
    championshipGame.winnerId,
    `Season ${selectedYear} has no national champion.`,
  );
  const runnerUpId = championshipGame.teamAId === championId
    ? championshipGame.teamBId
    : championshipGame.teamAId;
  const champion = toHistoryTeam(championId, teamsById, snapshotsByTeamId, selectedYear);
  const runnerUp = toHistoryTeam(runnerUpId, teamsById, snapshotsByTeamId, selectedYear);
  const score = (teamId: number) =>
    teamId === championshipGame.teamAId
      ? championshipGame.scoreA ?? 0
      : championshipGame.scoreB ?? 0;
  const userTeam = league.teams.find(team => team.name === league.info.team) ?? league.teams[0];

  return {
    ...envelope,
    years,
    season: {
      year: selectedYear,
      playoff: {
        teams: memory.postseason.playoff.format,
        autobids: memory.postseason.playoff.autobids,
        conferenceChampionsReceiveTopSeeds:
          memory.postseason.playoff.conferenceChampionsReceiveTopSeeds,
        bracket: buildArchivedBracket(memory, gamesById, teamsById),
      },
      championship: {
        gameId: championshipGame.id,
        champion,
        runnerUp,
        championScore: score(championId),
        runnerUpScore: score(runnerUpId),
      },
      userTeam: {
        ...toHistoryTeam(userTeam.id, teamsById, snapshotsByTeamId, selectedYear),
        accomplishments: buildTeamAccomplishments(userTeam.id, memory, gamesById),
      },
      finalRankings: memory.teamSnapshots
        .slice()
        .sort((left, right) => left.ranking - right.ranking)
        .slice(0, 25)
        .map(snapshot =>
          toHistoryTeam(snapshot.teamId, teamsById, snapshotsByTeamId, selectedYear)
        ),
      conferenceChampions: memory.postseason.conferenceChampions.map(entry => ({
        conferenceName: entry.conferenceName,
        team: toHistoryTeam(entry.teamId, teamsById, snapshotsByTeamId, selectedYear),
        championshipGameId: entry.championshipGameId,
      })),
      bowls: buildBowlEntries(memory, gamesById, teamsById, snapshotsByTeamId),
      awards: memory.awards.map(entry => {
        const player = requireValue(
          identitiesById.get(entry.playerId),
          `Season ${selectedYear} references missing award winner ${entry.playerId}.`,
        );
        const playerSeason = requireValue(
          playerSeasonsById.get(entry.playerId),
          `Season ${selectedYear} is missing award-winner stats for ${entry.playerId}.`,
        );
        const team = requireValue(
          teamsById.get(entry.teamId),
          `Season ${selectedYear} references missing award team ${entry.teamId}.`,
        );
        return {
          categorySlug: entry.categorySlug,
          categoryName: getAwardName(entry.categorySlug),
          playerId: entry.playerId,
          first: player.first,
          last: player.last,
          position: player.pos,
          teamName: team.name,
          statLine: formatAwardStats(playerSeason),
        };
      }),
    },
  };
};
