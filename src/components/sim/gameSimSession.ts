import { SECONDS_PER_QUARTER } from '../../domain/sim/clock';
import { TRY_FIELD_POSITION } from '../../domain/sim/conversions';
import {
  MAX_PLAYS_PER_DRIVE,
  startInteractiveDrive,
  startOvertimeShootoutDrive,
  stepInteractiveDrive,
} from '../../domain/sim/drive';
import {
  finalizeGameResult,
  isTeamAOpeningOffense,
  OT_START_YARD_LINE,
} from '../../domain/sim/engine';
import { buildSimContext } from '../../domain/sim/interactive';
import { kickoffStartFieldPosition } from '../../domain/sim/kickoffs';
import type {
  ClockTempo,
  DriveRecord,
  GameRecord,
  PlayerRecord,
  PlayRecord,
} from '../../types/db';
import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type {
  InteractiveDriveState,
  SimGame,
  StartersCache,
} from '../../types/sim';
import { buildGameSimStepInstruction } from './gameSimDecision';
import type { SimulationDecision } from './gameSimTypes';

export type GameSimSessionContext = {
  league: LeagueState;
  record: GameRecord;
  teamsById: Map<number, Team>;
  starters: StartersCache;
  playersById: Map<number, PlayerRecord>;
  simGame: SimGame;
  preRecordA: string;
  preRecordB: string;
  userTeamId: number | null;
  driveNum: number;
  fieldPosition: number;
  inOvertime: boolean;
  otPossession: number;
  openingIsTeamA: boolean;
  nextOffenseIsTeamA: boolean;
  driveStartQuarter: number;
  currentDriveState: InteractiveDriveState | null;
  currentOffense: Team | null;
  currentDefense: Team | null;
};

export type GameSimSession = {
  context: GameSimSessionContext;
  driveRecords: DriveRecord[];
  playRecords: PlayRecord[];
  complete: boolean;
};

export type GameSimSessionAdvanceResult = {
  plays: PlayRecord[];
  drive: DriveRecord;
  driveComplete: boolean;
  gameComplete: boolean;
};

type GameSimSessionInput = {
  league: LeagueState;
  record: GameRecord;
  teamsById: Map<number, Team>;
  starters: StartersCache;
  playersById: Map<number, PlayerRecord>;
  simGame: SimGame;
  preRecordA: string;
  preRecordB: string;
  isUserGame: boolean;
};

type GameSimSessionAdvanceInput = {
  scope: 'play' | 'drive';
  decision: SimulationDecision;
  selectedTempo: ClockTempo | 'auto';
  timeoutAfterPlay: boolean;
};

const markComplete = (session: GameSimSession) => {
  if (!session.complete) {
    finalizeGameResult(session.context.simGame);
    session.complete = true;
  }
};

const startNextDrive = (session: GameSimSession) => {
  const { context } = session;
  if (!context.inOvertime) {
    const regulationEnded =
      context.simGame.quarter === 4 &&
      context.simGame.clockSecondsLeft === 0;
    if (regulationEnded) {
      if (context.simGame.scoreA === context.simGame.scoreB) {
        context.inOvertime = true;
        context.otPossession = 0;
        context.simGame.overtime = 0;
      } else {
        markComplete(session);
        return;
      }
    }
  }

  if (context.inOvertime && context.otPossession === 0) {
    context.simGame.overtime += 1;
  }

  const isTeamA = context.inOvertime
    ? context.otPossession === 0
    : context.nextOffenseIsTeamA;
  context.currentOffense = isTeamA
    ? context.simGame.teamA
    : context.simGame.teamB;
  context.currentDefense = isTeamA
    ? context.simGame.teamB
    : context.simGame.teamA;
  context.fieldPosition = context.inOvertime
    ? context.simGame.overtime >= 3
      ? TRY_FIELD_POSITION
      : OT_START_YARD_LINE
    : context.fieldPosition;
  context.driveStartQuarter = context.simGame.quarter;

  const simContext = buildSimContext(context, !context.inOvertime);
  if (!simContext) {
    throw new Error('The next drive could not be initialized.');
  }
  context.currentDriveState =
    context.inOvertime && context.simGame.overtime >= 3
      ? startOvertimeShootoutDrive(simContext, context.driveNum)
      : startInteractiveDrive(
          simContext,
          context.fieldPosition,
          context.driveNum,
        );
};

const finishDrive = (
  session: GameSimSession,
  driveState: InteractiveDriveState,
  nextFieldPosition: number | null,
  gameComplete: boolean,
) => {
  const { context } = session;
  session.driveRecords.push(driveState.drive);
  context.fieldPosition = nextFieldPosition ?? context.fieldPosition;
  context.driveNum += 1;

  if (gameComplete) {
    markComplete(session);
    return;
  }

  if (context.inOvertime) {
    context.otPossession += 1;
    if (context.otPossession >= 2) {
      if (context.simGame.scoreA !== context.simGame.scoreB) {
        markComplete(session);
        return;
      }
      context.otPossession = 0;
    }
  } else {
    const halftimeReached =
      context.driveStartQuarter === 2 &&
      context.simGame.quarter === 3 &&
      context.simGame.clockSecondsLeft === SECONDS_PER_QUARTER;
    context.nextOffenseIsTeamA = halftimeReached
      ? !context.openingIsTeamA
      : !context.nextOffenseIsTeamA;
  }

  startNextDrive(session);
};

