import type { GameRecord } from '../../../../types/db';
import type { AdvancedUnitStats } from '../../../../types/stats';
import { getTeamScore } from '../../../sim/rankingScores';

const PERFORMANCE_INDEX_CENTER = 50;
const PERFORMANCE_INDEX_STANDARD_DEVIATION = 15;
export const PERFORMANCE_OPPONENT_ADJUSTMENT = 0.35;

const PERFORMANCE_WEIGHTS = {
  efficiency: 0.5,
  explosiveness: 0.15,
  finishing: 0.15,
  fieldPosition: 0.1,
  havoc: 0.1,
} as const;

export type PerformanceIndexInput = {
  teamId: number;
  games: number;
  offenseOpportunities: number;
  defenseOpportunities: number;
  offense: AdvancedUnitStats;
  defense: AdvancedUnitStats;
};

type PerformanceIndexResult = {
  performanceIndex: number;
  offensePerformance: number;
  defensePerformance: number;
};

const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const standardDeviation = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
};

const buildZScores = (
  entries: PerformanceIndexInput[],
  value: (entry: PerformanceIndexInput) => number,
  eligible: (entry: PerformanceIndexInput) => boolean = entry => entry.games > 0,
) => {
  const eligibleEntries = entries.filter(eligible);
  const values = eligibleEntries.map(value);
  const average = mean(values);
  const deviation = standardDeviation(values);
  return new Map(entries.map(entry => [
    entry.teamId,
    eligible(entry) && deviation > 1e-9
      ? (value(entry) - average) / deviation
      : 0,
  ]));
};

const weightedPerformance = ({
  efficiency,
  explosiveness,
  finishing,
  fieldPosition,
  havoc,
}: Record<keyof typeof PERFORMANCE_WEIGHTS, Map<number, number>>) =>
  (teamId: number) =>
    PERFORMANCE_WEIGHTS.efficiency * (efficiency.get(teamId) ?? 0) +
    PERFORMANCE_WEIGHTS.explosiveness * (explosiveness.get(teamId) ?? 0) +
    PERFORMANCE_WEIGHTS.finishing * (finishing.get(teamId) ?? 0) +
    PERFORMANCE_WEIGHTS.fieldPosition * (fieldPosition.get(teamId) ?? 0) +
    PERFORMANCE_WEIGHTS.havoc * (havoc.get(teamId) ?? 0);

const toIndex = (zScore: number) => Math.max(
  0,
  Math.min(
    100,
    PERFORMANCE_INDEX_CENTER + PERFORMANCE_INDEX_STANDARD_DEVIATION * zScore,
  ),
);

const opponentSignal = (rating: number) =>
  (getTeamScore(rating) - PERFORMANCE_INDEX_CENTER) /
  PERFORMANCE_INDEX_STANDARD_DEVIATION;

export const buildPerformanceIndexes = (
  entries: PerformanceIndexInput[],
  completedGames: readonly GameRecord[],
  teamRatings: ReadonlyMap<number, number>,
  opponentAdjustment = PERFORMANCE_OPPONENT_ADJUSTMENT,
) => {
  const offenseScore = weightedPerformance({
    efficiency: buildZScores(entries, entry => entry.offense.successRate),
    explosiveness: buildZScores(entries, entry => entry.offense.successfulPlayYards),
    finishing: buildZScores(
      entries,
      entry => entry.offense.pointsPerOpportunity,
      entry => entry.offenseOpportunities > 0,
    ),
    fieldPosition: buildZScores(
      entries,
      entry => entry.offense.averageStartingFieldPosition,
    ),
    havoc: buildZScores(entries, entry => -entry.offense.havocRate),
  });
  const defenseScore = weightedPerformance({
    efficiency: buildZScores(entries, entry => -entry.defense.successRate),
    explosiveness: buildZScores(entries, entry => -entry.defense.successfulPlayYards),
    finishing: buildZScores(
      entries,
      entry => -entry.defense.pointsPerOpportunity,
      entry => entry.defenseOpportunities > 0,
    ),
    fieldPosition: buildZScores(
      entries,
      entry => -entry.defense.averageStartingFieldPosition,
    ),
    havoc: buildZScores(entries, entry => entry.defense.havocRate),
  });
  const opponents = new Map<number, number[]>();
  completedGames.forEach(game => {
    const ratingA = teamRatings.get(game.teamAId);
    const ratingB = teamRatings.get(game.teamBId);
    if (ratingA === undefined || ratingB === undefined) {
      throw new Error(`Completed game ${game.id} has an unknown opponent rating.`);
    }
    opponents.set(game.teamAId, [
      ...(opponents.get(game.teamAId) ?? []),
      opponentSignal(ratingB),
    ]);
    opponents.set(game.teamBId, [
      ...(opponents.get(game.teamBId) ?? []),
      opponentSignal(ratingA),
    ]);
  });

  return new Map(entries.map(entry => {
    const scheduleAdjustment = opponentAdjustment * mean(
      opponents.get(entry.teamId) ?? [],
    );
    const offenseZ = offenseScore(entry.teamId) + scheduleAdjustment;
    const defenseZ = defenseScore(entry.teamId) + scheduleAdjustment;
    return [entry.teamId, {
      performanceIndex: toIndex((offenseZ + defenseZ) / 2),
      offensePerformance: toIndex(offenseZ),
      defensePerformance: toIndex(defenseZ),
    } satisfies PerformanceIndexResult];
  }));
};
