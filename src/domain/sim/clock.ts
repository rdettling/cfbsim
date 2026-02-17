import type { SimGame } from '../../types/sim';

export const SECONDS_PER_QUARTER = 15 * 60;

export type ClockState = {
  quarter: number;
  secondsLeft: number;
  clockRunning: boolean;
};

export type ClockPlayContext = {
  playType: string;
  result: string;
  isFirstDown: boolean;
  isOutOfBounds: boolean;
  tempo: 'normal' | 'fast' | 'chew';
};

const randomInt = (min: number, max: number) => {
  const range = Math.max(0, max - min);
  return min + Math.floor(Math.random() * (range + 1));
};

const isClockStopResult = (playType: string, result: string) => {
  if (result === 'incomplete pass') return true;
  if (result === 'interception' || result === 'fumble') return true;
  if (result === 'touchdown' || result === 'safety') return true;
  if (result === 'turnover on downs') return true;
  if (result === 'made field goal' || result === 'missed field goal') return true;
  if (result === 'punt') return true;
  if (playType === 'field goal' || playType === 'punt') return true;
  return false;
};

const isFinalTwoMinutesOfHalf = (clock: ClockState) => {
  if (clock.quarter === 2 && clock.secondsLeft <= 120) return true;
  if (clock.quarter === 4 && clock.secondsLeft <= 120) return true;
  return false;
};

const isOutOfBoundsStopWindow = (clock: ClockState) => {
  if (clock.quarter === 2 && clock.secondsLeft <= 120) return true;
  if (clock.quarter === 4 && clock.secondsLeft <= 300) return true;
  return false;
};

const samplePlaySeconds = (playType: string, result: string, tempo: ClockPlayContext['tempo']) => {
  const tempoMultiplier = tempo === 'fast' ? 0.7 : tempo === 'chew' ? 1.2 : 1;
  if (playType === 'punt' || playType === 'field goal') {
    return Math.max(5, Math.round(randomInt(10, 20) * tempoMultiplier));
  }
  if (result === 'incomplete pass') {
    return Math.max(3, Math.round(randomInt(5, 10) * tempoMultiplier));
  }
  if (playType === 'pass') {
    return Math.max(10, Math.round(randomInt(20, 30) * tempoMultiplier));
  }
  return Math.max(15, Math.round(randomInt(30, 40) * tempoMultiplier));
};

export const applyPlayClock = (clock: ClockState, context: ClockPlayContext) => {
  const playSeconds = samplePlaySeconds(context.playType, context.result, context.tempo);
  let secondsLeft = clock.secondsLeft - playSeconds;
  let quarter = clock.quarter;
  let halfEnded = false;
  let gameEnded = false;

  if (secondsLeft <= 0) {
    if (quarter >= 4) {
      secondsLeft = 0;
      gameEnded = true;
    } else {
      if (quarter === 2) {
        halfEnded = true;
      }
      quarter += 1;
      secondsLeft = SECONDS_PER_QUARTER;
    }
  }

  return {
    clock: {
      quarter,
      secondsLeft,
      clockRunning: !(
        isClockStopResult(context.playType, context.result)
        || (context.isFirstDown && !isFinalTwoMinutesOfHalf(clock))
        || (context.isOutOfBounds && isOutOfBoundsStopWindow(clock))
      ),
    },
    playSeconds,
    halfEnded,
    gameEnded,
  };
};

export const totalSecondsLeft = (clock: ClockState) => {
  const remainingQuarters = Math.max(0, 4 - clock.quarter);
  return remainingQuarters * SECONDS_PER_QUARTER + clock.secondsLeft;
};

export const getTempo = (lead: number, clock: ClockState): ClockPlayContext['tempo'] => {
  if (clock.quarter === 2 && clock.secondsLeft <= 120 && lead < 0) return 'fast';
  if (clock.quarter === 4 && clock.secondsLeft <= 300 && lead < 0) return 'fast';
  if (clock.quarter === 4 && clock.secondsLeft <= 300 && lead > 7) return 'chew';
  return 'normal';
};

export const isOutOfBoundsResult = (playType: string, result: string) => {
  if (result !== 'run' && result !== 'pass') return false;
  if (playType === 'pass') return Math.random() < 0.2;
  if (playType === 'run') return Math.random() < 0.08;
  return false;
};

export const createClockState = (game: SimGame): ClockState => ({
  quarter: game.quarter,
  secondsLeft: game.clockSecondsLeft,
  clockRunning: game.clockRunning,
});
