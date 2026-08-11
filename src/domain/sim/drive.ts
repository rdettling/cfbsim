import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { DriveRecord, PlayCall, PlayRecord } from '../../types/db';
import type {
  InteractivePlayChoice,
  InteractiveDriveState,
  InteractiveStepInstruction,
  SimDrive,
  SimGame,
  StartersCache,
} from '../../types/sim';
import {
  resolveOvertimeTiming,
  resolveRegulationTiming,
  totalSecondsLeft,
} from './clock';
import {
  AUTO_STEP_INSTRUCTION,
  chargeTimeout,
  chooseAutomaticClockAction,
  isInteractiveStepInstruction,
  resetSecondHalfTimeouts,
  resolveTempo,
  resolveTimeoutRequest,
} from './clockManagement';
import { kickoffStartFieldPosition } from './kickoffs';
import { choosePlayType, decideFourthDown, pointsNeeded } from './playcalling';
import { fieldGoal, simPass, simRun } from './outcomes';
import { emptyPlayParticipants, selectPlayParticipants } from './participants';
import { formatPlayText, setPlayHeader, startingYardsLeft } from './plays';
import {
  chooseOffensiveCall,
  isOffensiveConcept,
  isPassConcept,
  isRunConcept,
  playTypeForCall,
  validatePlayCall,
} from './concepts';
import {
  chooseDefensiveIntent,
  isDefensiveIntent,
} from './defensiveIntents';
import { SIM_TUNING } from './config';
import {
  TRY_FIELD_POSITION,
  TRY_YARDS,
  buildTryTiming,
  buildTryTimingFromTouchdown,
  chooseAutomaticTryAttempt,
  makeExtraPoint,
  mapTwoPointResult,
  tryRequiredAfterTouchdown,
  validateTryCall,
  twoPointSucceeded,
} from './conversions';

export type SimContext = {
  league: LeagueState;
  game: SimGame;
  starters: StartersCache;
  offense: Team;
  defense: Team;
  lead: number;
  clockEnabled: boolean;
  overtimePossession: 0 | 1 | null;
};

export const MAX_PLAYS_PER_DRIVE = 200;

const updateDriveScoreAfter = (game: SimGame, drive: DriveRecord, offense: Team) => {
  if (drive.result !== 'safety') {
    if (offense.id === game.teamA.id) {
      drive.scoreAAfter += drive.points;
    } else {
      drive.scoreBAfter += drive.points;
    }
  } else {
    if (offense.id === game.teamA.id) {
      drive.scoreBAfter += 2;
    } else {
      drive.scoreAAfter += 2;
    }
  }
};

const addOffensePoints = (
  game: SimGame,
  drive: DriveRecord,
  offense: Team,
  points: number,
) => {
  drive.points += points;
  if (offense.id === game.teamA.id) game.scoreA += points;
  else game.scoreB += points;
  drive.scoreAAfter = game.scoreA;
  drive.scoreBAfter = game.scoreB;
};

export const simDrive = (
  context: SimContext,
  fieldPosition: number,
  driveNum: number
): SimDrive => {
  let state = startInteractiveDrive(context, fieldPosition, driveNum);
  const plays: PlayRecord[] = [];

  for (let step = 0; step < MAX_PLAYS_PER_DRIVE; step += 1) {
    const result = stepInteractiveDrive(context, state, AUTO_STEP_INSTRUCTION);
    state = result.state;
    plays.push(result.play);
    if (result.driveComplete) {
      return {
        record: state.drive,
        plays,
        nextFieldPosition: result.nextFieldPosition ?? fieldPosition,
      };
    }
  }

  throw new Error('The drive exceeded the simulation safety limit.');
};

export const startInteractiveDrive = (
  context: SimContext,
  fieldPosition: number,
  driveNum: number
): InteractiveDriveState => {
  const { game, offense, defense, lead, clockEnabled } = context;
  const needed = clockEnabled
    ? pointsNeeded(
      lead,
      totalSecondsLeft({
        quarter: game.quarter,
        secondsLeft: game.clockSecondsLeft,
        clockRunning: game.clockRunning,
      })
    )
    : 0;
  const driveId = game.id * 1000 + driveNum;

  const drive: DriveRecord = {
    id: driveId,
    gameId: game.id,
    driveNum,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: fieldPosition,
    result: '',
    points: 0,
    points_needed: needed,
    scoreAAfter: game.scoreA,
    scoreBAfter: game.scoreB,
  };

  return {
    drive,
    phase: 'scrimmage',
    tryOrigin: null,
    tryTiming: null,
    fieldPosition,
    down: 1,
    yardsLeft: startingYardsLeft(fieldPosition),
    playCount: 0,
  };
};

