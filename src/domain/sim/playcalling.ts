import type { Team } from '../../types/domain';
import type { ClockState, PlaySituation, SimGame } from '../../types/sim';
import { createClockState, totalSecondsLeft } from './clock';
import type { PlayCall } from '../../types/db';
import type { ManagementSituation } from './clockManagement';
import { chooseAutomaticClockAction } from './clockManagement';
import { SIM_TUNING } from './config';
import { getOffenseLead } from './score';

export type AutomaticOffenseSituation = ManagementSituation & Pick<
  PlaySituation,
  'yardsLeft' | 'fieldPosition'
> & {
  clockEnabled: boolean;
};

export const buildAutomaticOffenseSituation = ({
  game,
  offense,
  defense,
  down,
  yardsLeft,
  fieldPosition,
  clockEnabled,
}: {
  game: SimGame;
  offense: Team;
  defense: Team;
  down: number;
  yardsLeft: number;
  fieldPosition: number;
  clockEnabled: boolean;
}): AutomaticOffenseSituation => ({
  game,
  offense,
  defense,
  offenseLead: getOffenseLead(game, offense),
  down,
  yardsLeft,
  fieldPosition,
  clockEnabled,
  clock: createClockState(game),
});

export type AutomaticOffenseAction =
  | { kind: 'scrimmage' }
  | Extract<PlayCall, { kind: 'special_teams' | 'clock_management' }>;

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

const baseFourthDownDecision = (fieldPosition: number, yardsLeft: number) => {
  const tuning = SIM_TUNING.playcalling.fourthDown;
  let decision: 'punt' | 'go' | 'field_goal' = 'punt';
  if (fieldPosition <= tuning.puntTerritoryMaxFieldPosition) decision = 'punt';
  else if (fieldPosition <= tuning.midfieldMaxFieldPosition) {
    decision = yardsLeft <= tuning.midfieldGoMaxYards ? 'go' : 'punt';
  } else if (fieldPosition < tuning.fieldGoalRangeStartFieldPosition) {
    decision = yardsLeft <= tuning.opponentTerritoryGoMaxYards ? 'go' : 'punt';
  } else {
    decision = yardsLeft <= tuning.fieldGoalTerritoryGoMaxYards
      ? 'go'
      : 'field_goal';
  }

  return decision;
};

const fieldGoalInRange = (fieldPosition: number) =>
  fieldPosition >= SIM_TUNING.playcalling.fourthDown.fieldGoalRangeStartFieldPosition;

const fieldGoalChangesFinalOutcome = (offenseLead: number) =>
  offenseLead <= 0 && offenseLead + 3 >= 0;

const isGuaranteedFinalSnap = (clock: ClockState) => (
  clock.quarter === 4
  && clock.secondsLeft > 0
  && clock.secondsLeft <= SIM_TUNING.clock.liveBallSeconds.scrimmage.min
);

export const chooseAutomaticOffenseAction = (
  situation: AutomaticOffenseSituation,
): AutomaticOffenseAction => {
  const {
    clockEnabled,
    clock,
    offenseLead,
    fieldPosition,
    down,
    yardsLeft,
  } = situation;
  const inFieldGoalRange = fieldGoalInRange(fieldPosition);

  if (
    clockEnabled
    && isGuaranteedFinalSnap(clock)
    && inFieldGoalRange
    && fieldGoalChangesFinalOutcome(offenseLead)
  ) {
    return { kind: 'special_teams', concept: 'field_goal' };
  }

  if (clockEnabled) {
    const clockAction = chooseAutomaticClockAction(situation);
    if (clockAction) return { kind: 'clock_management', action: clockAction };
  }

  if (down !== 4) return { kind: 'scrimmage' };

  const needed = clockEnabled ? pointsNeeded(offenseLead, totalSecondsLeft(clock)) : 0;
  if (inFieldGoalRange && needed === 3) {
    return { kind: 'special_teams', concept: 'field_goal' };
  }

  const decision = baseFourthDownDecision(fieldPosition, yardsLeft);
  if (needed > 0 && (decision === 'punt' || (decision === 'field_goal' && needed > 3))) {
    return { kind: 'scrimmage' };
  }
  if (decision === 'punt' || decision === 'field_goal') {
    return { kind: 'special_teams', concept: decision };
  }
  return { kind: 'scrimmage' };
};
