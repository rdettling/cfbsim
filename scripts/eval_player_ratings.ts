import {
  generateNationalRatingPool,
  generateWalkOnRatings,
} from '../src/domain/recruiting/generation';
import { createSeededRandom } from '../src/domain/utils/random';
import { deriveSeasonBalanceSeedFamily } from './evaluation/seasonBalance/cli';
import { runSeasonCorpus } from './evaluation/shared/seasonCorpus';
import { loadSeasonCorpusData } from './evaluation/shared/seasonCorpusData';
import { buildRosterRatingInversionsByPrestigeGap } from './evaluation/recruiting/evaluationMetrics';

const ROOT_SEED = 20260823;
const ROSTER_ROOT_SEED = 20260822;
const POOL_COUNT = 10;
const WALK_ON_SAMPLES = 10_000;

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const standardDeviation = (values: number[]) => {
  const mean = average(values);
  return Math.sqrt(average(values.map(value => (value - mean) ** 2)));
};
const round = (value: number) => Math.round(value * 1000) / 1000;
const minimum = (values: number[]) =>
  values.reduce((lowest, value) => Math.min(lowest, value), Infinity);
const maximum = (values: number[]) =>
  values.reduce((highest, value) => Math.max(highest, value), -Infinity);
const percentile = (values: number[], probability: number) => {
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, ordered.length - 1);
  const weight = position - lower;
  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
};
const summarize = (values: number[]) => ({
  mean: round(average(values)),
  standardDeviation: round(standardDeviation(values)),
  p01: percentile(values, 0.01),
  p05: percentile(values, 0.05),
  p10: percentile(values, 0.10),
  p25: percentile(values, 0.25),
  p50: percentile(values, 0.50),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.90),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
  min: minimum(values),
  max: maximum(values),
});

