import { useRef, useState } from 'react';
import {
  finalizeGameSimulation,
  prepareInteractiveLiveGame,
} from '../../domain/sim';
import { buildSimContext } from '../../domain/sim/interactive';
import {
  buildGameData,
  finalizeGameResult,
  isTeamAOpeningOffense,
  OT_START_YARD_LINE,
} from '../../domain/sim/engine';
import { SECONDS_PER_QUARTER } from '../../domain/sim/clock';
import {
  AUTO_STEP_INSTRUCTION,
  canShowKneel,
  canShowSpike,
  chooseAutomaticClockAction,
} from '../../domain/sim/clockManagement';
import { decideFourthDown } from '../../domain/sim/playcalling';
import {
  startInteractiveDrive,
  startOvertimeShootoutDrive,
  stepInteractiveDrive,
} from '../../domain/sim/drive';
import { kickoffStartFieldPosition } from '../../domain/sim/kickoffs';
import {
  TRY_FIELD_POSITION,
  chooseAutomaticTryAttempt,
  extraPointAllowed,
} from '../../domain/sim/conversions';
import { emptyPlayParticipants } from '../../domain/sim/participants';
import {
  buildDriveUi,
  buildNextHeader,
  mapPlayRecord,
} from '../../domain/sim/ui';
import type {
  ClockTempo,
  DriveRecord,
  GameRecord,
  PlayerRecord,
  PlayRecord,
} from '../../types/db';
import type { Team } from '../../types/domain';
import type { Drive, GameData, Play } from '../../types/game';
import type { LeagueState } from '../../types/league';
import type {
  InteractiveDriveState,
  InteractivePlayChoice,
  InteractiveStepInstruction,
  SimGame,
  StartersCache,
} from '../../types/sim';

export type SimulationPhase =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'advancing'
  | 'finalizing'
  | 'complete'
  | 'error';

export type SimulationErrorKind = 'preparation' | 'simulation' | 'finalization';
export type SimulationAdvanceScope = 'play' | 'drive' | 'game';
export type SimulationDecision = InteractivePlayChoice;

export type SimulationDecisionPrompt = {
  side: 'offense' | 'defense';
  type: 'scrimmage' | 'fourth_down' | 'try';
  down: number;
  yardsLeft: number;
  fieldPosition: number;
  allowExtraPoint?: boolean;
};

export type SimulationError = {
  kind: SimulationErrorKind;
  message: string;
};

