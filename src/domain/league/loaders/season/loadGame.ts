import {
  getAllGames,
  getAllPlays,
  getAllHistoricalPlayers,
  getAllPlayerSeasons,
  getGameDetail,
  getGameById,
} from '../../../../db/simRepo';
import { getAllSeasonMemories } from '../../../../db/seasonMemoryRepo';
import { getGameNews } from '../../../../db/newsRepo';
import { getRivalriesData } from '../../../../db/baseData';
import { loadLeaguePlayersSnapshot } from '../../../../db/leagueRepo';
import { buildDriveResponse } from '../../../sim';
import {
  buildLastFiveGamesForTeam,
  buildTeamStatsAndRanks,
  buildTopStartersForTeam,
} from '../../utils/gamePreview';
import { buildGameResultSummary, buildPreviousMatchups } from '../../utils/gameResult';
import { getUserTeam } from './shared';
import { buildDynastySeriesContext } from '../../memoryProjection';
import { flattenGameDetail } from '../../gameDetails';

export const loadGame = async (gameId: number) => {
  const { league, players } = await loadLeaguePlayersSnapshot();

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
    venue: record.venue,
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
    story: await getGameNews(record.id),
  };

  const [allGames, allPlays] = await Promise.all([
    getAllGames(),
    getAllPlays(),
  ]);
  const userTeam = getUserTeam(league);
  const involvesUser =
    record.teamAId === userTeam.id || record.teamBId === userTeam.id;
  let dynastyContext = null;
  if (involvesUser) {
    const [memories, rivalries] = await Promise.all([
      getAllSeasonMemories(),
      getRivalriesData(),
    ]);
    const opponent = record.teamAId === userTeam.id ? teamB : teamA;
    const rivalry = rivalries.rivalries.find(
      ({ teamA, teamB }) =>
        (teamA === userTeam.name && teamB === opponent.name) ||
        (teamB === userTeam.name && teamA === opponent.name),
    );
    dynastyContext = buildDynastySeriesContext({
      userTeamId: userTeam.id,
      opponentTeamId: opponent.id,
      targetGame: record,
      games: allGames.filter(game => game.year >= league.info.startYear),
      memories,
      teams: league.teams,
      rivalryName: rivalry?.name ?? null,
    });
  }
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
      topStarters: buildTopStartersForTeam(teamA.id, players),
      lastFiveGames: buildLastFiveGamesForTeam(teamA.id, allGames, teamsById, record),
    },
    teamB: {
      gamesPlayed: pregameGamesPlayedByTeamId.get(teamB.id) ?? 0,
      stats: teamStatsById.get(teamB.id)!,
      ranks: ranksByTeamId.get(teamB.id)!,
      topStarters: buildTopStartersForTeam(teamB.id, players),
      lastFiveGames: buildLastFiveGamesForTeam(teamB.id, allGames, teamsById, record),
    },
  };

  const detail = await getGameDetail(gameId);
  const flattened = detail ? flattenGameDetail(detail) : null;
  const gamePlays = flattened?.plays ?? [];
  const hasDetailedArtifacts = record.winnerId !== null && Boolean(detail);
  const gameLogs = flattened?.logs ?? [];
  const [historicalPlayers, playerSeasons] = hasDetailedArtifacts
    ? await Promise.all([getAllHistoricalPlayers(), getAllPlayerSeasons()])
    : [[], []];
  const latestSeasonByPlayer = new Map<number, (typeof playerSeasons)[number]>();
  playerSeasons.forEach(season => {
    const previous = latestSeasonByPlayer.get(season.playerId);
    if (!previous || season.year > previous.year) {
      latestSeasonByPlayer.set(season.playerId, season);
    }
  });
  const resultPlayers = [
    ...players,
    ...historicalPlayers.map(player => {
      const season = latestSeasonByPlayer.get(player.id);
      const rating = season?.rating ?? 0;
      return {
        ...player,
        teamId: season?.teamId ?? 0,
        year: season?.classYear ?? 'sr' as const,
        rating,
        rating_fr: rating,
        rating_so: rating,
        rating_jr: rating,
        rating_sr: rating,
        starter: false,
      };
    }),
  ];
  const resultSummary = hasDetailedArtifacts
    ? buildGameResultSummary(game, gamePlays, gameLogs, resultPlayers, teamsById)
    : null;
  const previousMatchups = buildPreviousMatchups(record, allGames);

  const drives = hasDetailedArtifacts
    ? buildDriveResponse(
        flattened!.drives,
        gamePlays,
        teamsById
      )
    : [];

  return {
    info: league.info,
    team: userTeam,
    conferences: league.conferences,
    game,
    preview,
    resultSummary,
    drives,
    previousMatchups,
    dynastyContext,
    detailUnavailable: record.winnerId !== null && !hasDetailedArtifacts,
  };
};