const stepSession = (
  session: GameSimSession,
  decision: SimulationDecision,
  selectedTempo: ClockTempo | 'auto',
  timeoutAfterPlay: boolean,
  useArmedTimeout: boolean,
) => {
  const { context } = session;
  if (
    !context.currentDriveState ||
    !context.currentOffense ||
    !context.currentDefense
  ) {
    throw new Error('The current play is unavailable.');
  }

  const simContext = buildSimContext(context, !context.inOvertime);
  if (!simContext) {
    throw new Error('The current play could not be initialized.');
  }
  const result = stepInteractiveDrive(
    simContext,
    context.currentDriveState,
    buildGameSimStepInstruction({
      call: decision,
      drivePhase: context.currentDriveState.phase,
      userTeamId: context.userTeamId,
      offenseId: context.currentOffense.id,
      defenseId: context.currentDefense.id,
      selectedTempo,
      timeoutAfterPlay,
      useArmedTimeout,
    }),
    !context.inOvertime,
  );
  context.currentDriveState = result.state as InteractiveDriveState;
  return result;
};

export const createGameSimSession = ({
  league,
  record,
  teamsById,
  starters,
  playersById,
  simGame,
  preRecordA,
  preRecordB,
  isUserGame,
}: GameSimSessionInput): GameSimSession => {
  simGame.scoreA = 0;
  simGame.scoreB = 0;
  simGame.overtime = 0;
  simGame.quarter = 1;
  simGame.clockSecondsLeft = SECONDS_PER_QUARTER;
  simGame.clockRunning = false;
  simGame.timeoutsRemainingA = 3;
  simGame.timeoutsRemainingB = 3;
  simGame.winner = null;
  simGame.resultA = null;
  simGame.resultB = null;

  const openingIsTeamA = isTeamAOpeningOffense(simGame);
  const userTeamId = isUserGame
    ? league.teams.find(team => team.name === league.info.team)?.id ?? null
    : null;
  const session: GameSimSession = {
    context: {
      league,
      record,
      teamsById,
      starters,
      playersById,
      simGame,
      preRecordA,
      preRecordB,
      userTeamId,
      driveNum: 0,
      fieldPosition: kickoffStartFieldPosition(),
      inOvertime: false,
      otPossession: 0,
      openingIsTeamA,
      nextOffenseIsTeamA: openingIsTeamA,
      driveStartQuarter: simGame.quarter,
      currentDriveState: null,
      currentOffense: null,
      currentDefense: null,
    },
    driveRecords: [],
    playRecords: [],
    complete: false,
  };
  startNextDrive(session);
  return session;
};

export const advanceGameSimSession = (
  session: GameSimSession,
  {
    scope,
    decision,
    selectedTempo,
    timeoutAfterPlay,
  }: GameSimSessionAdvanceInput,
): GameSimSessionAdvanceResult => {
  if (session.complete) {
    throw new Error('The game simulation is already complete.');
  }

  if (scope === 'play') {
    const result = stepSession(
      session,
      decision,
      selectedTempo,
      timeoutAfterPlay,
      true,
    );
    const driveState = result.state as InteractiveDriveState;
    session.playRecords.push(result.play);
    if (result.driveComplete) {
      finishDrive(
        session,
        driveState,
        result.nextFieldPosition,
        result.gameComplete,
      );
    }
    return {
      plays: [result.play],
      drive: driveState.drive,
      driveComplete: result.driveComplete,
      gameComplete: session.complete,
    };
  }

  const plays: PlayRecord[] = [];
  let finalResult: ReturnType<typeof stepInteractiveDrive> | null = null;
  for (let step = 0; step < MAX_PLAYS_PER_DRIVE; step += 1) {
    finalResult = stepSession(
      session,
      'auto',
      selectedTempo,
      timeoutAfterPlay,
      step === 0,
    );
    plays.push(finalResult.play);
    if (finalResult.driveComplete) break;
  }
  if (!finalResult?.driveComplete) {
    throw new Error('The drive exceeded the simulation safety limit.');
  }

  const driveState = finalResult.state as InteractiveDriveState;
  session.playRecords.push(...plays);
  finishDrive(
    session,
    driveState,
    finalResult.nextFieldPosition,
    finalResult.gameComplete,
  );
  return {
    plays,
    drive: driveState.drive,
    driveComplete: true,
    gameComplete: session.complete,
  };
};
