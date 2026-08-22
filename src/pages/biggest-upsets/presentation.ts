import type { BiggestUpsetGame } from '../../domain/league/loaders/biggestUpsets';

export const formatUpsetProbability = (probability: number) => {
  const percentage = Math.round(probability * 1000) / 10;
  return `${percentage.toFixed(Number.isInteger(percentage) ? 0 : 1)}%`;
};

export const formatUpsetScore = (upset: BiggestUpsetGame) =>
  `${upset.winner.score}–${upset.loser.score}`;

export const formatOvertime = (overtime: number) => {
  if (overtime <= 0) return null;
  return overtime === 1 ? 'OT' : `${overtime}OT`;
};
