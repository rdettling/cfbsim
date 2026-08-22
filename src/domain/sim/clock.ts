import type {
  ClockManagementAction,
  ClockQuarter,
  ClockSnapshot,
  ClockTempo,
  PlayTiming,
  RegulationClockEvent,
} from '../../types/db';
import type { ClockState, SimGame } from '../../types/sim';
import { createSeededRandom } from '../utils/random';
import { SIM_TUNING } from './config';

export const SECONDS_PER_QUARTER = 15 * 60;

export type OffenseTimeoutRequest =
  | { side: 'offense'; timing: 'immediate' }
  | { side: 'offense'; timing: 'drain_to'; targetSeconds: number };

export type TimeoutRequest =
  | OffenseTimeoutRequest
  | { side: 'defense'; timing: 'immediate' };

export type ClockPlayContext = {
  playType: string;
  result: string;
  isFirstDown: boolean;
  possessionEnds: boolean;
  tempo: ClockTempo;
  clockAction: ClockManagementAction | null;
  timeoutRequest: TimeoutRequest | null;
};

export type ClockResult = {
  clock: ClockState;
  timing: Extract<PlayTiming, { kind: 'regulation' }>;
  halfEnded: boolean;
  gameEnded: boolean;
};

const asQuarter = (quarter: number): ClockQuarter => {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error(`Invalid regulation quarter ${quarter}.`);
  }
  return quarter as ClockQuarter;
};

const snapshot = (clock: ClockState): ClockSnapshot => ({
  quarter: asQuarter(clock.quarter),
  secondsLeft: clock.secondsLeft,
  running: clock.clockRunning,
});

const isFinalTwoMinutesOfHalf = (clock: ClockState) => {
  const threshold = SIM_TUNING.clock.firstDownStopSeconds;
  return (clock.quarter === 2 || clock.quarter === 4)
    && clock.secondsLeft <= threshold;
};

const isOutOfBoundsStopWindow = (clock: ClockState) => {
  if (
    clock.quarter === 2
    && clock.secondsLeft <= SIM_TUNING.clock.outOfBoundsStop.firstHalfSeconds
  ) return true;
  if (
    clock.quarter === 4
    && clock.secondsLeft <= SIM_TUNING.clock.outOfBoundsStop.secondHalfSeconds
  ) return true;
  return false;
};

const isTerminalClockResult = (playType: string, result: string) => (
  result === 'incomplete pass'
  || result === 'interception'
  || result === 'fumble'
  || result === 'touchdown'
  || result === 'safety'
  || result === 'turnover on downs'
  || result === 'made field goal'
  || result === 'missed field goal'
  || result === 'punt'
  || playType === 'field goal'
  || playType === 'punt'
);

const chooseOutOfBounds = (
  playId: number,
  playType: string,
  result: string,
) => {
  if (result !== 'run' && result !== 'pass') return false;
  const rate = playType === 'pass'
    ? SIM_TUNING.clock.outOfBoundsRates.pass
    : playType === 'run'
      ? SIM_TUNING.clock.outOfBoundsRates.run
      : 0;
  return createSeededRandom(playId).fork('clock-out-of-bounds').next() < rate;
};

export const sampleLiveBallSeconds = (playId: number, playType: string) => {
  const range = playType === 'punt' || playType === 'field goal'
    ? SIM_TUNING.clock.liveBallSeconds.specialTeams
    : SIM_TUNING.clock.liveBallSeconds.scrimmage;
  return createSeededRandom(playId).fork('clock-live-ball').int(range.min, range.max);
};

const sampleManagementLiveBallSeconds = (
  playId: number,
  action: ClockManagementAction,
) => {
  const range = action === 'spike'
    ? SIM_TUNING.clock.management.spikeLiveBallSeconds
    : SIM_TUNING.clock.management.kneelLiveBallSeconds;
  return createSeededRandom(playId).fork('clock-live-ball').int(range.min, range.max);
};

export const samplePlayLiveBallSeconds = (
  playId: number,
  playType: string,
  action: ClockManagementAction | null,
) => action === null
  ? sampleLiveBallSeconds(playId, playType)
  : sampleManagementLiveBallSeconds(playId, action);

const sampleRunoffSeconds = (
  playId: number,
  playType: string,
  result: string,
  tempo: ClockPlayContext['tempo'],
) => {
  const range = playType === 'run' || result === 'sack'
    ? SIM_TUNING.clock.runoffSeconds.runOrSack
    : SIM_TUNING.clock.runoffSeconds.completedPass;
  const multiplier = SIM_TUNING.clock.tempoMultipliers[tempo];
  const sampled = createSeededRandom(playId).fork('clock-runoff').int(range.min, range.max);
  return Math.round(sampled * multiplier);
};

export const samplePotentialRunoffSeconds = (
  playId: number,
  playType: string,
  result: string,
  tempo: ClockTempo,
  action: ClockManagementAction | null,
  liveBallSeconds: number,
) => action === 'kneel'
  ? Math.max(0, SIM_TUNING.clock.management.kneelBudgetSeconds - liveBallSeconds)
  : sampleRunoffSeconds(playId, playType, result, tempo);

export const maximumNormalRunningScrimmageSeconds = () => (
  SIM_TUNING.clock.liveBallSeconds.scrimmage.max
  + Math.round(
    SIM_TUNING.clock.runoffSeconds.runOrSack.max
      * SIM_TUNING.clock.tempoMultipliers.normal,
  )
);

