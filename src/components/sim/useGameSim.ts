import { useRef, useState } from 'react';
import { buildGameData } from '../../domain/sim/engine';
import {
  finalizeGameSimulation,
  prepareInteractiveLiveGame,
} from '../../domain/sim/orchestrator';
import { buildDriveUi, mapPlayRecord } from '../../domain/sim/ui';
import type { ClockTempo, DriveRecord, PlayRecord } from '../../types/db';
import type { Drive, GameData, Play } from '../../types/game';
import { resolveGameSimDecisionPrompt } from './gameSimDecision';
import {
  advanceGameSimSession,
  createGameSimSession,
  type GameSimSession,
  type GameSimSessionAdvanceResult,
} from './gameSimSession';
import type {
  SimulationAdvanceScope,
  SimulationDecision,
  SimulationDecisionPrompt,
  SimulationError,
  SimulationPhase,
} from './gameSimTypes';
import { buildGameSimViewModel } from './gameSimViewModel';

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useGameSim = ({ gameId }: { gameId: number | null }) => {
  const [phase, setPhase] = useState<SimulationPhase>('idle');
  const [error, setError] = useState<SimulationError | null>(null);
  const [plays, setPlays] = useState<Play[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [decisionPrompt, setDecisionPrompt] =
    useState<SimulationDecisionPrompt | null>(null);
  const [coachingEnabled, setCoachingEnabled] = useState(false);
  const [selectedTempo, setSelectedTempo] =
    useState<ClockTempo | 'auto'>('auto');
  const [timeoutAfterPlay, setTimeoutAfterPlay] = useState(false);

  const phaseRef = useRef<SimulationPhase>('idle');
  const actionLockedRef = useRef(false);
  const sessionTokenRef = useRef(0);
  const playsRef = useRef<Play[]>([]);
  const drivesRef = useRef<Map<number, Drive>>(new Map());
  const sessionRef = useRef<GameSimSession | null>(null);
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
    sessionRef.current = null;
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

  const updateDecisionPrompt = () => {
    const context = sessionRef.current?.context;
    if (!context) {
      setDecisionPrompt(null);
      return;
    }
    setDecisionPrompt(
      resolveGameSimDecisionPrompt({
        driveState: context.currentDriveState,
        userTeamId: context.userTeamId,
        currentOffense: context.currentOffense,
        currentDefense: context.currentDefense,
        simGame: context.simGame,
        inOvertime: context.inOvertime,
        overtimePossession: context.otPossession,
      }),
    );
  };

  const upsertDriveUi = (driveRecord: DriveRecord) => {
    const context = sessionRef.current?.context;
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
    driveComplete = false,
  ) => {
    const driveUi = upsertDriveUi(driveRecord);
    if (!driveUi) return;

    const mappedPlays = newPlays.map(mapPlayRecord);
    driveUi.plays = [...driveUi.plays, ...mappedPlays];
    driveUi.yards = driveUi.plays.reduce(
      (sum, play) =>
        sum + (play.call.kind === 'try' ? 0 : play.yardsGained),
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
      Array.from(drivesRef.current.values()).sort(
        (a, b) => a.driveNum - b.driveNum,
      ),
    );

    if (mappedPlays.length > 0) {
      playsRef.current = [...playsRef.current, ...mappedPlays];
      setPlays(playsRef.current);
      setCurrentPlayIndex(playsRef.current.length - 1);
    }
  };

  const finishGame = async () => {
    const session = sessionRef.current;
    if (!session) throw new Error('Simulation context is unavailable.');
    const { context } = session;

    setDecisionPrompt(null);
    setCurrentPlayIndex(playsRef.current.length);
    updatePhase('finalizing');

    try {
      const result = await finalizeGameSimulation({
        league: context.league,
        record: context.record,
        simGame: context.simGame,
        driveRecords: session.driveRecords,
        playRecords: session.playRecords,
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
        message: messageFromError(
          finalizationError,
          'The completed game could not be saved.',
        ),
      });
      updatePhase('error');
    }
  };

  const applyAdvanceResult = async (
    result: GameSimSessionAdvanceResult,
  ) => {
    const session = sessionRef.current;
    if (!session) throw new Error('Simulation context is unavailable.');
    const { context } = session;

    setGameData(previous =>
      previous
        ? {
            ...previous,
            scoreA: context.simGame.scoreA,
            scoreB: context.simGame.scoreB,
          }
        : previous,
    );
    publishDrivePlays(result.drive, result.plays, result.driveComplete);
    armTimeoutAfterPlay(false);

    if (result.driveComplete) {
      selectTempo('auto');
    }
    if (result.gameComplete) {
      await finishGame();
      return;
    }
    updateDecisionPrompt();
  };

  const advanceSession = async (
    scope: 'play' | 'drive',
    decision: SimulationDecision,
  ) => {
    const session = sessionRef.current;
    if (!session) throw new Error('Simulation context is unavailable.');
    const result = advanceGameSimSession(session, {
      scope,
      decision,
      selectedTempo: selectedTempoRef.current,
      timeoutAfterPlay: timeoutAfterPlayRef.current,
    });
    await applyAdvanceResult(result);
  };

  const advanceToEnd = async () => {
    for (let drive = 0; drive < 5000; drive += 1) {
      if (phaseRef.current === 'complete' || phaseRef.current === 'error') return;
      await advanceSession('drive', 'auto');
      const nextPhase = getCurrentPhase();
      if (nextPhase === 'complete' || nextPhase === 'error') return;
    }
    throw new Error('The game exceeded the simulation safety limit.');
  };

  const advance = async (
    scope: SimulationAdvanceScope,
    decision: SimulationDecision = 'auto',
  ) => {
    if (actionLockedRef.current || phaseRef.current !== 'ready') return;

    actionLockedRef.current = true;
    setError(null);
    updatePhase('advancing');
    try {
      if (scope === 'play') {
        await advanceSession('play', decision);
      } else if (scope === 'drive') {
        await advanceSession('drive', 'auto');
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
        message: messageFromError(
          simulationError,
          'The game could not be advanced.',
        ),
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

      sessionRef.current = createGameSimSession({
        league: response.league,
        record: response.record,
        teamsById: response.teamsById,
        starters: response.starters,
        playersById: response.playersById,
        simGame: response.simGame,
        preRecordA: response.preRecordA,
        preRecordB: response.preRecordB,
        isUserGame: response.is_user_game,
      });
      setCoachingEnabled(response.is_user_game);
      setGameData(buildGameData(response.record, response.teamsById));
      updateDecisionPrompt();
      if (phaseRef.current === 'preparing') updatePhase('ready');
    } catch (preparationError) {
      if (sessionToken !== sessionTokenRef.current) return;
      setError({
        kind: 'preparation',
        message: messageFromError(
          preparationError,
          'The game could not be prepared.',
        ),
      });
      updatePhase('error');
    } finally {
      if (sessionToken === sessionTokenRef.current) {
        actionLockedRef.current = false;
      }
    }
  };

  const context = sessionRef.current?.context ?? null;
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
      hasProgress: (sessionRef.current?.playRecords.length ?? 0) > 0,
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