type SimulationContext = {
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

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useGameSim = ({ gameId }: { gameId: number | null }) => {
  const [phase, setPhase] = useState<SimulationPhase>('idle');
  const [error, setError] = useState<SimulationError | null>(null);
  const [plays, setPlays] = useState<Play[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [decisionPrompt, setDecisionPrompt] = useState<SimulationDecisionPrompt | null>(null);
  const [coachingEnabled, setCoachingEnabled] = useState(false);
  const [selectedTempo, setSelectedTempo] = useState<ClockTempo | 'auto'>('auto');
  const [timeoutAfterPlay, setTimeoutAfterPlay] = useState(false);

  const phaseRef = useRef<SimulationPhase>('idle');
  const actionLockedRef = useRef(false);
  const sessionTokenRef = useRef(0);
  const playsRef = useRef<Play[]>([]);
  const drivesRef = useRef<Map<number, Drive>>(new Map());
  const driveRecordsRef = useRef<DriveRecord[]>([]);
  const playRecordsRef = useRef<PlayRecord[]>([]);
  const contextRef = useRef<SimulationContext | null>(null);
  const selectedTempoRef = useRef<ClockTempo | 'auto'>('auto');
  const timeoutAfterPlayRef = useRef(false);

  const selectTempo = (tempo: ClockTempo | 'auto') => {
    selectedTempoRef.current = tempo;
    setSelectedTempo(tempo);
  };

  const armTimeoutAfterPlay = (armed: boolean) => {
    timeoutAfterPlayRef.current = armed;
    setTimeoutAfterPlay(armed);
  };

  const updatePhase = (nextPhase: SimulationPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  };

  const getCurrentPhase = (): SimulationPhase => phaseRef.current;

  const clearSession = () => {
    playsRef.current = [];
    drivesRef.current = new Map();
    driveRecordsRef.current = [];
    playRecordsRef.current = [];
    contextRef.current = null;
    actionLockedRef.current = false;
    setPlays([]);
    setDrives([]);
    setGameData(null);
    setCurrentPlayIndex(0);
    setDecisionPrompt(null);
    setCoachingEnabled(false);
    selectTempo('auto');
    armTimeoutAfterPlay(false);
    setError(null);
  };

  const reset = () => {
    sessionTokenRef.current += 1;
    clearSession();
    updatePhase('idle');
  };

  const buildDecisionPrompt = (
    state: InteractiveDriveState,
    side: SimulationDecisionPrompt['side'],
  ): SimulationDecisionPrompt => ({
    side,
    type: side === 'offense' && state.down === 4 ? 'fourth_down' : 'scrimmage',
    down: state.down,
    yardsLeft: state.yardsLeft,
    fieldPosition: state.fieldPosition,
  });

  const updateDecisionPrompt = (driveState: InteractiveDriveState | null) => {
    const context = contextRef.current;
    if (!context || !driveState || !context.userTeamId) {
      setDecisionPrompt(null);
      return;
    }
    if (driveState.phase === 'try' && driveState.tryOrigin) {
      const automaticAttempt = context.currentOffense
        ? chooseAutomaticTryAttempt({
            game: context.simGame,
            offense: context.currentOffense,
            origin: driveState.tryOrigin,
            overtimePossession: context.inOvertime
              ? context.otPossession as 0 | 1
              : null,
          })
        : 'extra_point';
      if (context.currentOffense?.id === context.userTeamId) {
        setDecisionPrompt({
          ...buildDecisionPrompt(driveState, 'offense'),
          type: 'try',
          allowExtraPoint: extraPointAllowed(context.simGame, driveState.tryOrigin),
        });
      } else if (
        context.currentDefense?.id === context.userTeamId
        && automaticAttempt === 'two_point'
      ) {
        setDecisionPrompt({
          ...buildDecisionPrompt(driveState, 'defense'),
          type: 'try',
          allowExtraPoint: false,
        });
      } else {
        setDecisionPrompt(null);
      }
      return;
    }
    if (context.currentOffense?.id === context.userTeamId) {
      setDecisionPrompt(buildDecisionPrompt(driveState, 'offense'));
      return;
    }
    if (context.currentDefense?.id === context.userTeamId) {
      if (!context.inOvertime) {
        const simContext = buildSimContext(context, true);
        if (simContext && chooseAutomaticClockAction({
          game: context.simGame,
          offense: simContext.offense,
          defense: simContext.defense,
          offenseLead: simContext.lead,
          down: driveState.down,
          clock: {
            quarter: context.simGame.quarter,
            secondsLeft: context.simGame.clockSecondsLeft,
            clockRunning: context.simGame.clockRunning,
          },
        })) {
          setDecisionPrompt(null);
          return;
        }
      }
      const fourthDownCall = driveState.down === 4
        ? decideFourthDown(
            driveState.fieldPosition,
            driveState.yardsLeft,
            driveState.drive.points_needed,
          )
        : 'go';
      setDecisionPrompt(
        fourthDownCall === 'go' ? buildDecisionPrompt(driveState, 'defense') : null,
      );
      return;
    }
    setDecisionPrompt(null);
  };

  const upsertDriveUi = (driveRecord: DriveRecord) => {
    const context = contextRef.current;
    if (!context) return null;
    const existing = drivesRef.current.get(driveRecord.id);
    if (existing) return existing;
    const created = buildDriveUi(driveRecord, context.teamsById);
    drivesRef.current.set(driveRecord.id, created);
    return created;
  };

  const publishDrivePlays = (
    driveRecord: DriveRecord,
    newPlays: PlayRecord[],
    driveComplete = false
  ) => {
    const driveUi = upsertDriveUi(driveRecord);
    if (!driveUi) return;

    const mappedPlays = newPlays.map(mapPlayRecord);
    driveUi.plays = [...driveUi.plays, ...mappedPlays];
    driveUi.yards = driveUi.plays.reduce(
      (sum, play) => sum + (play.call.kind === 'try' ? 0 : play.yardsGained),
      0,
    );

    if (driveComplete) {
      driveUi.result = driveRecord.result;
      driveUi.points = driveRecord.points;
      driveUi.scoreAAfter = driveRecord.scoreAAfter;
      driveUi.scoreBAfter = driveRecord.scoreBAfter;
    }

    drivesRef.current.set(driveRecord.id, driveUi);
    setDrives(
      Array.from(drivesRef.current.values()).sort((a, b) => a.driveNum - b.driveNum)
    );

    if (mappedPlays.length > 0) {
      playsRef.current = [...playsRef.current, ...mappedPlays];
      setPlays(playsRef.current);
      setCurrentPlayIndex(playsRef.current.length - 1);
    }
  };

  const finishGame = async () => {
    const context = contextRef.current;
    if (!context) throw new Error('Simulation context is unavailable.');

    finalizeGameResult(context.simGame);
    setDecisionPrompt(null);
    setCurrentPlayIndex(playsRef.current.length);
    updatePhase('finalizing');

    try {
      const result = await finalizeGameSimulation({
        league: context.league,
        record: context.record,
        simGame: context.simGame,
        driveRecords: driveRecordsRef.current,
        playRecords: playRecordsRef.current,
        starters: context.starters,
        playersById: context.playersById,
        preRecordA: context.preRecordA,
        preRecordB: context.preRecordB,
      });
      setGameData(result.game);
      setDrives(result.drives);
      updatePhase('complete');
    } catch (finalizationError) {
      setError({
        kind: 'finalization',
        message: messageFromError(finalizationError, 'The completed game could not be saved.'),
      });
      updatePhase('error');
    }
  };

  const advanceToNextDrive = async () => {
    const context = contextRef.current;
    if (!context) throw new Error('Simulation context is unavailable.');

    if (!context.inOvertime) {
      const regulationEnded =
        context.simGame.quarter === 4 && context.simGame.clockSecondsLeft === 0;
      if (regulationEnded) {
        if (context.simGame.scoreA === context.simGame.scoreB) {
          context.inOvertime = true;
          context.otPossession = 0;
          context.simGame.overtime = 0;
        } else {
          await finishGame();
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
    context.currentOffense = isTeamA ? context.simGame.teamA : context.simGame.teamB;
    context.currentDefense = isTeamA ? context.simGame.teamB : context.simGame.teamA;
    context.fieldPosition = context.inOvertime
      ? context.simGame.overtime >= 3 ? TRY_FIELD_POSITION : OT_START_YARD_LINE
      : context.fieldPosition;
    context.driveStartQuarter = context.simGame.quarter;

    const simContext = buildSimContext(context, !context.inOvertime);
    if (!simContext) throw new Error('The next drive could not be initialized.');
    const driveState = context.inOvertime && context.simGame.overtime >= 3
      ? startOvertimeShootoutDrive(simContext, context.driveNum)
      : startInteractiveDrive(simContext, context.fieldPosition, context.driveNum);
    context.currentDriveState = driveState;
    updateDecisionPrompt(driveState);
  };

  const finalizeDrive = async (
    driveState: InteractiveDriveState,
    nextFieldPosition: number | null,
    gameComplete: boolean
  ) => {
    const context = contextRef.current;
    if (!context) throw new Error('Simulation context is unavailable.');

    driveRecordsRef.current.push(driveState.drive);
    context.fieldPosition = nextFieldPosition ?? context.fieldPosition;
    setGameData(previous => previous
      ? {
          ...previous,
          scoreA: context.simGame.scoreA,
          scoreB: context.simGame.scoreB,
        }
      : previous
    );
    context.driveNum += 1;
    selectTempo('auto');
    armTimeoutAfterPlay(false);

    if (gameComplete) {
      await finishGame();
      return;
    }

    if (context.inOvertime) {
      context.otPossession += 1;
      if (context.otPossession >= 2) {
        if (context.simGame.scoreA !== context.simGame.scoreB) {
          await finishGame();
          return;
        }
        context.otPossession = 0;
      }
    } else {
      const halftimeReached =
        context.driveStartQuarter === 2
        && context.simGame.quarter === 3
        && context.simGame.clockSecondsLeft === SECONDS_PER_QUARTER;
      context.nextOffenseIsTeamA = halftimeReached
        ? !context.openingIsTeamA
        : !context.nextOffenseIsTeamA;
    }

    await advanceToNextDrive();
  };

  const applyStepResult = async (
    stepResult: ReturnType<typeof stepInteractiveDrive>,
    publish = true
  ) => {
    const context = contextRef.current;
    if (!context) throw new Error('Simulation context is unavailable.');

    const driveState = stepResult.state as InteractiveDriveState;
    context.currentDriveState = driveState;
    playRecordsRef.current.push(stepResult.play);
    setGameData(previous => previous
      ? {
          ...previous,
          scoreA: context.simGame.scoreA,
          scoreB: context.simGame.scoreB,
        }
      : previous
    );

    if (publish) {
      publishDrivePlays(driveState.drive, [stepResult.play], stepResult.driveComplete);
    }

    if (stepResult.driveComplete) {
      await finalizeDrive(
        driveState,
        stepResult.nextFieldPosition,
        stepResult.gameComplete
      );
    } else {
      updateDecisionPrompt(driveState);
    }
  };

  const buildStepInstruction = (
    call: SimulationDecision,
    useArmedTimeout: boolean,
  ): InteractiveStepInstruction => {
    const context = contextRef.current;
    if (!context || !context.currentOffense || !context.currentDefense) {
      return { ...AUTO_STEP_INSTRUCTION, timeoutAfter: { ...AUTO_STEP_INSTRUCTION.timeoutAfter } };
    }
    if (context.currentDriveState?.phase === 'try') {
      return {
        call,
        tempo: 'auto',
        timeoutAfter: { offense: 'hold', defense: 'hold' },
      };
    }
    const userOnOffense = context.currentOffense.id === context.userTeamId;
    const userOnDefense = context.currentDefense.id === context.userTeamId;
    return {
      call,
      tempo: userOnOffense ? selectedTempoRef.current : 'auto',
      timeoutAfter: {
        offense: userOnOffense
          ? useArmedTimeout && timeoutAfterPlayRef.current ? 'use' : 'hold'
          : 'auto',
        defense: userOnDefense
          ? useArmedTimeout && timeoutAfterPlayRef.current ? 'use' : 'hold'
          : 'auto',
      },
    };
  };

  const advanceOnePlay = async (decision: SimulationDecision) => {
    const context = contextRef.current;
    if (
      !context
      || !context.currentDriveState
      || !context.currentOffense
      || !context.currentDefense
    ) {
      throw new Error('The current play is unavailable.');
    }

    const simContext = buildSimContext(context, !context.inOvertime);
    if (!simContext) throw new Error('The current play could not be initialized.');
    const stepResult = stepInteractiveDrive(
      simContext,
      context.currentDriveState,
      buildStepInstruction(decision, true),
      !context.inOvertime
    );
    armTimeoutAfterPlay(false);
    await applyStepResult(stepResult);
  };

  const advanceOneDrive = async () => {
    const context = contextRef.current;
    if (
      !context
      || !context.currentDriveState
      || !context.currentOffense
      || !context.currentDefense
    ) {
      throw new Error('The current drive is unavailable.');
    }

    let driveState = context.currentDriveState;
    const playBuffer: PlayRecord[] = [];
    let stepResult: ReturnType<typeof stepInteractiveDrive> | null = null;

    for (let step = 0; step < 200; step += 1) {
      const simContext = buildSimContext(context, !context.inOvertime);
      if (!simContext) throw new Error('The current drive could not be initialized.');
      stepResult = stepInteractiveDrive(
        simContext,
        driveState,
        buildStepInstruction('auto', step === 0),
        !context.inOvertime
      );
      if (step === 0) armTimeoutAfterPlay(false);
      playBuffer.push(stepResult.play);
      driveState = stepResult.state as InteractiveDriveState;
      if (stepResult.driveComplete) break;
    }

    if (!stepResult?.driveComplete) {
      throw new Error('The drive exceeded the simulation safety limit.');
    }

    context.currentDriveState = driveState;
    playRecordsRef.current.push(...playBuffer);
    publishDrivePlays(driveState.drive, playBuffer, true);
    await finalizeDrive(
      driveState,
      stepResult.nextFieldPosition,
      stepResult.gameComplete
    );
  };

  const advanceToEnd = async () => {
    for (let drive = 0; drive < 5000; drive += 1) {
      if (phaseRef.current === 'complete' || phaseRef.current === 'error') return;
      await advanceOneDrive();
      const nextPhase = getCurrentPhase();
      if (nextPhase === 'complete' || nextPhase === 'error') return;
    }
    throw new Error('The game exceeded the simulation safety limit.');
  };

  const advance = async (
    scope: SimulationAdvanceScope,
    decision: SimulationDecision = 'auto'
  ) => {
    if (actionLockedRef.current || phaseRef.current !== 'ready') return;

    actionLockedRef.current = true;
    setError(null);
    updatePhase('advancing');
    try {
      if (scope === 'play') {
        await advanceOnePlay(decision);
      } else if (scope === 'drive') {
        await advanceOneDrive();
      } else {
        await advanceToEnd();
      }

      const nextPhase = getCurrentPhase();
      if (nextPhase === 'advancing') {
        updatePhase('ready');
      }
    } catch (simulationError) {
      setDecisionPrompt(null);
      setError({
        kind: 'simulation',
        message: messageFromError(simulationError, 'The game could not be advanced.'),
      });
      updatePhase('error');
    } finally {
      actionLockedRef.current = false;
    }
  };

  const start = async () => {
    if (!gameId || actionLockedRef.current) return;

    const sessionToken = sessionTokenRef.current + 1;
    sessionTokenRef.current = sessionToken;
    clearSession();
    actionLockedRef.current = true;
    updatePhase('preparing');

    try {
      const response = await prepareInteractiveLiveGame(gameId);
      if (sessionToken !== sessionTokenRef.current) return;

      if (response.status === 'complete') {
        const persistedPlays = response.drives.flatMap(drive => drive.plays);
        setDrives(response.drives);
        setPlays(persistedPlays);
        playsRef.current = persistedPlays;
        setGameData(response.game);
        setCurrentPlayIndex(Math.max(0, persistedPlays.length - 1));
        setCoachingEnabled(response.is_user_game);
        updatePhase('complete');
        return;
      }

      response.simGame.scoreA = 0;
      response.simGame.scoreB = 0;
      response.simGame.overtime = 0;
      response.simGame.quarter = 1;
      response.simGame.clockSecondsLeft = SECONDS_PER_QUARTER;
      response.simGame.clockRunning = false;
      response.simGame.timeoutsRemainingA = 3;
      response.simGame.timeoutsRemainingB = 3;
      response.simGame.winner = null;
      response.simGame.resultA = null;
      response.simGame.resultB = null;

      const userTeamId = response.is_user_game
        ? response.league.teams.find(team => team.name === response.league.info.team)?.id ?? null
        : null;
      const openingIsTeamA = isTeamAOpeningOffense(response.simGame);
      contextRef.current = {
        league: response.league,
        record: response.record,
        teamsById: response.teamsById,
        starters: response.starters,
        playersById: response.playersById,
        simGame: response.simGame,
        preRecordA: response.preRecordA,
        preRecordB: response.preRecordB,
        userTeamId,
        driveNum: 0,
        fieldPosition: kickoffStartFieldPosition(),
        inOvertime: false,
        otPossession: 0,
        openingIsTeamA,
        nextOffenseIsTeamA: openingIsTeamA,
        driveStartQuarter: response.simGame.quarter,
        currentDriveState: null,
        currentOffense: null,
        currentDefense: null,
      };

      setCoachingEnabled(response.is_user_game);
      setGameData(buildGameData(response.record, response.teamsById));
      await advanceToNextDrive();
      if (phaseRef.current === 'preparing') updatePhase('ready');
    } catch (preparationError) {
      if (sessionToken !== sessionTokenRef.current) return;
      setError({
        kind: 'preparation',
        message: messageFromError(preparationError, 'The game could not be prepared.'),
      });
      updatePhase('error');
    } finally {
      if (sessionToken === sessionTokenRef.current) {
        actionLockedRef.current = false;
      }
    }
  };

  const context = contextRef.current;
  const lastPlay = plays.length > 0 ? plays[plays.length - 1] : null;
  const currentPlay = plays.length > 0 ? plays[currentPlayIndex] ?? null : null;
  const previousPlay =
    plays.length > 0 && currentPlayIndex > 0
      ? plays[currentPlayIndex - 1]
      : null;
  const driveState = context?.currentDriveState ?? null;

  const displayPlay: Play | null = driveState
    ? {
        id: currentPlay?.id ?? -1,
        driveId: currentPlay?.driveId,
        down: driveState.down,
        yardsLeft: driveState.yardsLeft,
        startingFP: driveState.fieldPosition,
        playType: currentPlay?.playType ?? '',
        yardsGained: currentPlay?.yardsGained ?? 0,
        text: currentPlay?.text ?? '',
        header: driveState.phase === 'try'
          ? 'Try'
          : buildNextHeader(
              driveState.fieldPosition,
              driveState.down,
              driveState.yardsLeft
            ),
        result: currentPlay?.result ?? '',
        scoreA: gameData?.scoreA ?? 0,
        scoreB: gameData?.scoreB ?? 0,
        call: currentPlay?.call ?? {
          kind: 'scrimmage',
          offense: 'inside_run',
          defense: 'base',
        },
        participants: currentPlay?.participants ?? emptyPlayParticipants(),
        timing: currentPlay?.timing ?? {
          kind: context?.inOvertime ? 'overtime' : 'regulation',
          ...(context?.inOvertime
            ? {
                period: Math.max(1, context.simGame.overtime),
                outOfBounds: false,
              }
            : {
                start: {
                  quarter: (context?.simGame.quarter ?? 1) as 1 | 2 | 3 | 4,
                  secondsLeft: context?.simGame.clockSecondsLeft ?? SECONDS_PER_QUARTER,
                  running: context?.simGame.clockRunning ?? false,
                },
                end: {
                  quarter: (context?.simGame.quarter ?? 1) as 1 | 2 | 3 | 4,
                  secondsLeft: context?.simGame.clockSecondsLeft ?? SECONDS_PER_QUARTER,
                  running: context?.simGame.clockRunning ?? false,
                },
                elapsedSeconds: 0,
                outOfBounds: false,
                tempo: 'normal',
                eventAfter: null,
                chargedTimeoutAfter: null,
              }),
        } as Play['timing'],
      }
    : currentPlay;

  const displayDrive: Drive | null = driveState
    ? {
        driveNum: driveState.drive.driveNum,
        offense: context?.currentOffense?.name ?? '',
        defense: context?.currentDefense?.name ?? '',
        startingFP: driveState.drive.startingFP,
        result: driveState.drive.result,
        points: driveState.drive.points,
        scoreAAfter: driveState.drive.scoreAAfter,
        scoreBAfter: driveState.drive.scoreBAfter,
        plays: [],
        yards: 0,
      }
    : null;

  const isTeamAOnOffense = displayDrive
    ? displayDrive.offense === gameData?.teamA.name
    : context?.currentOffense?.id === gameData?.teamA.id;
  const fieldPosition =
    displayPlay?.startingFP
    ?? driveState?.fieldPosition
    ?? kickoffStartFieldPosition();
  const previousPlayYards = coachingEnabled && driveState
    ? (
        lastPlay
        && (!lastPlay.driveId || lastPlay.driveId === driveState.drive.id)
          ? lastPlay.yardsGained || 0
          : 0
      )
    : currentPlay && previousPlay
      ? previousPlay.yardsGained
      : 0;
  const isBusy =
    phase === 'preparing'
    || phase === 'advancing'
    || phase === 'finalizing';
  const userSide: 'offense' | 'defense' | null = driveState?.phase === 'try'
    ? null
    : context?.userTeamId && context.currentOffense?.id === context.userTeamId
      ? 'offense'
      : context?.userTeamId && context.currentDefense?.id === context.userTeamId
        ? 'defense'
        : null;
  const userTimeoutsRemaining = context?.userTeamId === context?.simGame.teamA.id
    ? context?.simGame.timeoutsRemainingA ?? 0
    : context?.userTeamId === context?.simGame.teamB.id
      ? context?.simGame.timeoutsRemainingB ?? 0
      : 0;
  const offenseLead = context?.currentOffense?.id === context?.simGame.teamA.id
    ? (context?.simGame.scoreA ?? 0) - (context?.simGame.scoreB ?? 0)
    : (context?.simGame.scoreB ?? 0) - (context?.simGame.scoreA ?? 0);
  const managementClock = {
    quarter: context?.simGame.quarter ?? 1,
    secondsLeft: context?.simGame.clockSecondsLeft ?? SECONDS_PER_QUARTER,
    clockRunning: context?.simGame.clockRunning ?? false,
  };

  return {
    state: {
      phase,
      error,
      plays,
      drives,
      gameData,
      currentPlayIndex,
      isGameComplete: phase === 'complete',
      isPlaybackComplete: phase === 'complete',
      isBusy,
      canClose: !isBusy,
      hasProgress: playRecordsRef.current.length > 0,
      coachingEnabled,
      decisionPrompt,
      displayPlay,
      displayDrive,
      isTeamAOnOffense,
      openingIsTeamA: context?.openingIsTeamA ?? true,
      fieldPosition,
      previousPlayYards,
      lastPlayText: lastPlay?.text ?? '',
      quarter: context?.simGame.quarter ?? 1,
      clockSecondsLeft: context?.simGame.clockSecondsLeft ?? SECONDS_PER_QUARTER,
      inOvertime: context?.inOvertime ?? false,
      overtimeCount: context?.simGame.overtime ?? 0,
      clockRunning: managementClock.clockRunning,
      timeoutsRemainingA: context?.simGame.timeoutsRemainingA ?? 3,
      timeoutsRemainingB: context?.simGame.timeoutsRemainingB ?? 3,
      userSide,
      userTimeoutsRemaining,
      selectedTempo,
      timeoutAfterPlay,
      canUseTimeout: Boolean(userSide) && !context?.inOvertime && userTimeoutsRemaining > 0,
      canShowSpike: userSide === 'offense'
        && !context?.inOvertime
        && Boolean(driveState)
        && canShowSpike(driveState?.down ?? 1, managementClock),
      canShowKneel: userSide === 'offense'
        && !context?.inOvertime
        && Boolean(driveState)
        && canShowKneel(offenseLead, managementClock),
    },
    actions: {
      start,
      reset,
      advance,
      setTempo: selectTempo,
      setTimeoutAfterPlay: armTimeoutAfterPlay,
      retryPreparation: start,
    },
  };
};
