import type { DriveRecord, PlayRecord } from '../../types/db';
import type {
  InteractiveDriveState,
  InteractiveStepInstruction,
  InteractiveStepResult,
  SimContext,
  SimDrive,
} from '../../types/sim';
import { AUTO_STEP_INSTRUCTION, isInteractiveStepInstruction } from './clockManagement';
import {
  TRY_FIELD_POSITION,
  TRY_YARDS,
  buildTryTiming,
} from './conversions';
import { resolveRegulationStep } from './regulationResolution';
import { startingYardsLeft } from './plays';
import { resolveTryStep } from './tryResolution';

export const MAX_PLAYS_PER_DRIVE = 200;

export const simDrive = (
  context: SimContext,
  fieldPosition: number,
  driveNum: number,
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
  driveNum: number,
): InteractiveDriveState => {
  const { game, offense, defense } = context;
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

export const stepInteractiveDrive = (
  context: SimContext,
  state: InteractiveDriveState,
  instruction: InteractiveStepInstruction,
  clockEnabledOverride?: boolean,
): InteractiveStepResult => {
  if (state.playCount >= MAX_PLAYS_PER_DRIVE) {
    throw new Error('The drive exceeded the simulation safety limit.');
  }
  const playId = state.drive.id * 1000 + state.playCount + 1;
  state.playCount += 1;
  if (!isInteractiveStepInstruction(instruction)) {
    throw new Error(`Play ${playId} has an invalid interactive instruction.`);
  }
  return state.phase === 'try'
    ? resolveTryStep(context, state, instruction, playId)
    : resolveRegulationStep(context, state, instruction, playId, clockEnabledOverride);
};
