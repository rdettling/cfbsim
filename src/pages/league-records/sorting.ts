import type { LeagueRecordBestSeason, LeagueRecordProgram } from '../../domain/league/loaders/leagueRecords';
import type { LeagueRecordsSortDirection, LeagueRecordsSortKey } from './config';

export type RankedLeagueRecordProgram = LeagueRecordProgram & { rank: number };

const compareNullable = <T>(
  left: T | null,
  right: T | null,
  compare: (leftValue: T, rightValue: T) => number,
) => {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return compare(left, right);
};

const compareBestSeasons = (
  left: LeagueRecordBestSeason,
  right: LeagueRecordBestSeason,
) => {
  const leftGames = left.wins + left.losses;
  const rightGames = right.wins + right.losses;
  const leftPercentage = leftGames === 0 ? 0 : left.wins / leftGames;
  const rightPercentage = rightGames === 0 ? 0 : right.wins / rightGames;
  if (leftPercentage !== rightPercentage) return leftPercentage - rightPercentage;
  if (left.wins !== right.wins) return left.wins - right.wins;
  if (left.losses !== right.losses) return right.losses - left.losses;
  const leftRank = left.finalRank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.finalRank ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) return rightRank - leftRank;
  return left.year - right.year;
};

const comparePrimary = (
  left: LeagueRecordProgram,
  right: LeagueRecordProgram,
  key: LeagueRecordsSortKey,
) => {
  if (key === 'bestSeason') {
    return compareNullable(left.bestSeason, right.bestSeason, compareBestSeasons);
  }
  if (key === 'bestFinalRank') {
    return compareNullable(left.bestFinalRank, right.bestFinalRank, (a, b) => a - b);
  }
  if (key === 'winPercentage') {
    return compareNullable(left.winPercentage, right.winPercentage, (a, b) => a - b);
  }
  return left[key] - right[key];
};

export const sortLeagueRecords = (
  programs: LeagueRecordProgram[],
  key: LeagueRecordsSortKey,
  direction: LeagueRecordsSortDirection,
): RankedLeagueRecordProgram[] => [...programs]
  .sort((left, right) => {
    const leftValue = key === 'bestSeason' ? left.bestSeason : left[key];
    const rightValue = key === 'bestSeason' ? right.bestSeason : right[key];
    const hasNull = leftValue === null || rightValue === null;
    const primary = comparePrimary(left, right, key);
    if (primary !== 0) return hasNull ? primary : direction === 'asc' ? primary : -primary;
    if (left.wins !== right.wins) return right.wins - left.wins;
    if (left.losses !== right.losses) return left.losses - right.losses;
    return left.name.localeCompare(right.name);
  })
  .map((program, index) => ({ ...program, rank: index + 1 }));
