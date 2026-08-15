import type { PlayCall, PlayRecord } from '../../types/db';
import type {
  InteractiveDriveState,
  InteractivePlayChoice,
  InteractiveStepInstruction,
  InteractiveStepResult,
  PlaySituation,
  SimContext,
} from '../../types/sim';
import {
  TRY_FIELD_POSITION,
  TRY_YARDS,
  chooseAutomaticTryAttempt,
  makeExtraPoint,
  mapTwoPointResult,
  twoPointSucceeded,
  validateTryCall,
} from './conversions';
import {
  chooseOffensiveCall,
  isOffensiveConcept,
  isRunConcept,
  playTypeForCall,
} from './concepts';
import { chooseDefensiveIntent, isDefensiveIntent } from './defensiveIntents';
import { addOffensePoints } from './driveScoring';
import { kickoffStartFieldPosition } from './kickoffs';
import { simPass, simRun } from './outcomes';
import { emptyPlayParticipants, selectPlayParticipants } from './participants';
import { formatPlayText, setPlayHeader } from './plays';
import { choosePlayType } from './playcalling';
import { getOffenseLead } from './score';

export const resolveTryStep = (
  context: SimContext,
  state: InteractiveDriveState,
  instruction: InteractiveStepInstruction,
  playId: number,
): InteractiveStepResult => {
  const { game, starters, offense, defense } = context;
  const origin = state.tryOrigin;
  if (!origin || !state.tryTiming) throw new Error(`Play ${playId} has no pending try.`);
  if (instruction.tempo !== 'auto'
    || instruction.timeoutAfter.offense === 'use'
    || instruction.timeoutAfter.defense === 'use') {
    throw new Error(`Play ${playId} cannot apply clock management to a try.`);
  }
  const offenseLead = getOffenseLead(game, offense);
  const situation: PlaySituation = {
    down: 1,
    yardsLeft: TRY_YARDS,
    fieldPosition: TRY_FIELD_POSITION,
    offenseLead,
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
    const type = choosePlayType(1, TRY_YARDS, offenseLead, situation.clock);
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
