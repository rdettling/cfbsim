import type { PlayerRecord } from '../../types/db';
import type { Team } from '../../types/domain';
import type {
  RecruitingPreferenceWeights,
  RecruitingProspect,
} from '../../types/recruiting';
import type { NamesData } from '../../types/baseData';
import { ROSTER } from '../rosterConfig';
import {
  RECRUITING,
  RECRUIT_STAR_COUNTS,
  type RecruitStarCounts,
} from './config';
import { buildRecruitingContext } from './context';
import { calculateTeamFit } from './fit';
import type { RandomSource } from '../utils/random';
import { createSeededRandom } from '../utils/random';

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const STAR_ORDER = [5, 4, 3, 2] as const;
const MINIMUM_RATING = 25;
const TALENT_CORRELATION = 0.3;
const DEVELOPMENT_SCALE = Math.sqrt(1 - TALENT_CORRELATION ** 2);
const SCOUTING_FRESHMAN_WEIGHT = 0.5;
const SCOUTING_SENIOR_WEIGHT = 0.5;
const SCOUTING_NOISE = 0.55;
const DEVELOPMENT_TIMING = [
  { item: 'so', weight: 0.5 },
  { item: 'jr', weight: 0.35 },
  { item: 'sr', weight: 0.15 },
] as const;

type RatingCurve = ReadonlyArray<readonly [number, number]>;

const FRESHMAN_RATING_CURVE: RatingCurve = [
  [0, 25],
  [0.01, 27],
  [0.05, 29],
  [0.10, 29],
  [0.25, 34],
  [0.50, 50],
  [0.75, 60],
  [0.90, 69],
  [0.95, 76],
  [0.99, 86],
  [0.998, 92],
  [0.9998, 96],
  [0.99998, 98],
  [0.999995, 99],
  [0.9999995, 99],
  [1, 99],
];

const SENIOR_RATING_CURVE: RatingCurve = [
  [0, 25],
  [0.01, 32],
  [0.05, 40],
  [0.10, 45],
  [0.25, 55],
  [0.50, 66],
  [0.75, 76],
  [0.90, 84],
  [0.95, 89],
  [0.99, 93],
  [0.995, 95],
  [0.998, 97],
  [0.9998, 98],
  [0.99999, 99],
  [1, 99],
];

export interface GeneratedPlayerRatings {
  fr: number;
  so: number;
  jr: number;
  sr: number;
}

export interface RankedPlayerRatings extends GeneratedPlayerRatings {
  nationalRank: number;
  stars: number;
}

const normalCdf = (value: number) => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t)
    + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
    Math.exp(-x * x));
  return (1 + erf) / 2;
};

const mapLatentRating = (value: number, curve: RatingCurve) => {
  const percentile = normalCdf(value);
  const upperIndex = curve.findIndex(([cutoff]) => cutoff >= percentile);
  if (upperIndex <= 0) return curve[0][1];
  const [lowerPercentile, lowerRating] = curve[upperIndex - 1];
  const [upperPercentile, upperRating] = curve[upperIndex];
  return Math.round(
    lowerRating +
      ((percentile - lowerPercentile) /
        (upperPercentile - lowerPercentile)) *
        (upperRating - lowerRating),
  );
};

const calculateSeniorLatent = (
  freshmanLatent: number,
  developmentLatent: number,
) =>
  TALENT_CORRELATION * freshmanLatent +
  DEVELOPMENT_SCALE * developmentLatent;

const buildProgression = (
  freshmanLatent: number,
  developmentLatent: number,
  timingRandom: RandomSource,
): GeneratedPlayerRatings => {
  const seniorLatent = calculateSeniorLatent(
    freshmanLatent,
    developmentLatent,
  );
  const freshman = mapLatentRating(freshmanLatent, FRESHMAN_RATING_CURVE);
  const senior = Math.max(
    freshman,
    mapLatentRating(seniorLatent, SENIOR_RATING_CURVE),
  );
  const gains = { so: 0, jr: 0, sr: 0 };
  for (let point = 0; point < senior - freshman; point += 1) {
    const transition = timingRandom.weightedChoice([...DEVELOPMENT_TIMING]);
    if (transition) gains[transition] += 1;
  }
  return {
    fr: freshman,
    so: freshman + gains.so,
    jr: freshman + gains.so + gains.jr,
    sr: senior,
  };
};

const generateScoutedRatings = (random: RandomSource) => {
  const freshmanLatent = random.fork('freshman').normal(0, 1);
  const developmentLatent = random.fork('development').normal(0, 1);
  const seniorLatent = calculateSeniorLatent(
    freshmanLatent,
    developmentLatent,
  );
  return {
    ...buildProgression(
      freshmanLatent,
      developmentLatent,
      random.fork('timing'),
    ),
    scoutingScore:
      SCOUTING_FRESHMAN_WEIGHT * freshmanLatent +
      SCOUTING_SENIOR_WEIGHT * seniorLatent +
      random.fork('scouting').normal(0, SCOUTING_NOISE),
  };
};