export const startOvertimeShootoutDrive = (
  context: SimContext,
  driveNum: number,
): InteractiveDriveState => {
  const state = startInteractiveDrive(context, TRY_FIELD_POSITION, driveNum);
  state.phase = 'try';
  state.tryOrigin = 'overtime_shootout';
  state.tryTiming = buildTryTiming(context.game);
  state.fieldPosition = TRY_FIELD_POSITION;
  state.down = 1;
  state.yardsLeft = TRY_YARDS;
  return state;
};

export const simOvertimeShootoutDrive = (
  context: SimContext,
  driveNum: number,
): SimDrive => {
  const state = startOvertimeShootoutDrive(context, driveNum);
  const result = stepInteractiveDrive(context, state, AUTO_STEP_INSTRUCTION);
  if (!result.driveComplete) throw new Error('The overtime try did not complete.');
  return {
    record: result.state.drive,
    plays: [result.play],
    nextFieldPosition: result.nextFieldPosition ?? TRY_FIELD_POSITION,
  };
};

const resolveTryStep = (
  context: SimContext,
  state: InteractiveDriveState,
  instruction: InteractiveStepInstruction,
  playId: number,
) => {
  const { game, starters, offense, defense } = context;
  const origin = state.tryOrigin;
  if (!origin || !state.tryTiming) throw new Error(`Play ${playId} has no pending try.`);
  if (instruction.tempo !== 'auto'
    || instruction.timeoutAfter.offense === 'use'
    || instruction.timeoutAfter.defense === 'use') {
    throw new Error(`Play ${playId} cannot apply clock management to a try.`);
  }
  const currentLead = offense.id === game.teamA.id
    ? game.scoreA - game.scoreB
    : game.scoreB - game.scoreA;

  const situation = {
    down: 1,
    yardsLeft: TRY_YARDS,
    fieldPosition: TRY_FIELD_POSITION,
    lead: currentLead,
    clock: {
      quarter: game.quarter,
      secondsLeft: game.clockSecondsLeft,
      clockRunning: false,
    },
  };
  const automaticAttempt = chooseAutomaticTryAttempt({
    game,
    offense,
    origin,
    overtimePossession: context.overtimePossession,
  });
  const automaticOffense = () => {
    const type = choosePlayType(1, TRY_YARDS, currentLead, situation.clock);
    return chooseOffensiveCall(type, situation);
  };
  const automaticTwoPointCall = (): Extract<PlayCall, { kind: 'try'; attempt: 'two_point' }> => ({
    kind: 'try',
    attempt: 'two_point',
    offense: automaticOffense(),
    defense: chooseDefensiveIntent(playId, situation),
  });

  const decision: InteractivePlayChoice = instruction.call;
  let call: PlayCall;
  if (decision === 'auto') {
    call = automaticAttempt === 'extra_point'
      ? { kind: 'try', attempt: 'extra_point' }
      : automaticTwoPointCall();
  } else if (decision.kind === 'try') {
    call = decision;
  } else if (decision.kind === 'try_offense') {
    if (!isOffensiveConcept(decision.concept)) {
      throw new Error(`Play ${playId} has an invalid two-point concept.`);
    }
    call = {
      kind: 'try',
      attempt: 'two_point',
      offense: decision.concept,
      defense: chooseDefensiveIntent(playId, situation),
    };
  } else if (decision.kind === 'try_defense') {
    if (automaticAttempt !== 'two_point') {
      throw new Error(`Play ${playId} cannot defend an automatic extra point.`);
    }
    if (!isDefensiveIntent(decision.intent)) {
      throw new Error(`Play ${playId} has an invalid two-point defensive intent.`);
    }
    call = {
      kind: 'try',
      attempt: 'two_point',
      offense: automaticOffense(),
      defense: decision.intent,
    };
  } else {
    throw new Error(`Play ${playId} requires a try instruction.`);
  }

  const errors = validateTryCall(call, origin, game);
  if (errors.length) throw new Error(`Play ${playId} has an invalid try: ${errors.join(', ')}.`);
  if (call.kind !== 'try') throw new Error(`Play ${playId} did not resolve a try call.`);

  const play: PlayRecord = {
    id: playId,
    gameId: game.id,
    driveId: state.drive.id,
    offenseId: offense.id,
    defenseId: defense.id,
    startingFP: TRY_FIELD_POSITION,
    down: 1,
    yardsLeft: TRY_YARDS,
    playType: playTypeForCall(call),
    yardsGained: 0,
    result: '',
    text: '',
    header: '',
    scoreA: game.scoreA,
    scoreB: game.scoreB,
    call,
    participants: emptyPlayParticipants(),
    timing: state.tryTiming,
  };

  if (call.attempt === 'extra_point') {
    play.result = makeExtraPoint() ? 'made extra point' : 'missed extra point';
  } else {
    const raw = isRunConcept(call.offense)
      ? simRun(call.offense, call.defense, TRY_FIELD_POSITION, { kind: 'try' }, offense, defense, game)
      : simPass(call.offense, call.defense, TRY_FIELD_POSITION, { kind: 'try' }, offense, defense, game);
    play.yardsGained = raw.yards;
    play.result = mapTwoPointResult(call, raw.outcome);
  }

  setPlayHeader(play, offense, defense);
  play.participants = selectPlayParticipants(play, starters, offense, defense);
  formatPlayText(play, starters);
  const points = call.attempt === 'extra_point'
    ? play.result === 'made extra point' ? 1 : 0
    : twoPointSucceeded(play.result) ? 2 : 0;
  addOffensePoints(game, state.drive, offense, points);
  if (origin === 'overtime_shootout') state.drive.result = play.result;

  const terminalRegulation = game.overtime === 0
    && game.quarter === 4
    && game.clockSecondsLeft === 0;
  const terminalOvertime = game.overtime > 0
    && context.overtimePossession === 1;
  return {
    state,
    play,
    driveComplete: true,
    nextFieldPosition: kickoffStartFieldPosition(),
    gameComplete: (terminalRegulation || terminalOvertime) && game.scoreA !== game.scoreB,
  };
};

