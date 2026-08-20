import type { PlayerRecord } from '../../../src/types/db';
import type { LeagueState } from '../../../src/types/league';
import type {
  RecruitingBalanceMetric,
  RecruitingBalanceViolation,
  RecruitingClassScoreDistribution,
  RecruitingCountDistribution,
  RecruitingEvaluationAggregate,
  RecruitingEvaluationTeamYear,
  RecruitingSupplySummary,
  RecruitingTop25Composition,
} from './types';
import { POSITION_ORDER, ROSTER } from '../../../src/domain/rosterConfig';
export const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export const RECRUITING_BALANCE_TARGETS = {
  baseCapacityCompletion: { minimum: 0.985 },
  teamBaseCapacityCompletionRate: { minimum: 0.85 },
  oversigningsPerTeamSeason: { minimum: 1, maximum: 2.5 },
  teamsUsingAllFourOversignsRate: { maximum: 0.3 },
  walkOnsPerTeamSeason: { maximum: 0.2 },
  teamSeasonsUsingWalkOnsRate: { maximum: 0.15 },
  prestigeClassScoreCorrelation: { minimum: 0.35 },
  prestigeMobilityRate: { minimum: 0.05, maximum: 0.2 },
} as const satisfies Record<
  RecruitingBalanceMetric,
  { minimum?: number; maximum?: number }
>;

const BALANCE_VIOLATION_CODES: Record<
  RecruitingBalanceMetric,
  RecruitingBalanceViolation['code']
> = {
  baseCapacityCompletion: 'BASE_CAPACITY_COMPLETION_BELOW_MINIMUM',
  teamBaseCapacityCompletionRate:
    'TEAM_BASE_CAPACITY_COMPLETION_RATE_BELOW_MINIMUM',
  oversigningsPerTeamSeason:
    'OVERSIGNINGS_PER_TEAM_SEASON_OUT_OF_RANGE',
  teamsUsingAllFourOversignsRate:
    'ALL_FOUR_OVERSIGNS_RATE_ABOVE_MAXIMUM',
  walkOnsPerTeamSeason: 'WALK_ONS_PER_TEAM_SEASON_ABOVE_MAXIMUM',
  teamSeasonsUsingWalkOnsRate:
    'WALK_ON_TEAM_SEASON_RATE_ABOVE_MAXIMUM',
  prestigeClassScoreCorrelation:
    'PRESTIGE_CLASS_SCORE_CORRELATION_OUT_OF_RANGE',
  prestigeMobilityRate: 'PRESTIGE_MOBILITY_RATE_OUT_OF_RANGE',
};

export const evaluateRecruitingBalance = (
  aggregate: RecruitingEvaluationAggregate,
): RecruitingBalanceViolation[] =>
  (Object.keys(RECRUITING_BALANCE_TARGETS) as RecruitingBalanceMetric[])
    .filter(metric => {
      const target = RECRUITING_BALANCE_TARGETS[metric];
      return (
        ('minimum' in target && aggregate[metric] < target.minimum) ||
        ('maximum' in target && aggregate[metric] > target.maximum)
      );
    })
    .map(metric => ({
      code: BALANCE_VIOLATION_CODES[metric],
      metric,
      actual: aggregate[metric],
      ...RECRUITING_BALANCE_TARGETS[metric],
    }));

export const pearsonCorrelation = (left: number[], right: number[]) => {
  if (!left.length || left.length !== right.length) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftVariance = left.reduce(
    (sum, value) => sum + (value - leftMean) ** 2,
    0,
  );
  const rightVariance = right.reduce(
    (sum, value) => sum + (value - rightMean) ** 2,
    0,
  );
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? round(numerator / denominator) : 0;
};

const percentile = (values: number[], value: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.round((sorted.length - 1) * value);
  return sorted[index] ?? 0;
};

export const buildClassScoreDistribution = (
  scores: number[],
): RecruitingClassScoreDistribution => {
  if (!scores.length) {
    return {
      teams: 0,
      minimum: 0,
      p10: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      maximum: 0,
      mean: 0,
      standardDeviation: 0,
      exactDistinctScores: 0,
      displayedDistinctScores: 0,
      exactTieRate: 0,
      displayedTieRate: 0,
    };
  }
  const average = mean(scores);
  const exactScores = scores.map(score => round(score));
  const displayedScores = scores.map(score => round(score, 1));
  const exactDistinctScores = new Set(exactScores).size;
  const displayedDistinctScores = new Set(displayedScores).size;
  return {
    teams: scores.length,
    minimum: round(Math.min(...scores)),
    p10: round(percentile(scores, 0.1)),
    p25: round(percentile(scores, 0.25)),
    median: round(percentile(scores, 0.5)),
    p75: round(percentile(scores, 0.75)),
    p90: round(percentile(scores, 0.9)),
    maximum: round(Math.max(...scores)),
    mean: round(average),
    standardDeviation: round(
      Math.sqrt(
        mean(scores.map(score => (score - average) ** 2)),
      ),
    ),
    exactDistinctScores,
    displayedDistinctScores,
    exactTieRate: round(
      (scores.length - exactDistinctScores) / scores.length,
    ),
    displayedTieRate: round(
      (scores.length - displayedDistinctScores) / scores.length,
    ),
  };
};