const periodEvent = (quarter: number): RegulationClockEvent => {
  if (quarter === 2) return 'halftime';
  if (quarter === 4) return 'end_of_regulation';
  return 'end_of_quarter';
};

const nextClockAfterPeriod = (quarter: number): ClockState => quarter >= 4
  ? { quarter: 4, secondsLeft: 0, clockRunning: false }
  : { quarter: quarter + 1, secondsLeft: SECONDS_PER_QUARTER, clockRunning: false };

export const resolveRegulationTiming = (
  playId: number,
  clock: ClockState,
  context: ClockPlayContext,
): ClockResult => {
  const start = snapshot(clock);
  const outOfBounds = context.clockAction === null
    ? chooseOutOfBounds(playId, context.playType, context.result)
    : false;
  const liveBallSample = samplePlayLiveBallSeconds(
    playId,
    context.playType,
    context.clockAction,
  );
  const liveBallSeconds = Math.min(liveBallSample, clock.secondsLeft);
  let secondsLeft = clock.secondsLeft - liveBallSeconds;
  let elapsedSeconds = liveBallSeconds;
  let eventAfter: RegulationClockEvent | null = null;
  let chargedTimeoutAfter: 'offense' | 'defense' | null = null;

  const crossedTwoMinutesDuringPlay = (
    (clock.quarter === 2 || clock.quarter === 4)
    && clock.secondsLeft > SIM_TUNING.clock.firstDownStopSeconds
    && secondsLeft <= SIM_TUNING.clock.firstDownStopSeconds
  );

  const clockRunsAfterPlay = !(
    context.clockAction === 'spike'
    ||
    context.possessionEnds
    || isTerminalClockResult(context.playType, context.result)
    || (context.isFirstDown && isFinalTwoMinutesOfHalf({ ...clock, secondsLeft }))
    || (outOfBounds && isOutOfBoundsStopWindow({ ...clock, secondsLeft }))
  );

  if (secondsLeft <= 0) {
    eventAfter = periodEvent(clock.quarter);
  } else if (crossedTwoMinutesDuringPlay) {
    eventAfter = 'two_minute_timeout';
  } else if (clockRunsAfterPlay && context.timeoutRequest !== null) {
    const request = context.timeoutRequest;
    if (request.timing === 'drain_to') {
      const requestedRunoff = Math.max(0, secondsLeft - request.targetSeconds);
      const runoffSeconds = Math.min(
        requestedRunoff,
        SIM_TUNING.clock.management.maximumPostPlayRunoffSeconds,
      );
      secondsLeft -= runoffSeconds;
      elapsedSeconds += runoffSeconds;
    }
    chargedTimeoutAfter = request.side;
  } else if (clockRunsAfterPlay) {
    const runoffSample = samplePotentialRunoffSeconds(
      playId,
      context.playType,
      context.result,
      context.tempo,
      context.clockAction,
      liveBallSeconds,
    );
    const threshold = SIM_TUNING.clock.firstDownStopSeconds;
    const reachesTwoMinutes = (
      (clock.quarter === 2 || clock.quarter === 4)
      && secondsLeft > threshold
      && secondsLeft - runoffSample <= threshold
    );
    const runoffSeconds = reachesTwoMinutes
      ? secondsLeft - threshold
      : Math.min(runoffSample, secondsLeft);
    secondsLeft -= runoffSeconds;
    elapsedSeconds += runoffSeconds;
    if (reachesTwoMinutes) eventAfter = 'two_minute_timeout';
    else if (secondsLeft <= 0) eventAfter = periodEvent(clock.quarter);
  }

  const stoppedForEvent = eventAfter !== null || chargedTimeoutAfter !== null;
  const end: ClockSnapshot = {
    quarter: start.quarter,
    secondsLeft: Math.max(0, secondsLeft),
    running: stoppedForEvent ? false : clockRunsAfterPlay,
  };
  const clockAfter = eventAfter && eventAfter !== 'two_minute_timeout'
    ? nextClockAfterPeriod(clock.quarter)
    : {
        quarter: clock.quarter,
        secondsLeft: end.secondsLeft,
        clockRunning: end.running,
      };

  return {
    clock: clockAfter,
    timing: {
      kind: 'regulation',
      start,
      end,
      elapsedSeconds,
      outOfBounds,
      tempo: context.tempo,
      eventAfter,
      chargedTimeoutAfter,
    },
    halfEnded: eventAfter === 'halftime',
    gameEnded: eventAfter === 'end_of_regulation',
  };
};

export const resolveOvertimeTiming = (
  playId: number,
  overtimePeriod: number,
  playType: string,
  result: string,
): Extract<PlayTiming, { kind: 'overtime' }> => ({
  kind: 'overtime',
  period: overtimePeriod,
  outOfBounds: chooseOutOfBounds(playId, playType, result),
});

export const totalSecondsLeft = (clock: ClockState) => {
  const remainingQuarters = Math.max(0, 4 - clock.quarter);
  return remainingQuarters * SECONDS_PER_QUARTER + clock.secondsLeft;
};

export const createClockState = (game: SimGame): ClockState => ({
  quarter: game.quarter,
  secondsLeft: game.clockSecondsLeft,
  clockRunning: game.clockRunning,
});
