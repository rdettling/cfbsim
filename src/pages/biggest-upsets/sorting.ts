import type { BiggestUpsetGame } from '../../domain/league/loaders/biggestUpsets';

export type BiggestUpsetsSortKey = 'week' | 'magnitude';

export const sortBiggestUpsets = (
  upsets: BiggestUpsetGame[],
  sortKey: BiggestUpsetsSortKey,
) => [...upsets].sort((left, right) => {
  if (sortKey === 'magnitude') {
    return left.winnerWinProbability - right.winnerWinProbability ||
      right.week - left.week ||
      right.gameId - left.gameId;
  }
  return right.week - left.week ||
    left.winnerWinProbability - right.winnerWinProbability ||
    right.gameId - left.gameId;
});