export const buildCountDistribution = (
  values: number[],
): RecruitingCountDistribution => ({
  count: values.length,
  minimum: values.length ? Math.min(...values) : 0,
  p10: percentile(values, 0.1),
  p25: percentile(values, 0.25),
  median: percentile(values, 0.5),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.9),
  maximum: values.length ? Math.max(...values) : 0,
  mean: round(mean(values)),
});

const buildSupplyEntry = (
  available: number,
  signed: number,
): RecruitingSupplySummary => ({
  available,
  signed,
  unsigned: available - signed,
  signingRate: available ? round(signed / available) : 0,
});

export const buildRecruitingSupplySummary = <T>(
  values: T[],
  categories: readonly (string | number)[],
  category: (value: T) => string | number,
  signed: (value: T) => boolean,
): Record<string, RecruitingSupplySummary> =>
  Object.fromEntries(
    categories.map(item => {
      const matching = values.filter(value => category(value) === item);
      return [
        item,
        buildSupplyEntry(
          matching.length,
          matching.filter(signed).length,
        ),
      ];
    }),
  );

export const aggregateSupplySummaries = (
  summaries: Record<string, RecruitingSupplySummary>[],
) => {
  const categories = [
    ...new Set(summaries.flatMap(summary => Object.keys(summary))),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return Object.fromEntries(
    categories.map(category => {
      const available = summaries.reduce(
        (sum, summary) => sum + (summary[category]?.available ?? 0),
        0,
      );
      const signed = summaries.reduce(
        (sum, summary) => sum + (summary[category]?.signed ?? 0),
        0,
      );
      return [category, buildSupplyEntry(available, signed)];
    }),
  );
};

export const buildTop25ClassComposition = (
  teams: Array<
    Pick<RecruitingEvaluationTeamYear, 'classRank' | 'prestigeBefore'>
  >,
): RecruitingTop25Composition => {
  const top25 = teams.filter(team => team.classRank <= 25);
  return Object.fromEntries(
    [...new Set(teams.map(team => team.prestigeBefore))]
      .sort((left, right) => left - right)
      .map(prestige => {
        const eligibleTeamSeasons = teams.filter(
          team => team.prestigeBefore === prestige,
        ).length;
        const appearances = top25.filter(
          team => team.prestigeBefore === prestige,
        ).length;
        return [
          prestige,
          {
            eligibleTeamSeasons,
            appearances,
            compositionShare: round(
              appearances / Math.max(1, top25.length),
            ),
            appearanceRate: round(
              appearances / Math.max(1, eligibleTeamSeasons),
            ),
          },
        ];
      }),
  );
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};

export const evaluationChecksum = (value: unknown) => {
  const text = JSON.stringify(canonicalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const countBy = <T>(values: T[], key: (value: T) => string) =>
  values.reduce<Record<string, number>>((counts, value) => {
    const item = key(value);
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});

export const assertStarters = (league: LeagueState, players: PlayerRecord[]) => {
  for (const team of league.teams) {
    for (const position of POSITION_ORDER) {
      const count = players.filter(
        player =>
          player.starter &&
          player.teamId === team.id &&
          player.pos === position,
      ).length;
      if (count !== ROSTER[position].starters) {
        throw new Error(
          `Team ${team.id} has ${count} ${position} starters in evaluation.`,
        );
      }
    }
  }
};

export const buildPrestigeSummaries = (
  teams: RecruitingEvaluationTeamYear[],
) =>
  Object.fromEntries(
    [...new Set(teams.map(team => team.prestigeBefore))]
      .sort((left, right) => left - right)
      .map(prestige => {
        const tier = teams.filter(team => team.prestigeBefore === prestige);
        const ratings = tier.map(team => team.rosterRating);
        const stars = tier.reduce<Record<number, number>>((counts, team) => {
          Object.entries(team.stars).forEach(([star, count]) => {
            counts[Number(star)] = (counts[Number(star)] ?? 0) + count;
          });
          return counts;
        }, {});
        return [
          prestige,
          {
            teams: tier.length,
            averageClassScore: round(mean(tier.map(team => team.classScore))),
            averagePublicRating: round(
              mean(tier.map(team => team.averagePublicRating)),
            ),
            averageRosterRating: round(mean(ratings)),
            rosterRatingP10: percentile(ratings, 0.1),
            rosterRatingP50: percentile(ratings, 0.5),
            rosterRatingP90: percentile(ratings, 0.9),
            stars,
            walkOns: tier.reduce((sum, team) => sum + team.walkOns, 0),
            cuts: tier.reduce((sum, team) => sum + team.cuts, 0),
          },
        ];
      }),
  );
