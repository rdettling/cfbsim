import type { PlayCall, PlayRecord } from '../../types/db';
import type {
  InteractiveDriveState,
  InteractiveStepInstruction,
  InteractiveStepResult,
  PlaySituation,
  SimContext,
} from '../../types/sim';
import {
  chargeTimeout,
  resolveTempo,
  resolveTimeoutRequest,
  resetSecondHalfTimeouts,
} from './clockManagement';
import { resolveOvertimeTiming, resolveRegulationTiming } from './clock';
import {
  chooseOffensiveCall,
  isOffensiveConcept,
  isPassConcept,
  isRunConcept,
  playTypeForCall,
  validatePlayCall,
} from './concepts';
import { SIM_TUNING } from './config';
import {
  TRY_FIELD_POSITION,
  TRY_YARDS,
  buildTryTimingFromTouchdown,
  tryRequiredAfterTouchdown,
} from './conversions';
import { chooseDefensiveIntent, isDefensiveIntent } from './defensiveIntents';
import { addOffensePoints, updateDriveScoreAfter } from './driveScoring';
import { kickoffStartFieldPosition } from './kickoffs';
import { fieldGoal, simPass, simRun } from './outcomes';
import { emptyPlayParticipants, selectPlayParticipants } from './participants';
import { formatPlayText, setPlayHeader, startingYardsLeft } from './plays';
import {
  buildAutomaticOffenseSituation,
  chooseAutomaticOffenseAction,
  choosePlayType,
} from './playcalling';

