import {
  getHistoryData,
  getPrestigeConfig,
  getRivalriesData,
} from '../../../db/baseData';
import { getPlayersByIds } from '../../../db/leagueRepo';
import { getGamesByYear } from '../../../db/simRepo';
import { getAllSeasonMemories } from '../../../db/seasonMemoryRepo';
import { SeasonMemoryDataIntegrityError } from '../../../types/memory';
import { calculatePrestigeChanges } from '../prestige';
import {
  buildSeasonMilestones,
  buildTeamAccomplishments,
  selectSignatureGames,
} from '../memoryProjection';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';
import { projectSeasonAwardWinners } from '../utils/awardDisplay';
import { loadLeagueOrThrow } from '../leagueStore';

export const loadSeasonSummary = async () => {
  const league = await loadLeagueOrThrow();
  const envelope = buildLeagueNavigationEnvelope(league);

  if (league.info.stage !== 'summary') {
    return {
      ...envelope,
      championship: null,
      awards: [],
      teams: [],
      legacy: null,
    };
  }

  const [
    games,
    historyData,
    prestigeConfig,
    priorMemories,
    rivalries,
  ] = await Promise.all([
    getGamesByYear(league.info.currentYear),
    getHistoryData(),
    getPrestigeConfig(),
    getAllSeasonMemories(),
    getRivalriesData(),
  ]);
  const memory = priorMemories.find(
    entry => entry.year === league.info.currentYear,
  );
  if (!memory) {
    throw new SeasonMemoryDataIntegrityError(
      `Season ${league.info.currentYear} is missing its finalized memory.`,
    );
  }
  const players = await getPlayersByIds(
    league,
    memory.awards.map(award => award.playerId),
  );

  let championship = null;
  if (league.playoff.natty) {
    const nattyGame = games.find(game => game.id === league.playoff.natty);
    if (
      nattyGame?.winnerId &&
      nattyGame.scoreA !== null &&
      nattyGame.scoreB !== null
    ) {
      const champion = league.teams.find(team => team.id === nattyGame.winnerId) ?? null;
      const runnerUpId = nattyGame.teamAId === nattyGame.winnerId
        ? nattyGame.teamBId
        : nattyGame.teamAId;
      const runnerUp = league.teams.find(team => team.id === runnerUpId) ?? null;
      if (champion && runnerUp) {
        const championIsTeamA = champion.id === nattyGame.teamAId;
        championship = {
          gameId: nattyGame.id,
          champion,
          runnerUp,
          championScore: championIsTeamA ? nattyGame.scoreA : nattyGame.scoreB,
          runnerUpScore: championIsTeamA ? nattyGame.scoreB : nattyGame.scoreA,
        };
      }
    }
  }

  const displayLeague = structuredClone(league);
  const prestigeChanges = calculatePrestigeChanges(
    displayLeague,
    historyData,
    prestigeConfig,
  );

  const teamsWithAvgRanks = displayLeague.teams.map(team => {
    const evaluation = prestigeChanges[team.name];
    return {
      ...team,
      next_prestige: evaluation?.targetPrestige ?? team.prestige,
      prestige_change: evaluation?.change ?? 0,
      avg_rank_before: evaluation?.before.averageRank ?? null,
      avg_rank_after: evaluation?.after.averageRank ?? null,
      prestige_score_before: evaluation?.before.score ?? null,
      prestige_score_after: evaluation?.after.score ?? null,
      prestige_seasons_before: evaluation?.before.seasons ?? 0,
      prestige_seasons_after: evaluation?.after.seasons ?? 0,
    };
  });
  const userTeam =
    league.teams.find(team => team.name === league.info.team) ?? league.teams[0];
  const gamesById = new Map(games.map(game => [game.id, game]));
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const playersById = new Map(players.map(player => [player.id, player]));
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
      previous: priorMemories.filter(entry => entry.year < memory.year),
      games,
      currentWins: userTeam.totalWins,
      currentRank: userTeam.ranking,
      previousRows,
    }),
  };

  return {
    ...envelope,
    championship,
    awards: projectSeasonAwardWinners(memory, playersById, teamsById),
    teams: teamsWithAvgRanks,
    legacy,
  };
};
