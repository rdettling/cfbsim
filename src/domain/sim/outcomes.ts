import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import { HOME_FIELD_ADVANTAGE } from '../odds';

const BASE_COMP_PERCENT = 0.62;
const BASE_SACK_RATE = 0.07;
const BASE_INT_RATE = 0.07;
const BASE_FUMBLE_RATE = 0.02;

const SKILL_DOMINANCE = 2.0;
const ADVANTAGE_SCALE = 16;

const PASS_BASE_MEAN = 7;
const PASS_STD_DEV = 5.2;
const PASS_ADVANTAGE_FACTOR = 2.0;
const PASS_POSITIVE_MULTIPLIER = 0.004;
const PASS_POSITIVE_POWER = 3.2;

const SACK_BASE_MEAN = -6;
const SACK_STD_DEV = 2;

const RUN_BASE_MEAN = 2.8;
const RUN_STD_DEV = 5.5;
const RUN_ADVANTAGE_FACTOR = 1.0;
const RUN_POSITIVE_MULTIPLIER = 0.0004;
const RUN_POSITIVE_POWER = 4.2;

const gaussian = (mean: number, stdDev: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stdDev + mean;
};

const adjustedRatings = (offense: Team, defense: Team, game?: SimGame) => {
  let offenseRating = offense.offense;
  let defenseRating = defense.defense;
  if (game && !game.neutralSite && game.homeTeam) {
    if (game.homeTeam.id === offense.id) offenseRating += HOME_FIELD_ADVANTAGE;
    if (game.homeTeam.id === defense.id) defenseRating += HOME_FIELD_ADVANTAGE;
  }
  return { offenseRating, defenseRating };
};

const ratingAdvantage = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const ratingDiff = offenseRating - defenseRating;
  return Math.tanh(ratingDiff / ADVANTAGE_SCALE) * SKILL_DOMINANCE;
};

const passYards = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const advantageYardage = ratingAdvantage(offense, defense, game) * PASS_ADVANTAGE_FACTOR;
  const meanYardage = PASS_BASE_MEAN + advantageYardage;
  const rawYardage = gaussian(meanYardage, PASS_STD_DEV);
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + PASS_POSITIVE_MULTIPLIER * (rawYardage ** PASS_POSITIVE_POWER);
  return Math.min(Math.round(multiplied), 99);
};

const sackYards = () => Math.min(Math.round(gaussian(SACK_BASE_MEAN, SACK_STD_DEV)), 0);

const runYards = (offense: Team, defense: Team, game?: SimGame) => {
  const advantageYardage = ratingAdvantage(offense, defense, game) * RUN_ADVANTAGE_FACTOR;
  const meanYardage = RUN_BASE_MEAN + advantageYardage;
  const rawYardage = gaussian(meanYardage, RUN_STD_DEV);
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + RUN_POSITIVE_MULTIPLIER * (rawYardage ** RUN_POSITIVE_POWER);
  return Math.min(Math.round(multiplied), 99);
};

export const simPass = (fieldPosition: number, offense: Team, defense: Team, game?: SimGame) => {
  const adv = ratingAdvantage(offense, defense, game);
  const randSack = Math.random();
  const randCompletion = Math.random();
  const randInterception = Math.random();
  const result = { outcome: '', yards: 0 };

  const sackRate = Math.max(0.01, BASE_SACK_RATE - adv * 0.015);
  const compRate = Math.min(0.8, Math.max(0.45, BASE_COMP_PERCENT + adv * 0.04));
  const intRate = Math.max(0.01, BASE_INT_RATE - adv * 0.012);

  if (randSack < sackRate) {
    result.outcome = 'sack';
    result.yards = sackYards();
  } else if (randCompletion < compRate) {
    result.yards = passYards(offense, defense, game);
    if (result.yards + fieldPosition >= 100) {
      result.yards = 100 - fieldPosition;
      result.outcome = 'touchdown';
    } else {
      result.outcome = 'pass';
    }
  } else if (randInterception < intRate) {
    result.outcome = 'interception';
  } else {
    result.outcome = 'incomplete pass';
  }

  return result;
};

export const simRun = (fieldPosition: number, offense: Team, defense: Team, game?: SimGame) => {
  const adv = ratingAdvantage(offense, defense, game);
  const randFumble = Math.random();
  const result = { outcome: '', yards: 0 };
  const fumbleRate = Math.max(0.005, BASE_FUMBLE_RATE - adv * 0.004);
  if (randFumble < fumbleRate) {
    result.outcome = 'fumble';
  } else {
    result.yards = runYards(offense, defense, game);
    if (result.yards + fieldPosition >= 100) {
      result.yards = 100 - fieldPosition;
      result.outcome = 'touchdown';
    } else {
      result.outcome = 'run';
    }
  }
  return result;
};

export const fieldGoal = (fieldPosition: number) => {
  const yardLine = 100 - fieldPosition;
  const distance = yardLine + 17;
  if (distance < 37) return true;
  if (distance < 47) return 0.9 - (distance - 37) * 0.05 > Math.random();
  if (distance < 57) return 0.75 - (distance - 47) * 0.05 > Math.random();
  if (distance >= 57) return 0.55 - (distance - 57) * 0.03 > Math.random();
  return false;
};