export const resolveRegulationStep = (
  context: SimContext,
  state: InteractiveDriveState,
  instruction: InteractiveStepInstruction,
  playId: number,
  clockEnabledOverride?: boolean,
): InteractiveStepResult => {
  const { game, starters, offense, defense, clockEnabled } = context;
  const applyClockEnabled = clockEnabledOverride ?? clockEnabled;
  const down = state.down;
  const fieldPosition = state.fieldPosition;
  const yardsLeft = down === 1 ? startingYardsLeft(fieldPosition) : state.yardsLeft;
  const automaticSituation = buildAutomaticOffenseSituation({
    game,
    offense,
    defense,
    down,
    yardsLeft,
    fieldPosition,
    clockEnabled: applyClockEnabled,
  });
  const situation: PlaySituation = automaticSituation;
  const { clock: clockState, offenseLead } = automaticSituation;
  const automaticAction = chooseAutomaticOffenseAction(automaticSituation);
  const automaticOffense = () => {
    const playType = choosePlayType(down, yardsLeft, offenseLead, clockState);
    return chooseOffensiveCall(playType, situation);
  };
  const decision = instruction.call;
  const validInstruction = (
    decision === 'auto'
    || (decision.kind === 'offense' && isOffensiveConcept(decision.concept))
    || (decision.kind === 'defense' && isDefensiveIntent(decision.intent))
    || (decision.kind === 'clock_management'
      && (decision.action === 'spike' || decision.action === 'kneel'))
    || (decision.kind === 'special_teams'
      && (decision.concept === 'punt' || decision.concept === 'field_goal'))
  );
  if (!validInstruction) {
    throw new Error(`Play ${playId} has an invalid interactive instruction.`);
  }

  if (!applyClockEnabled && (
    (decision !== 'auto' && decision.kind === 'clock_management')
    || instruction.tempo !== 'auto'
    || instruction.timeoutAfter.offense === 'use'
    || instruction.timeoutAfter.defense === 'use'
  )) throw new Error(`Play ${playId} cannot apply clock management in overtime.`);

  let pickCall: PlayCall;
  if (decision === 'auto') {
    pickCall = automaticAction.kind === 'scrimmage'
      ? {
          kind: 'scrimmage',
          offense: automaticOffense(),
          defense: chooseDefensiveIntent(playId, situation),
        }
      : automaticAction;
  } else if (decision.kind === 'special_teams' || decision.kind === 'clock_management') {
    pickCall = decision;
  } else {
    if (decision.kind === 'defense' && automaticAction.kind === 'special_teams') {
      throw new Error(`Play ${playId} cannot apply defensive intent to special teams.`);
    }
    if (decision.kind === 'defense' && automaticAction.kind === 'clock_management') {
      throw new Error(`Play ${playId} cannot apply defensive intent to clock management.`);
    }
    pickCall = {
      kind: 'scrimmage',
      offense: decision.kind === 'offense' ? decision.concept : automaticOffense(),
      defense: decision.kind === 'defense'
        ? decision.intent
        : chooseDefensiveIntent(playId, situation),
    };
  }
  const callErrors = validatePlayCall(pickCall, down);
  if (callErrors.length) {
    throw new Error(`Play ${playId} has an invalid call: ${callErrors.join(', ')}.`);
  }
  if (pickCall.kind === 'clock_management') {
    if (!applyClockEnabled) throw new Error(`Play ${playId} cannot manage an overtime clock.`);
    if (pickCall.action === 'spike' && (
      !clockState.clockRunning
      || clockState.secondsLeft < SIM_TUNING.clock.management.minimumSpikeSeconds
      || down > 3
    )) throw new Error(`Play ${playId} cannot spike in the current clock state.`);
  }
  const playType = playTypeForCall(pickCall);
  const clockAction = pickCall.kind === 'clock_management' ? pickCall.action : null;
  const tempo = pickCall.kind === 'special_teams'
    ? 'normal'
    : resolveTempo(instruction.tempo, offenseLead, clockState, clockAction);
  const requestedTimeoutAfter = applyClockEnabled
    ? resolveTimeoutRequest(instruction.timeoutAfter, automaticSituation)
    : null;
  const play: PlayRecord = {
    id: playId,
    gameId: game.id,
    driveId: state.drive.id,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: fieldPosition,
    down,
    yardsLeft,
    playType,
    yardsGained: 0,
    result: '',
    text: '',
    header: '',
    scoreA: game.scoreA,
    scoreB: game.scoreB,
    call: pickCall,
    participants: emptyPlayParticipants(),
    timing: {
      kind: 'regulation',
      start: {
        quarter: clockState.quarter as 1 | 2 | 3 | 4,
        secondsLeft: clockState.secondsLeft,
        running: clockState.clockRunning,
      },
      end: {
        quarter: clockState.quarter as 1 | 2 | 3 | 4,
        secondsLeft: clockState.secondsLeft,
        running: clockState.clockRunning,
      },
      elapsedSeconds: 0,
      outOfBounds: false,
      tempo,
      eventAfter: null,
      chargedTimeoutAfter: null,
    },
  };

  const applyTiming = (isFirstDown: boolean, possessionEnds: boolean) => {
    if (!applyClockEnabled) {
      play.timing = resolveOvertimeTiming(
        play.id,
        Math.max(1, game.overtime),
        play.playType,
        play.result,
      );
      return { halfEnded: false, gameEnded: false };
    }
    const result = resolveRegulationTiming(play.id, clockState, {
      playType: play.playType,
      result: play.result,
      isFirstDown,
      possessionEnds,
      tempo,
      clockAction,
      chargedTimeoutAfter: requestedTimeoutAfter,
    });
    play.timing = result.timing;
    if (result.timing.chargedTimeoutAfter) {
      const team = result.timing.chargedTimeoutAfter === 'offense' ? offense : defense;
      chargeTimeout(game, team.id);
    }
    game.quarter = result.clock.quarter;
    game.clockSecondsLeft = result.clock.secondsLeft;
    game.clockRunning = result.clock.clockRunning;
    if (result.halfEnded) resetSecondHalfTimeouts(game);
    return result;
  };

  setPlayHeader(play, offense, defense);

  if (pickCall.kind === 'special_teams') {
    if (pickCall.concept === 'field_goal') {
      play.yardsGained = 0;
      if (fieldGoal(fieldPosition)) {
        play.result = 'made field goal';
        state.drive.result = 'made field goal';
        state.drive.points = 3;
        updateDriveScoreAfter(game, state.drive, offense);
      } else {
        play.result = 'missed field goal';
        state.drive.result = 'missed field goal';
      }
      const clockResult = applyTiming(false, true);
      play.participants = selectPlayParticipants(play, starters, offense, defense);
      formatPlayText(play, starters);
      if (state.drive.result === 'made field goal') {
        game.scoreA = state.drive.scoreAAfter;
        game.scoreB = state.drive.scoreBAfter;
      }
      return {
        state,
        play,
        driveComplete: true,
        nextFieldPosition: state.drive.result === 'made field goal'
          ? kickoffStartFieldPosition()
          : 100 - fieldPosition,
        gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
      };
    }

    play.result = 'punt';
    play.yardsGained = 0;
    state.drive.result = 'punt';
    state.drive.points = 0;
    const clockResult = applyTiming(false, true);
    play.participants = selectPlayParticipants(play, starters, offense, defense);
    formatPlayText(play, starters);
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: fieldPosition + 40 >= 100
        ? 20
        : 100 - (fieldPosition + 40),
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }

  let result: { yards: number; outcome: PlayRecord['result'] };
  if (down < 1 || down > 4) throw new Error(`Play ${playId} has an impossible down.`);
  const outcomeContext = {
    kind: 'scrimmage' as const,
    down: down as 1 | 2 | 3 | 4,
  };
  if (pickCall.kind === 'clock_management') {
    result = {
      outcome: pickCall.action,
      yards: pickCall.action === 'kneel' ? -1 : 0,
    };
  } else if (pickCall.kind === 'scrimmage' && isRunConcept(pickCall.offense)) {
    result = simRun(
      pickCall.offense,
      pickCall.defense,
      fieldPosition,
      outcomeContext,
      offense,
      defense,
      game,
    );
  } else if (pickCall.kind === 'scrimmage' && isPassConcept(pickCall.offense)) {
    result = simPass(
      pickCall.offense,
      pickCall.defense,
      fieldPosition,
      outcomeContext,
      offense,
      defense,
      game,
    );
  } else {
    throw new Error(`Play ${playId} has an unsupported concept.`);
  }

  play.yardsGained = result.yards;
  play.result = result.outcome;

  const nextFieldPosition = fieldPosition + result.yards;
  let nextYardsLeft = yardsLeft - result.yards;

  const achievedFirstDown = nextYardsLeft <= 0
    && result.outcome !== 'touchdown'
    && result.outcome !== 'interception'
    && result.outcome !== 'fumble';
  const possessionEnds = ['touchdown', 'interception', 'fumble'].includes(result.outcome)
    || nextFieldPosition < 1
    || (down === 4 && nextYardsLeft > 0);
  const clockResult = applyTiming(achievedFirstDown, possessionEnds);

  play.participants = selectPlayParticipants(play, starters, offense, defense);
  formatPlayText(play, starters);

  if (result.outcome === 'touchdown') {
    state.drive.result = 'touchdown';
    addOffensePoints(game, state.drive, offense, 6);
    const needsTry = tryRequiredAfterTouchdown({
      game,
      offense,
      overtimePossession: context.overtimePossession,
    });
    if (needsTry) {
      if (play.timing.kind === 'try') {
        throw new Error(`Play ${playId} produced invalid touchdown timing.`);
      }
      state.phase = 'try';
      state.tryOrigin = 'touchdown';
      state.tryTiming = buildTryTimingFromTouchdown(play.timing);
      state.fieldPosition = TRY_FIELD_POSITION;
      state.down = 1;
      state.yardsLeft = TRY_YARDS;
      return {
        state,
        play,
        driveComplete: false,
        nextFieldPosition: null,
        gameComplete: false,
      };
    }
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (result.outcome === 'interception') {
    state.drive.result = 'interception';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - nextFieldPosition,
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (result.outcome === 'fumble') {
    state.drive.result = 'fumble';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - nextFieldPosition,
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (nextFieldPosition < 1) {
    state.drive.result = 'safety';
    state.drive.points = 0;
    updateDriveScoreAfter(game, state.drive, offense);
    game.scoreA = state.drive.scoreAAfter;
    game.scoreB = state.drive.scoreBAfter;
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }
  if (down === 4 && nextYardsLeft > 0) {
    state.drive.result = 'turnover on downs';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: 100 - nextFieldPosition,
      gameComplete: clockResult.gameEnded && game.scoreA !== game.scoreB,
    };
  }

  if (clockResult.halfEnded) {
    state.drive.result = 'end of half';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: false,
    };
  }
  if (clockResult.gameEnded) {
    state.drive.result = 'end of game';
    return {
      state,
      play,
      driveComplete: true,
      nextFieldPosition: kickoffStartFieldPosition(),
      gameComplete: game.scoreA !== game.scoreB,
    };
  }

  let nextDown = down + 1;
  if (nextYardsLeft <= 0) {
    nextDown = 1;
    nextYardsLeft = startingYardsLeft(nextFieldPosition);
  }

  return {
    state: {
      ...state,
      fieldPosition: nextFieldPosition,
      down: nextDown,
      yardsLeft: nextYardsLeft,
    },
    play,
    driveComplete: false,
    nextFieldPosition: null,
    gameComplete: false,
  };
};