export const generateNationalRatingPool = (
  random: RandomSource,
  starCounts: RecruitStarCounts = RECRUIT_STAR_COUNTS,
): RankedPlayerRatings[] => {
  const starsByRank = STAR_ORDER.flatMap(stars =>
    Array.from({ length: starCounts[stars] ?? 0 }, () => stars),
  );
  const scouted = Array.from(
    { length: starsByRank.length },
    (_, generationIndex) => ({
      ...generateScoutedRatings(random.fork(`talent:${generationIndex}`)),
      generationIndex,
    }),
  ).sort(
    (left, right) =>
      right.scoutingScore - left.scoutingScore ||
      left.generationIndex - right.generationIndex,
  );
  return scouted.map((entry, index) => {
    const {
      scoutingScore: _scoutingScore,
      generationIndex: _generationIndex,
      ...ratings
    } = entry;
    return {
      ...ratings,
      nationalRank: index + 1,
      stars: starsByRank[index],
    };
  });
};

export const generateWalkOnRatings = (
  random: RandomSource,
): GeneratedPlayerRatings => buildProgression(
  random.fork('freshman').normal(-1.6, 0.35),
  random.fork('development').normal(-0.9, 1),
  random.fork('timing'),
);

export const generateName = (
  position: string,
  names: NamesData,
  random: RandomSource,
) => {
  const profile = random.weightedChoice(
    Object.entries(names.positionWeights[position] ?? {}).map(
      ([item, weight]) => ({ item, weight }),
    ).filter(entry => entry.weight > 0),
  );
  if (!profile || !names.profiles[profile]) {
    throw new Error(`No name profile is configured for position ${position}.`);
  }
  const source = names.profiles[profile];
  const first = random.weightedChoice(
    source.first.map(entry => ({
      item: entry.name,
      weight: entry.weight,
    })),
  );
  const last = random.weightedChoice(
    source.last.map(entry => ({
      item: entry.name,
      weight: entry.weight,
    })),
  );
  if (!first || !last) {
    throw new Error(`Name profile ${profile} has no usable names.`);
  }
  return {
    first,
    last,
  };
};

const generateWeights = (random: RandomSource): RecruitingPreferenceWeights => {
  const keys = [
    'prestige',
    'proximity',
    'playingTime',
    'recentSuccess',
  ] as const;
  const draws = keys.map(() => -Math.log(Math.max(random.next(), 1e-12)));
  const total = draws.reduce((sum, value) => sum + value, 0);
  const exact = draws.map(value => 10 + (value / total) * 60);
  const values = exact.map(Math.floor);
  let remainder = 100 - values.reduce((sum, value) => sum + value, 0);
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach(entry => {
      if (remainder <= 0) return;
      values[entry.index] += 1;
      remainder -= 1;
    });
  return Object.fromEntries(
    keys.map((key, index) => [key, values[index]]),
  ) as unknown as RecruitingPreferenceWeights;
};

const generateRange = (rating: number, random: RandomSource) => {
  const minimumLow = Math.max(
    MINIMUM_RATING,
    rating - RECRUITING.ratingRangeWidth,
  );
  const maximumLow = Math.min(rating, 99 - RECRUITING.ratingRangeWidth);
  const publicRatingMin = random.int(minimumLow, maximumLow);
  return {
    publicRatingMin,
    publicRatingMax: publicRatingMin + RECRUITING.ratingRangeWidth,
  };
};

export interface GenerateProspectPoolInput {
  teams: Team[];
  returningPlayers: PlayerRecord[];
  names: NamesData;
  states: Record<string, number>;
  year: number;
  seed: number;
  starCounts?: RecruitStarCounts;
}

export const generateProspectPool = ({
  teams,
  returningPlayers,
  names,
  states,
  year,
  seed,
  starCounts = RECRUIT_STAR_COUNTS,
}: GenerateProspectPoolInput): RecruitingProspect[] => {
  const root = createSeededRandom(seed).fork(`year:${year}`);
  const context = buildRecruitingContext(teams, returningPlayers);
  const positions = Object.entries(ROSTER).map(([item, config]) => ({
    item,
    weight: config.total,
  }));
  const weightedStates = Object.entries(states).map(([item, weight]) => ({
    item,
    weight,
  }));
  const ratingPool = generateNationalRatingPool(
    root.fork('rating-pool'),
    starCounts,
  );
  const prospects: RecruitingProspect[] = ratingPool.map(ratings => {
    const random = root.fork(`prospect:${ratings.nationalRank}`);
    const position = random.fork('position').weightedChoice(positions) ?? 'qb';
    const name = generateName(position, names, random.fork('name'));
    const range = generateRange(ratings.fr, random.fork('range'));
    return {
      id: ratings.nationalRank,
      nationalRank: ratings.nationalRank,
      first: name.first,
      last: name.last,
      state:
        random.fork('state').weightedChoice(weightedStates) ?? 'Unknown',
      position,
      stars: ratings.stars,
      ratingFr: ratings.fr,
      ratingSo: ratings.so,
      ratingJr: ratings.jr,
      ratingSr: ratings.sr,
      ...range,
      preferenceWeights: generateWeights(random.fork('preferences')),
      interest: [],
      committedTeamId: null,
      committedRound: null,
    };
  });

  prospects.forEach(prospect => {
    prospect.interest = teams
      .map(team => {
        const fit = calculateTeamFit(prospect, team, context);
        return {
          teamId: team.id,
          fit,
          initial: round3(fit * 0.4),
          earned: 0,
          lifetimePoints: 0,
          tie: root.fork(`initial:${prospect.id}:${team.id}`).next(),
        };
      })
      .sort((left, right) => right.fit - left.fit || left.tie - right.tie)
      .slice(0, RECRUITING.initialContenders)
      .map(({ tie: _tie, ...entry }) => entry);
  });

  return prospects;
};
