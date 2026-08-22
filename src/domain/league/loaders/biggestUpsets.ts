import { getGamesByYear } from '../../../db/simRepo';
import type { GameRecord } from '../../../types/db';
import type { Team } from '../../../types/domain';
import { loadLeagueOrThrow } from '../leagueStore';
import { buildLeagueNavigationEnvelope } from './navigationEnvelope';

export const BIGGEST_UPSET_MAX_WIN_PROBABILITY = 0.1;

export interface BiggestUpsetTeam {
  id: number;
  name: string;
  abbreviation: string;
  rank: number;
  score: number;
}

export interface BiggestUpsetGame {
  gameId: number;
  year: number;
  week: number;
  label: string;
  overtime: number;
  winnerWinProbability: number;
  winner: BiggestUpsetTeam;
  loser: BiggestUpsetTeam;
}

const projectTeam = (
  team: Team,
  rank: number,
  score: number,
): BiggestUpsetTeam => ({
  id: team.id,
  name: team.name,
  abbreviation: team.abbreviation,
  rank,
  score,
});

const projectUpset = (
  game: GameRecord,
  teamsById: Map<number, Team>,
): BiggestUpsetGame | null => {
  if (
    game.winnerId === null ||
    game.scoreA === null ||
    game.scoreB === null
  ) {
    return null;
  }

  const winnerIsTeamA = game.winnerId === game.teamAId;
  const winnerWinProbability = winnerIsTeamA ? game.winProbA : game.winProbB;
  if (winnerWinProbability > BIGGEST_UPSET_MAX_WIN_PROBABILITY) return null;

  const winnerId = winnerIsTeamA ? game.teamAId : game.teamBId;
  const loserId = winnerIsTeamA ? game.teamBId : game.teamAId;
  const winner = teamsById.get(winnerId);
  const loser = teamsById.get(loserId);
  if (!winner || !loser) {
    throw new Error(`Game ${game.id} references a team missing from the current league.`);
  }

  return {
    gameId: game.id,
    year: game.year,
    week: game.weekPlayed,
    label: game.baseLabel,
    overtime: game.overtime,
    winnerWinProbability,
    winner: projectTeam(
      winner,
      winnerIsTeamA ? game.rankATOG : game.rankBTOG,
      winnerIsTeamA ? game.scoreA : game.scoreB,
    ),
    loser: projectTeam(
      loser,
      winnerIsTeamA ? game.rankBTOG : game.rankATOG,
      winnerIsTeamA ? game.scoreB : game.scoreA,
    ),
  };
};

export const loadBiggestUpsets = async () => {
  const league = await loadLeagueOrThrow();
  const games = await getGamesByYear(league.info.currentYear);
  const teamsById = new Map(league.teams.map(team => [team.id, team]));
  const upsets = games.flatMap(game => {
    const upset = projectUpset(game, teamsById);
    return upset ? [upset] : [];
  });

  return {
    ...buildLeagueNavigationEnvelope(league),
    upsets,
  };
};
