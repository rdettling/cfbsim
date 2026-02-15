import {
  BASE_DEVELOPMENT,
  DEVELOPMENT_STD_DEV,
  RATING_STD_DEV,
  STARS_BASE,
} from './constants/playerConstants';
import { randomChoice, randomInt, randomNormal, weightedChoice } from './random';

export interface LoadedNames {
  black: { first: string[]; last: string[] };
  white: { first: string[]; last: string[] };
}

export const loadNames = async (): Promise<LoadedNames> => {
  const response = await fetch('/data/names.json');
  if (!response.ok) {
    throw new Error(`Failed to load names.json: ${response.status}`);
  }
  const namesData = await response.json();

  const processed: LoadedNames = {
    black: { first: [], last: [] },
    white: { first: [], last: [] },
  };

  for (const race of ['black', 'white'] as const) {
    for (const nameType of ['first', 'last'] as const) {
      for (const nameInfo of namesData[race][nameType]) {
        for (let i = 0; i < nameInfo.weight; i += 1) {
          processed[race][nameType].push(nameInfo.name);
        }
      }
    }
  }

  return processed;
};

const buildRatings = (baseRating: number) => {
  const variance = randomNormal(0, RATING_STD_DEV);
  let fr = Math.max(1, baseRating + variance);

  const developmentTrait = randomInt(1, 5);
  const growth = BASE_DEVELOPMENT + developmentTrait + randomNormal(0, DEVELOPMENT_STD_DEV);

  let so = fr + growth * 0.6;
  let jr = fr + growth * 0.9;
  let sr = fr + growth * 1.1;

  fr = Math.min(fr, 99);
  so = Math.min(Math.max(so, fr), 99);
  jr = Math.min(Math.max(jr, so), 99);
  sr = Math.min(Math.max(sr, jr), 99);

  return [Math.round(fr), Math.round(so), Math.round(jr), Math.round(sr), developmentTrait] as const;
};

export const generatePlayerRatings = (starRating: number) => {
  const base = STARS_BASE[starRating];
  return buildRatings(base);
};

export const generateName = (position: string, names: LoadedNames) => {
  const positionBlackShare: Record<string, number> = {
    qb: 15,
    rb: 70,
    wr: 70,
    te: 30,
    ol: 20,
    dl: 70,
    lb: 50,
    cb: 90,
    s: 70,
    k: 0,
    p: 0,
  };

  const share = positionBlackShare[position] ?? 50;
  const race = Math.random() <= share / 100 ? 'black' : 'white';

  const first = randomChoice(names[race].first);
  const last = randomChoice(names[race].last);

  return { first, last };
};

export interface RecruitProfile {
  first: string;
  last: string;
  pos: string;
  stars: number;
  state: string;
  rating_fr: number;
  rating_so: number;
  rating_jr: number;
  rating_sr: number;
  development_trait: number;
}

export const createRecruitProfile = (
  pos: string,
  stars: number,
  names: LoadedNames,
  stateWeights: { states: string[]; weights: number[] }
): RecruitProfile => {
  const { first, last } = generateName(pos, names);
  const [rating_fr, rating_so, rating_jr, rating_sr, development_trait] =
    generatePlayerRatings(stars);
  const state = weightedChoice(stateWeights.states, stateWeights.weights);

  return {
    first,
    last,
    pos,
    stars,
    state,
    rating_fr,
    rating_so,
    rating_jr,
    rating_sr,
    development_trait,
  };
};