const seeds = Array.from({ length: POOL_COUNT }, (_, index) => ROOT_SEED + index);
const pools = seeds.map(seed =>
  generateNationalRatingPool(createSeededRandom(seed)),
);
const players = pools.flat();
const ratingsByClass = {
  freshman: players.map(player => player.fr),
  sophomore: players.map(player => player.so),
  junior: players.map(player => player.jr),
  senior: players.map(player => player.sr),
};
const nationalActiveRatings = Object.values(ratingsByClass).flat();
const thresholdCountPerPool = (threshold: number) => round(
  nationalActiveRatings.filter(rating =>
    threshold === 99 ? rating === 99 : rating >= threshold,
  ).length / POOL_COUNT,
);
const byStars = Object.fromEntries([2, 3, 4, 5].map(stars => {
  const cohort = players.filter(player => player.stars === stars);
  return [String(stars), {
    playersPerPool: cohort.length / POOL_COUNT,
    freshman: summarize(cohort.map(player => player.fr)),
    senior: summarize(cohort.map(player => player.sr)),
    growth: summarize(cohort.map(player => player.sr - player.fr)),
  }];
}));
const walkOns = Array.from({ length: WALK_ON_SAMPLES }, (_, index) =>
  generateWalkOnRatings(createSeededRandom(ROOT_SEED).fork(`walk-on:${index}`)),
);
const growth = players.map(player => player.sr - player.fr);
const transitionGrowth = players.reduce(
  (totals, player) => ({
    freshmanToSophomore: totals.freshmanToSophomore + player.so - player.fr,
    sophomoreToJunior: totals.sophomoreToJunior + player.jr - player.so,
    juniorToSenior: totals.juniorToSenior + player.sr - player.jr,
  }),
  {
    freshmanToSophomore: 0,
    sophomoreToJunior: 0,
    juniorToSenior: 0,
  },
);
const totalGrowth = Object.values(transitionGrowth).reduce(
  (sum, value) => sum + value,
  0,
);
const developmentTimingShares = Object.fromEntries(
  Object.entries(transitionGrowth).map(([transition, value]) => [
    transition,
    round(value / totalGrowth),
  ]),
) as Record<keyof typeof transitionGrowth, number>;
const seniorCrossoverCounts = pools.reduce(
  (counts, pool) => {
    const threeStars = pool.filter(player => player.stars === 3);
    const fiveStars = pool.filter(player => player.stars === 5);
    threeStars.forEach(threeStar => {
      fiveStars.forEach(fiveStar => {
        counts.comparisons += 1;
        if (threeStar.sr > fiveStar.sr) counts.inversions += 1;
        if (threeStar.sr === fiveStar.sr) counts.ties += 1;
      });
    });
    return counts;
  },
  { comparisons: 0, inversions: 0, ties: 0 },
);
const seniorCrossover3Over5 = {
  ...seniorCrossoverCounts,
  inversionRate: round(
    seniorCrossoverCounts.inversions / seniorCrossoverCounts.comparisons,
  ),
  tieRate: round(
    seniorCrossoverCounts.ties / seniorCrossoverCounts.comparisons,
  ),
};
const rosterSeeds = deriveSeasonBalanceSeedFamily('iterate', ROSTER_ROOT_SEED);
const rosterRatingsByLeague: number[][] = [];
const rosterRatingsByClass: Record<string, number[]> = {
  fr: [],
  so: [],
  jr: [],
  sr: [],
};
const rosterRatingsByStars: Record<string, number[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
};
const rosterRatingsByPrestige = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map(prestige => [prestige, [] as number[]]),
) as Record<string, number[]>;
const starterRatingsByPrestige = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map(prestige => [prestige, [] as number[]]),
) as Record<string, number[]>;
const teamRatingsByPrestige = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map(prestige => [prestige, [] as number[]]),
) as Record<string, number[]>;
const starCountsByPrestige = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map(prestige => [
    prestige,
    Object.fromEntries([1, 2, 3, 4, 5].map(stars => [stars, 0])) as Record<
      string,
      number
    >,
  ]),
) as Record<string, Record<string, number>>;
const teamSamplesByPrestige = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map(prestige => [prestige, 0]),
) as Record<string, number>;
const teamRatingsByLeague: Array<Array<{
  prestigeBefore: number;
  rosterRating: number;
}>> = [];
const eliteCountsByPrestige = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map(prestige => [
    prestige,
    [] as Array<{ ratings90Plus: number; ratings95Plus: number; ratings98Plus: number; ratings99: number }>,
  ]),
) as Record<
  string,
  Array<{
    ratings90Plus: number;
    ratings95Plus: number;
    ratings98Plus: number;
    ratings99: number;
  }>
>;
const corpusData = loadSeasonCorpusData(2026);
rosterSeeds.forEach(seed => {
  runSeasonCorpus(
    corpusData,
    { seed, seeds: 1, seasons: 0, startYear: 2026 },
    {
      onSampleComplete: ({ league, players: roster }) => {
        rosterRatingsByLeague.push(roster.map(player => player.rating));
        roster.forEach(player => {
          rosterRatingsByClass[player.year].push(player.rating);
          rosterRatingsByStars[String(player.stars)].push(player.rating);
        });
        league.teams.forEach(team => {
          const teamPlayers = roster.filter(player => player.teamId === team.id);
          const prestige = String(team.prestige);
          teamRatingsByPrestige[prestige].push(team.rating);
          teamSamplesByPrestige[prestige] += 1;
          rosterRatingsByPrestige[prestige].push(
            ...teamPlayers.map(player => player.rating),
          );
          starterRatingsByPrestige[prestige].push(
            ...teamPlayers
              .filter(player => player.starter)
              .map(player => player.rating),
          );
          teamPlayers.forEach(player => {
            starCountsByPrestige[prestige][String(player.stars)] += 1;
          });
          eliteCountsByPrestige[prestige].push({
            ratings90Plus: teamPlayers.filter(player => player.rating >= 90).length,
            ratings95Plus: teamPlayers.filter(player => player.rating >= 95).length,
            ratings98Plus: teamPlayers.filter(player => player.rating >= 98).length,
            ratings99: teamPlayers.filter(player => player.rating === 99).length,
          });
        });
        teamRatingsByLeague.push(league.teams.map(team => ({
          prestigeBefore: team.prestige,
          rosterRating: team.rating,
        })));
      },
    },
  );
});
const rosterRatings = rosterRatingsByLeague.flat();
const rosterThresholdCountPerLeague = (threshold: number) => round(average(
  rosterRatingsByLeague.map(ratings => ratings.filter(rating =>
    threshold === 99 ? rating === 99 : rating >= threshold,
  ).length),
));

