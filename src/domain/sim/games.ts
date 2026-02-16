import type { GameRecord } from '../../types/db';

export const buildWatchability = (game: GameRecord, numTeams: number) => {
  const rankingWeight = 0.9;
  const combinedRanking = (game.rankATOG + game.rankBTOG) / 2;
  const rankingScore = Math.max(0, numTeams - combinedRanking);
  const competitiveness = 1 - Math.abs(game.winProbA - game.winProbB);
  const maxRankingScore = numTeams - 1.5;
  const maxPossible = rankingWeight * maxRankingScore + (1 - rankingWeight) * numTeams;
  const watchability = (rankingWeight * rankingScore + (1 - rankingWeight) * competitiveness * numTeams);
  return Math.round((watchability / maxPossible) * 1000) / 10;
};
