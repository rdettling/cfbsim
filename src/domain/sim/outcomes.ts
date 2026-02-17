import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import { HOME_FIELD_ADVANTAGE } from '../odds';
import { SIM_TUNING } from './config';

const PASS_POSITIVE_POWER = 3.2;
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
  return Math.tanh(ratingDiff / SIM_TUNING.outcomes.advantageScale);
};

const passYards = (offense: Team, defense: Team, game?: SimGame) => {
  const { offenseRating, defenseRating } = adjustedRatings(offense, defense, game);
  const advantageYardage = ratingAdvantage(offense, defense, game) * SIM_TUNING.outcomes.pass.advantageFactor;
  const meanYardage = SIM_TUNING.outcomes.pass.baseMean + advantageYardage;
  const rawYardage = gaussian(meanYardage, SIM_TUNING.outcomes.pass.stdDev);
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + SIM_TUNING.outcomes.pass.positiveMultiplier
    * (rawYardage ** PASS_POSITIVE_POWER);
  return Math.min(Math.round(multiplied), 99);
};

const sackYards = () => Math.min(
  Math.round(gaussian(SIM_TUNING.outcomes.sack.baseMean, SIM_TUNING.outcomes.sack.stdDev)),
  0
);

const runYards = (offense: Team, defense: Team, game?: SimGame) => {
  const advantageYardage = ratingAdvantage(offense, defense, game) * SIM_TUNING.outcomes.run.advantageFactor;
  const meanYardage = SIM_TUNING.outcomes.run.baseMean + advantageYardage;
  const rawYardage = gaussian(meanYardage, SIM_TUNING.outcomes.run.stdDev);
  if (rawYardage < 0) return Math.round(rawYardage);
  const multiplied = rawYardage + SIM_TUNING.outcomes.run.positiveMultiplier
    * (rawYardage ** RUN_POSITIVE_POWER);
  return Math.min(Math.round(multiplied), 99);
};

export const simPass = (fieldPosition: number, offense: Team, defense: Team, game?: SimGame) => {
  const adv = ratingAdvantage(offense, defense, game);
  const randSack = Math.random();
  const randCompletion = Math.random();
  const randInterception = Math.random();
  const result = { outcome: '', yards: 0 };

  const sackRate = Math.max(0.01, SIM_TUNING.outcomes.baseSackRate - adv * SIM_TUNING.outcomes.riskAdvantageFactor);
  const compRate = Math.min(0.8, Math.max(0.45, SIM_TUNING.outcomes.baseCompPercent + adv * SIM_TUNING.outcomes.compRateAdvantageFactor));
  const intRate = Math.max(0.01, SIM_TUNING.outcomes.baseIntRate - adv * SIM_TUNING.outcomes.riskAdvantageFactor);

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
  const fumbleRate = Math.max(0.005, SIM_TUNING.outcomes.baseFumbleRate - adv * SIM_TUNING.outcomes.riskAdvantageFactor);
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
  if (distance < SIM_TUNING.outcomes.fieldGoal.goodFrom) return true;
  if (distance <= SIM_TUNING.outcomes.fieldGoal.maxRange) {
    return SIM_TUNING.outcomes.fieldGoal.baseProb
      - (distance - SIM_TUNING.outcomes.fieldGoal.goodFrom)
        * SIM_TUNING.outcomes.fieldGoal.slope > Math.random();
  }
  return SIM_TUNING.outcomes.fieldGoal.longProb
    - (distance - SIM_TUNING.outcomes.fieldGoal.maxRange)
      * SIM_TUNING.outcomes.fieldGoal.longSlope > Math.random();
};