const targets = {
  ratings90PlusPerLeague: { minimum: 200, maximum: 300 },
  ratings95PlusPerLeague: { minimum: 25, maximum: 50 },
  ratings98PlusPerLeague: { minimum: 3, maximum: 8 },
  ratings99PerLeague: { minimum: 0, maximum: 2 },
  freshmanMeanByStars: {
    2: { minimum: 28, maximum: 32 },
    3: { minimum: 48, maximum: 52 },
    4: { minimum: 65, maximum: 69 },
    5: { minimum: 77, maximum: 81 },
  },
  walkOnFreshmanMean: { minimum: 28, maximum: 32 },
  developmentTimingShares: {
    freshmanToSophomore: { minimum: 0.48, maximum: 0.52 },
    sophomoreToJunior: { minimum: 0.33, maximum: 0.37 },
    juniorToSenior: { minimum: 0.13, maximum: 0.17 },
  },
  seniorCrossover3Over5: { minimum: 0.03, maximum: 0.07 },
} as const;

const thresholdCounts = {
  ratings90PlusPerLeague: rosterThresholdCountPerLeague(90),
  ratings95PlusPerLeague: rosterThresholdCountPerLeague(95),
  ratings98PlusPerLeague: rosterThresholdCountPerLeague(98),
  ratings99PerLeague: rosterThresholdCountPerLeague(99),
};
const violations: string[] = [];
Object.entries(thresholdCounts).forEach(([metric, value]) => {
  const target = targets[metric as keyof typeof thresholdCounts];
  if (value < target.minimum || value > target.maximum) {
    violations.push(
      `${metric}=${value}; expected ${target.minimum}-${target.maximum}.`,
    );
  }
});
([2, 3, 4, 5] as const).forEach(stars => {
  const value = average(
    players.filter(player => player.stars === stars).map(player => player.fr),
  );
  const target = targets.freshmanMeanByStars[stars];
  if (value < target.minimum || value > target.maximum) {
    violations.push(
      `freshmanMean${stars}Stars=${round(value)}; expected ${target.minimum}-${target.maximum}.`,
    );
  }
});
const walkOnFreshmanMean = average(walkOns.map(player => player.fr));
if (
  walkOnFreshmanMean < targets.walkOnFreshmanMean.minimum ||
  walkOnFreshmanMean > targets.walkOnFreshmanMean.maximum
) {
  violations.push(
    `walkOnFreshmanMean=${round(walkOnFreshmanMean)}; expected ` +
      `${targets.walkOnFreshmanMean.minimum}-${targets.walkOnFreshmanMean.maximum}.`,
  );
}
const walkOnSeniorMean = average(walkOns.map(player => player.sr));
const twoStarSeniorMean = average(
  players.filter(player => player.stars === 2).map(player => player.sr),
);
if (walkOnSeniorMean >= twoStarSeniorMean) {
  violations.push(
    `walkOnSeniorMean=${round(walkOnSeniorMean)}; expected below ` +
      `twoStarSeniorMean=${round(twoStarSeniorMean)}.`,
  );
}
if (minimum(rosterRatings) !== 25) {
  violations.push(`minimumRosterRating=${minimum(rosterRatings)}; expected 25.`);
}
const declining = players.filter(
  player => player.so < player.fr || player.jr < player.so || player.sr < player.jr,
);
if (declining.length) {
  violations.push(`decliningPlayers=${declining.length}; expected 0.`);
}
Object.entries(developmentTimingShares).forEach(([transition, value]) => {
  const target = targets.developmentTimingShares[
    transition as keyof typeof developmentTimingShares
  ];
  if (value < target.minimum || value > target.maximum) {
    violations.push(
      `${transition}Share=${value}; expected ${target.minimum}-${target.maximum}.`,
    );
  }
});
if (
  seniorCrossover3Over5.inversionRate <
    targets.seniorCrossover3Over5.minimum ||
  seniorCrossover3Over5.inversionRate > targets.seniorCrossover3Over5.maximum
) {
  violations.push(
    `seniorCrossover3Over5=${seniorCrossover3Over5.inversionRate}; expected ` +
      `${targets.seniorCrossover3Over5.minimum}-` +
      `${targets.seniorCrossover3Over5.maximum}.`,
  );
}

