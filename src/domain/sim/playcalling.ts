import type { ClockPlayContext, ClockState } from './clock';
import { SIM_TUNING } from './config';

export const pointsNeeded = (lead: number, timeLeftSeconds: number) => {
  if (lead >= 0) return 0;
  const drivesLeft = Math.max(1, Math.round(timeLeftSeconds / 180));
  const deficit = Math.abs(lead);
  const possibleScores = [3, 6, 7, 8];
  const maxScore = Math.max(...possibleScores);
  if (deficit <= (drivesLeft - 1) * maxScore) return 0;
  if (drivesLeft === 1) {
    for (const points of possibleScores) {
      if (points >= deficit) return points;
    }
  }
  for (const points of possibleScores) {
    if (deficit - points <= (drivesLeft - 1) * maxScore) return points;
  }
  return 9;
};

export const choosePlayType = (
  down: number,
  yardsLeft: number,
  tempo: ClockPlayContext['tempo'],
  lead: number,
  clock: ClockState
) => {
  let passWeight = SIM_TUNING.playcalling.passWeightBase;
  if (down >= 3 && yardsLeft >= 7) passWeight += SIM_TUNING.playcalling.passWeightThirdAndLong;
  if (down <= 2 && yardsLeft <= 3) passWeight += SIM_TUNING.playcalling.passWeightShortYards;
  if (clock.quarter === 4 && clock.secondsLeft <= 300 && lead < 0) {
    passWeight += SIM_TUNING.playcalling.passWeightLateTrailing;
  }
  if (clock.quarter === 4 && clock.secondsLeft <= 300 && lead > 0) {
    passWeight += SIM_TUNING.playcalling.passWeightLateLeading;
  }
  passWeight = Math.max(
    SIM_TUNING.playcalling.passWeightMin,
    Math.min(SIM_TUNING.playcalling.passWeightMax, passWeight)
  );
  return Math.random() < passWeight ? 'pass' : 'run';
};

export const decideFourthDown = (fieldPosition: number, yardsLeft: number, needed: number) => {
  let decision = 'punt';
  if (fieldPosition <= 40) decision = 'punt';
  else if (fieldPosition <= 50) decision = yardsLeft === 1 ? 'go' : 'punt';
  else if (fieldPosition <= 62) decision = yardsLeft <= 2 ? 'go' : 'punt';
  else decision = yardsLeft <= 3 ? 'go' : 'field_goal';

  if (needed > 0) {
    if (decision === 'punt') decision = 'go';
    if (decision === 'field_goal' && needed > 3) decision = 'go';
  }
  return decision;
};
