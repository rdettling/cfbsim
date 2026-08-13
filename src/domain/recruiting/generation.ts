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
  STAR_RATING_TARGETS,
  type RecruitStarCounts,
} from './config';
import { buildRecruitingContext } from './context';
import { calculateTeamFit } from './fit';
import type { RandomSource } from '../utils/random';
import { createSeededRandom } from '../utils/random';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clampRating = (value: number) => clamp(Math.round(value), 30, 99);

export const generatePlayerRatings = (
  stars: number,
  random: RandomSource,
) => {
  const target = STAR_RATING_TARGETS[stars] ?? STAR_RATING_TARGETS[1];
  const developmentTrait = random.int(1, 5);
  const freshman = clampRating(
    random.normal(target.freshman, target.freshmanStdDev),
  );
  const growth = Math.max(
    2,
    target.senior -
      target.freshman +
      (developmentTrait - 3) * 1.5 +
      random.normal(0, 2),
  );
  const sophomore = clampRating(
    freshman + growth * 0.55 + random.normal(0, 1),
  );
  const junior = clampRating(
    freshman + growth * 0.82 + random.normal(0, 1),
  );
  const senior = clampRating(freshman + growth + random.normal(0, 1));
  return {
    fr: freshman,
    so: Math.max(freshman, sophomore),
    jr: Math.max(freshman, sophomore, junior),
    sr: Math.max(freshman, sophomore, junior, senior),
    developmentTrait,
  };
};

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
  const minimumLow = Math.max(30, rating - RECRUITING.ratingRangeWidth);
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
  const prospects: RecruitingProspect[] = [];
  let id = 1;

  [5, 4, 3, 2].forEach(stars => {
    for (let index = 0; index < starCounts[stars]; index += 1) {
      const random = root.fork(`prospect:${stars}:${index}`);
      const position = random.fork('position').weightedChoice(positions) ?? 'qb';
      const name = generateName(position, names, random.fork('name'));
      const ratings = generatePlayerRatings(stars, random.fork('ratings'));
      const range = generateRange(ratings.fr, random.fork('range'));
      prospects.push({
        id,
        nationalRank: 0,
        first: name.first,
        last: name.last,
        state:
          random.fork('state').weightedChoice(weightedStates) ?? 'Unknown',
        position,
        stars,
        ratingFr: ratings.fr,
        ratingSo: ratings.so,
        ratingJr: ratings.jr,
        ratingSr: ratings.sr,
        developmentTrait: ratings.developmentTrait,
        ...range,
        preferenceWeights: generateWeights(random.fork('preferences')),
        interest: [],
        committedTeamId: null,
        committedRound: null,
      });
      id += 1;
    }
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

  prospects
    .map(prospect => ({
      prospect,
      midpoint: (prospect.publicRatingMin + prospect.publicRatingMax) / 2,
      tie: root.fork(`rank:${prospect.id}`).next(),
    }))
    .sort(
      (left, right) =>
        right.prospect.stars - left.prospect.stars ||
        right.midpoint - left.midpoint ||
        left.tie - right.tie,
    )
    .forEach((entry, index) => {
      entry.prospect.nationalRank = index + 1;
    });

  return prospects;
};