const report = {
  rootSeed: ROOT_SEED,
  seeds,
  pools: POOL_COUNT,
  playersPerPool: pools[0].length,
  rosterRootSeed: ROSTER_ROOT_SEED,
  rosterSeeds,
  targets,
  violations,
  activeRosters: {
    leagues: rosterRatingsByLeague.length,
    playersPerLeague: rosterRatingsByLeague[0].length,
    ...summarize(rosterRatings),
    ...thresholdCounts,
    byClass: Object.fromEntries(
      Object.entries(rosterRatingsByClass).map(([className, ratings]) => [
        className,
        summarize(ratings),
      ]),
    ),
    byStars: Object.fromEntries(
      Object.entries(rosterRatingsByStars).map(([stars, ratings]) => [
        stars,
        summarize(ratings),
      ]),
    ),
    byPrestige: Object.fromEntries(
      Object.keys(rosterRatingsByPrestige).map(prestige => {
        const eliteCounts = eliteCountsByPrestige[prestige];
        return [prestige, {
          teams: summarize(teamRatingsByPrestige[prestige]),
          players: summarize(rosterRatingsByPrestige[prestige]),
          starters: summarize(starterRatingsByPrestige[prestige]),
          starsPerTeam: Object.fromEntries(
            Object.entries(starCountsByPrestige[prestige]).map(
              ([stars, count]) => [
                stars,
                round(count / teamSamplesByPrestige[prestige]),
              ],
            ),
          ),
          elitePerTeam: {
            ratings90Plus: round(average(eliteCounts.map(item => item.ratings90Plus))),
            ratings95Plus: round(average(eliteCounts.map(item => item.ratings95Plus))),
            ratings98Plus: round(average(eliteCounts.map(item => item.ratings98Plus))),
            ratings99: round(average(eliteCounts.map(item => item.ratings99))),
          },
        }];
      }),
    ),
    teamRatingInversionsByPrestigeGap:
      buildRosterRatingInversionsByPrestigeGap(
        teamRatingsByLeague,
      ),
  },
  nationalPool: {
    ...summarize(nationalActiveRatings),
    ratings90PlusPerPool: thresholdCountPerPool(90),
    ratings95PlusPerPool: thresholdCountPerPool(95),
    ratings98PlusPerPool: thresholdCountPerPool(98),
    ratings99PerPool: thresholdCountPerPool(99),
  },
  byClass: Object.fromEntries(
    Object.entries(ratingsByClass).map(([className, ratings]) => [
      className,
      summarize(ratings),
    ]),
  ),
  byStars,
  development: {
    ...summarize(growth),
    stagnantShare: round(growth.filter(value => value === 0).length / growth.length),
    breakoutShare: round(growth.filter(value => value >= 18).length / growth.length),
    timingShares: developmentTimingShares,
    seniorCrossover3Over5,
  },
  walkOns: {
    samples: WALK_ON_SAMPLES,
    freshman: summarize(walkOns.map(player => player.fr)),
    senior: summarize(walkOns.map(player => player.sr)),
  },
};

console.log(JSON.stringify(report, null, 2));
if (violations.length) process.exitCode = 1;
