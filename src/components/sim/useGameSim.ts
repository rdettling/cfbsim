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
  startInteractiveDrive,
  startOvertimeShootoutDrive,
  stepInteractiveDrive,
} from '../../domain/sim/drive';
import { kickoffStartFieldPosition } from '../../domain/sim/kickoffs';
import { TRY_FIELD_POSITION } from '../../domain/sim/conversions';
import { buildDriveUi, mapPlayRecord } from '../../domain/sim/ui';
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
  SimGame,
  StartersCache,
} from '../../types/sim';
import {
  buildGameSimStepInstruction,
  resolveGameSimDecisionPrompt,
} from './gameSimDecision';
import type {
  SimulationAdvanceScope,
  SimulationDecision,
  SimulationDecisionPrompt,
  SimulationError,
  SimulationPhase,
} from './gameSimTypes';
import { buildGameSimViewModel } from './gameSimViewModel';

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

  const updateDecisionPrompt = (driveState: InteractiveDriveState | null) => {
    const context = contextRef.current;
    if (!context) {
      setDecisionPrompt(null);
      return;
    }
    setDecisionPrompt(resolveGameSimDecisionPrompt({
      driveState,
      userTeamId: context.userTeamId,
      currentOffense: context.currentOffense,
      currentDefense: context.currentDefense,
      simGame: context.simGame,
      inOvertime: context.inOvertime,
      overtimePossession: context.otPossession,
    }));
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
      buildGameSimStepInstruction({
        call: decision,
        drivePhase: context.currentDriveState.phase,
        userTeamId: context.userTeamId,
        offenseId: context.currentOffense.id,
        defenseId: context.currentDefense.id,
        selectedTempo: selectedTempoRef.current,
        timeoutAfterPlay: timeoutAfterPlayRef.current,
        useArmedTimeout: true,
      }),
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
        buildGameSimStepInstruction({
          call: 'auto',
          drivePhase: driveState.phase,
          userTeamId: context.userTeamId,
          offenseId: context.currentOffense.id,
          defenseId: context.currentDefense.id,
          selectedTempo: selectedTempoRef.current,
          timeoutAfterPlay: timeoutAfterPlayRef.current,
          useArmedTimeout: step === 0,
        }),
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
  const viewModel = buildGameSimViewModel({
    phase,
    plays,
    currentPlayIndex,
    gameData,
    context,
  });

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
      isBusy: viewModel.isBusy,
      canClose: !viewModel.isBusy,
      hasProgress: playRecordsRef.current.length > 0,
      coachingEnabled,
      decisionPrompt,
      displayPlay: viewModel.displayPlay,
      displayDrive: viewModel.displayDrive,
      isTeamAOnOffense: viewModel.isTeamAOnOffense,
      openingIsTeamA: context?.openingIsTeamA ?? true,
      fieldPosition: viewModel.fieldPosition,
      previousPlayYards: viewModel.previousPlayYards,
      lastPlayText: viewModel.lastPlayText,
      quarter: viewModel.quarter,
      clockSecondsLeft: viewModel.clockSecondsLeft,
      inOvertime: viewModel.inOvertime,
      overtimeCount: viewModel.overtimeCount,
      clockRunning: viewModel.clockRunning,
      timeoutsRemainingA: viewModel.timeoutsRemainingA,
      timeoutsRemainingB: viewModel.timeoutsRemainingB,
      userSide: viewModel.userSide,
      userTimeoutsRemaining: viewModel.userTimeoutsRemaining,
      selectedTempo,
      timeoutAfterPlay,
      canUseTimeout: viewModel.canUseTimeout,
      canShowSpike: viewModel.canShowSpike,
      canShowKneel: viewModel.canShowKneel,
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