export const stepInteractiveDrive = (
  context: SimContext,
  state: InteractiveDriveState,
  instruction: InteractiveStepInstruction,
  clockEnabledOverride?: boolean
) => {
  if (state.playCount >= MAX_PLAYS_PER_DRIVE) {
    throw new Error('The drive exceeded the simulation safety limit.');
  }

  const { game, starters, offense, defense, lead, clockEnabled } = context;
  const applyClockEnabled = clockEnabledOverride ?? clockEnabled;
  const clockState = {
    quarter: game.quarter,
    secondsLeft: game.clockSecondsLeft,
    clockRunning: game.clockRunning,
  };
  const playId = state.drive.id * 1000 + state.playCount + 1;
  state.playCount += 1;
  if (!isInteractiveStepInstruction(instruction)) {
    throw new Error(`Play ${playId} has an invalid interactive instruction.`);
  }
  if (state.phase === 'try') {
    return resolveTryStep(context, state, instruction, playId);
  }
  const down = state.down;
  const fieldPosition = state.fieldPosition;
  const yardsLeft = down === 1 ? startingYardsLeft(fieldPosition) : state.yardsLeft;

  const situation = { down, yardsLeft, fieldPosition, lead, clock: clockState };
  const managementSituation = {
    game,
    offense,
    defense,
    offenseLead: lead,
    down,
    clock: clockState,
  };
  const automaticFourthDown = down === 4
    ? decideFourthDown(fieldPosition, yardsLeft, state.drive.points_needed)
    : 'go';
  const automaticOffense = () => {
    const playType = choosePlayType(down, yardsLeft, lead, clockState);
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

  const automaticClockAction = applyClockEnabled
    ? chooseAutomaticClockAction(managementSituation)
    : null;
  let pickCall: PlayCall;
  if (decision === 'auto') {
    pickCall = automaticClockAction
      ? { kind: 'clock_management', action: automaticClockAction }
      : automaticFourthDown === 'punt' || automaticFourthDown === 'field_goal'
      ? { kind: 'special_teams', concept: automaticFourthDown }
      : {
          kind: 'scrimmage',
          offense: automaticOffense(),
          defense: chooseDefensiveIntent(playId, situation),
        };
  } else if (decision.kind === 'special_teams' || decision.kind === 'clock_management') {
    pickCall = decision;
  } else {
    if (
      decision.kind === 'defense'
      && (automaticFourthDown === 'punt' || automaticFourthDown === 'field_goal')
    ) {
      throw new Error(`Play ${playId} cannot apply defensive intent to special teams.`);
    }
    if (decision.kind === 'defense' && automaticClockAction) {
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
    : resolveTempo(instruction.tempo, lead, clockState, clockAction);
  const requestedTimeoutAfter = applyClockEnabled
    ? resolveTimeoutRequest(instruction.timeoutAfter, managementSituation)
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

  let result: { yards: number; outcome: string };
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

  let nextFieldPosition = fieldPosition + result.yards;
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
