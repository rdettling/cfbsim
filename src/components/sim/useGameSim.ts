import { useRef, useState } from 'react';
import {
  prepareInteractiveLiveGame,
  finalizeGameSimulation,
} from '../../domain/sim';
import { buildSimContext } from '../../domain/sim/interactive';
import {
  startInteractiveDrive,
  stepInteractiveDrive,
  buildGameData,
  finalizeGameResult,
  OT_START_YARD_LINE,
  isTeamAOpeningOffense,
  SECONDS_PER_QUARTER,
  kickoffStartFieldPosition,
} from '../../domain/sim/engine';
import type { GameData, Play, Drive } from '../../types/game';
import type { LeagueState } from '../../types/league';
import type { GameRecord, DriveRecord, PlayRecord, PlayerRecord } from '../../types/db';
import type { SimGame, StartersCache, InteractiveDriveState } from '../../types/sim';
import type { Team } from '../../types/domain';
import type { GameControlsProps } from '../../types/components';
import { buildDriveUi, mapPlayRecord, buildNextHeader, resolveDecision } from '../../domain/sim/ui';

export type InteractiveSimState = {
  plays: Play[];
  drives: Drive[];
  gameData: GameData | null;
  currentPlayIndex: number;
  isGameComplete: boolean;
  isPlaybackComplete: boolean;
  decisionPrompt: GameControlsProps['decisionPrompt'] | null;
  submittingDecision: boolean;
  displayPlay: Play | null;
  displayDrive: Drive | null;
  isTeamAOnOffense: boolean;
  openingIsTeamA: boolean;
  fieldPosition: number;
  previousPlayYards: number;
  lastPlayText: string;
  isUserOffenseNow: boolean;
  quarter: number;
  clockSecondsLeft: number;
  inOvertime: boolean;
  overtimeCount: number;
};

type InteractiveContext = {
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

export const useGameSim = ({
  gameId,
  allowUserDecision,
}: {
  gameId: number | null;
  allowUserDecision: boolean;
}) => {
  const [plays, setPlays] = useState<Play[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [decisionPrompt, setDecisionPrompt] = useState<GameControlsProps['decisionPrompt'] | null>(null);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const playsRef = useRef<Play[]>([]);
  const drivesRef = useRef<Map<number, Drive>>(new Map());
  const driveRecordsRef = useRef<DriveRecord[]>([]);
  const playRecordsRef = useRef<PlayRecord[]>([]);
  const contextRef = useRef<InteractiveContext | null>(null);

  const resetRefs = () => {
    playsRef.current = [];
    drivesRef.current = new Map();
    driveRecordsRef.current = [];
    playRecordsRef.current = [];
    contextRef.current = null;
    setDecisionPrompt(null);
    setSubmittingDecision(false);
  };

  const reset = () => {
    setPlays([]);
    setDrives([]);
    setGameData(null);
    setCurrentPlayIndex(0);
    setIsGameComplete(false);
    resetRefs();
  };

  const buildDecisionPrompt = (state: InteractiveDriveState) => ({
    type: state.down === 4 ? 'fourth_down' : 'run_pass',
    down: state.down,
    yards_left: state.yardsLeft,
    field_position: state.fieldPosition,
  }) as GameControlsProps['decisionPrompt'];

  const updateDecisionPrompt = (driveState: InteractiveDriveState | null) => {
    const context = contextRef.current;
    if (!context || !driveState) {
      setDecisionPrompt(null);
      return;
    }
    const isUserOffense = !!context.userTeamId && context.currentOffense?.id === context.userTeamId;
    setDecisionPrompt(isUserOffense ? buildDecisionPrompt(driveState) : null);
  };


  const upsertDriveUi = (driveRecord: DriveRecord) => {
    const context = contextRef.current;
    if (!context) return null;
    const existing = drivesRef.current.get(driveRecord.id);
    if (existing) return existing;
    const created: Drive = buildDriveUi(driveRecord, context.teamsById);
    drivesRef.current.set(driveRecord.id, created);
    return created;
  };

  const addPlaysToDrive = (driveRecord: DriveRecord, newPlays: PlayRecord[], finalizeDrive = false) => {
    const driveUi = upsertDriveUi(driveRecord);
    if (!driveUi) return;

    const mappedPlays = newPlays.map(mapPlayRecord);
    driveUi.plays = [...driveUi.plays, ...mappedPlays];
    driveUi.yards = driveUi.plays.reduce((sum, play) => sum + play.yardsGained, 0);

    if (finalizeDrive) {
      driveUi.result = driveRecord.result;
      driveUi.points = driveRecord.points;
      driveUi.scoreAAfter = driveRecord.scoreAAfter;
      driveUi.scoreBAfter = driveRecord.scoreBAfter;
    }

    drivesRef.current.set(driveRecord.id, driveUi);
    setDrives(Array.from(drivesRef.current.values()).sort((a, b) => a.driveNum - b.driveNum));

    if (mappedPlays.length) {
      playsRef.current = [...playsRef.current, ...mappedPlays];
      setPlays(playsRef.current);
      setCurrentPlayIndex(playsRef.current.length - 1);
    }
  };

  const finalizeDrive = async (
    driveState: InteractiveDriveState,
    nextFieldPosition: number | null,
    gameComplete: boolean
  ) => {
    const context = contextRef.current;
    if (!context) return;

    driveRecordsRef.current.push(driveState.drive);
    const nextField = nextFieldPosition ?? context.fieldPosition;
    context.fieldPosition = nextField;
    setGameData(prev => prev ? { ...prev, scoreA: context.simGame.scoreA, scoreB: context.simGame.scoreB } : prev);
    context.driveNum += 1;
    if (gameComplete) {
      await finishInteractiveGame();
      return;
    }

    if (context.inOvertime) {
      context.otPossession += 1;
      if (context.otPossession >= 2) {
        if (context.simGame.scoreA !== context.simGame.scoreB) {
          await finishInteractiveGame();
          return;
        }
        context.otPossession = 0;
      }
    } else {
      const halftimeReached = context.driveStartQuarter === 2
        && context.simGame.quarter === 3
        && context.simGame.clockSecondsLeft === SECONDS_PER_QUARTER;
      if (halftimeReached) {
        context.nextOffenseIsTeamA = !context.openingIsTeamA;
      } else {
        context.nextOffenseIsTeamA = !context.nextOffenseIsTeamA;
      }
    }

    await advanceToNextDrive();
  };

  const advanceToNextDrive = async () => {
    const context = contextRef.current;
    if (!context) return;

    if (!context.inOvertime) {
      const endOfRegulation = context.simGame.quarter === 4 && context.simGame.clockSecondsLeft === 0;
      if (endOfRegulation) {
        if (context.simGame.scoreA === context.simGame.scoreB) {
          context.inOvertime = true;
          context.otPossession = 0;
          context.simGame.overtime = 0;
        } else {
          await finishInteractiveGame();
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
    const offense = isTeamA ? context.simGame.teamA : context.simGame.teamB;
    const defense = isTeamA ? context.simGame.teamB : context.simGame.teamA;

    let fieldPosition = context.inOvertime
      ? OT_START_YARD_LINE
      : context.fieldPosition;

    context.fieldPosition = fieldPosition;
    context.currentOffense = offense;
    context.currentDefense = defense;
    context.driveStartQuarter = context.simGame.quarter;

    const simContext = buildSimContext(context, !context.inOvertime);
    if (!simContext) return;
    const driveState = startInteractiveDrive(
      simContext,
      fieldPosition,
      context.driveNum
    );
    context.currentDriveState = driveState;
    updateDecisionPrompt(driveState);
  };

  const finishInteractiveGame = async () => {
    const context = contextRef.current;
    if (!context) return;

    finalizeGameResult(context.simGame);
    setDecisionPrompt(null);
    setIsGameComplete(true);
    setCurrentPlayIndex(playsRef.current.length);

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
    } catch (error) {
      console.error('❌ Error finalizing interactive game:', error);
    }
  };

  const start = async () => {
    if (!gameId) return;

    resetRefs();
    const response = await prepareInteractiveLiveGame(gameId);
    if (response.status === 'complete') {
      setDrives(response.drives);
      setPlays(response.drives.flatMap(drive => drive.plays));
      setGameData(response.game);
      setCurrentPlayIndex(0);
      setIsGameComplete(true);
      return;
    }

    response.simGame.scoreA = 0;
    response.simGame.scoreB = 0;
    response.simGame.overtime = 0;
    response.simGame.quarter = 1;
    response.simGame.clockSecondsLeft = SECONDS_PER_QUARTER;
    response.simGame.clockRunning = true;
    response.simGame.winner = null;
    response.simGame.resultA = null;
    response.simGame.resultB = null;

    const context: InteractiveContext = {
      league: response.league,
      record: response.record,
      teamsById: response.teamsById,
      starters: response.starters,
      playersById: response.playersById,
      simGame: response.simGame,
      preRecordA: response.preRecordA,
      preRecordB: response.preRecordB,
      userTeamId: allowUserDecision
        ? response.league.teams.find(team => team.name === response.league.info.team)?.id ?? null
        : null,
      driveNum: 0,
      fieldPosition: kickoffStartFieldPosition(),
      inOvertime: false,
      otPossession: 0,
      openingIsTeamA: isTeamAOpeningOffense(response.simGame),
      nextOffenseIsTeamA: isTeamAOpeningOffense(response.simGame),
      driveStartQuarter: response.simGame.quarter,
      currentDriveState: null,
      currentOffense: null,
      currentDefense: null,
    };
    contextRef.current = context;

    setPlays([]);
    setDrives([]);
    setCurrentPlayIndex(0);
    setIsGameComplete(false);
    setGameData(buildGameData(response.record, response.teamsById));

    await advanceToNextDrive();
  };

  const applyStepResult = async (stepResult: ReturnType<typeof stepInteractiveDrive>) => {
    const context = contextRef.current;
    if (!context) return;

    context.currentDriveState = stepResult.state as InteractiveDriveState;
    addPlaysToDrive(stepResult.state.drive, [stepResult.play], stepResult.driveComplete);
    playRecordsRef.current.push(stepResult.play);

    if (stepResult.driveComplete) {
      await finalizeDrive(stepResult.state, stepResult.nextFieldPosition, stepResult.gameComplete);
    } else {
      updateDecisionPrompt(stepResult.state as InteractiveDriveState);
    }
  };

  const handleDecision = async (decision: string) => {
    const context = contextRef.current;
    if (!context || !context.currentDriveState || !context.currentOffense || !context.currentDefense) return;

    setSubmittingDecision(true);
    try {
      const simContext = buildSimContext(context, !context.inOvertime);
      if (!simContext) return;
      const stepResult = stepInteractiveDrive(
        simContext,
        context.currentDriveState,
        resolveDecision(decision),
        !context.inOvertime
      );
      await applyStepResult(stepResult);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const simulateAutoPlays = async (count: number) => {
    const context = contextRef.current;
    if (!context || !context.currentDriveState || !context.currentOffense || !context.currentDefense) return;

    let remaining = count;
    while (remaining > 0) {
      const simContext = buildSimContext(context, !context.inOvertime);
      if (!simContext) return;
      const stepResult = stepInteractiveDrive(
        simContext,
        context.currentDriveState,
        'auto',
        !context.inOvertime
      );
      await applyStepResult(stepResult);
      if (stepResult.driveComplete) return;
      remaining -= 1;
    }
  };

  const simulateAutoDrive = async () => {
    const context = contextRef.current;
    if (!context || !context.currentDriveState || !context.currentOffense || !context.currentDefense) return;

    let driveState = context.currentDriveState;
    const playBuffer: PlayRecord[] = [];
    let stepResult: ReturnType<typeof stepInteractiveDrive> | null = null;
    let guard = 0;
    while (guard < 200) {
      const simContext = buildSimContext(context, !context.inOvertime);
      if (!simContext) return;
      stepResult = stepInteractiveDrive(
        simContext,
        driveState,
        'auto',
        !context.inOvertime
      );
      playBuffer.push(stepResult.play);
      driveState = stepResult.state as InteractiveDriveState;
      if (stepResult.driveComplete) break;
      guard += 1;
    }

    context.currentDriveState = driveState;
    addPlaysToDrive(driveState.drive, playBuffer, stepResult?.driveComplete ?? false);
    playRecordsRef.current.push(...playBuffer);

    if (stepResult?.driveComplete) {
      await finalizeDrive(driveState, stepResult.nextFieldPosition, stepResult.gameComplete);
    } else {
      updateDecisionPrompt(driveState);
    }
  };

  const simulateToEnd = async () => {
    const context = contextRef.current;
    if (!context || !context.currentDriveState || !context.currentOffense || !context.currentDefense) return;

    let guard = 0;
    while (guard < 5000 && !isGameComplete) {
      if (context.simGame.winner) break;
      await simulateAutoDrive();
      if (context.simGame.winner) break;
      guard += 1;
    }
  };

  const derived = (() => {
    const context = contextRef.current;
    const lastPlay = plays.length ? plays[plays.length - 1] : null;
    const currentPlay = plays.length > 0 ? plays[currentPlayIndex] ?? null : null;
    const previousPlay = plays.length > 0 && currentPlayIndex > 0 ? plays[currentPlayIndex - 1] : null;
    const interactiveState = context?.currentDriveState ?? null;

    const displayPlay = interactiveState
      ? {
          id: currentPlay?.id ?? -1,
          driveId: currentPlay?.driveId,
          down: interactiveState.down,
          yardsLeft: interactiveState.yardsLeft,
          startingFP: interactiveState.fieldPosition,
          playType: currentPlay?.playType ?? '',
          yardsGained: currentPlay?.yardsGained ?? 0,
          text: currentPlay?.text ?? '',
          header: buildNextHeader(
            interactiveState.fieldPosition,
            interactiveState.down,
            interactiveState.yardsLeft
          ),
          result: currentPlay?.result ?? '',
          scoreA: gameData?.scoreA ?? 0,
          scoreB: gameData?.scoreB ?? 0,
        }
      : currentPlay;

    const displayDrive = interactiveState
      ? {
          driveNum: interactiveState.drive.driveNum,
          offense: context?.currentOffense?.name ?? '',
          defense: context?.currentDefense?.name ?? '',
          startingFP: interactiveState.drive.startingFP,
          result: interactiveState.drive.result,
          points: interactiveState.drive.points,
          scoreAAfter: interactiveState.drive.scoreAAfter,
          scoreBAfter: interactiveState.drive.scoreBAfter,
          plays: [],
          yards: 0,
        }
      : null;

    const isUserOffenseNow = allowUserDecision
      && !!context?.currentOffense
      && context.currentOffense.id === context.userTeamId;

    const isTeamAOnOffense = displayDrive
      ? displayDrive.offense === gameData?.teamA.name
      : context?.currentOffense?.id === gameData?.teamA.id;

    const fieldPosition = displayPlay?.startingFP
      || interactiveState?.fieldPosition
      || 20;

    const previousPlayYards = allowUserDecision && interactiveState
      ? (() => {
          if (!lastPlay) return 0;
          if (lastPlay.driveId && lastPlay.driveId !== interactiveState.drive.id) return 0;
          return lastPlay.yardsGained || 0;
        })()
      : (currentPlay && previousPlay ? previousPlay.yardsGained : 0);

    return {
      displayPlay,
      displayDrive,
      isUserOffenseNow,
      isTeamAOnOffense,
      openingIsTeamA: context?.openingIsTeamA ?? true,
      fieldPosition,
      previousPlayYards,
      lastPlayText: lastPlay?.text ?? '',
      quarter: context?.simGame.quarter ?? 1,
      clockSecondsLeft: context?.simGame.clockSecondsLeft ?? SECONDS_PER_QUARTER,
      inOvertime: context?.inOvertime ?? false,
      overtimeCount: context?.simGame.overtime ?? 0,
    };
  })();

  return {
    state: {
      plays,
      drives,
      gameData,
      currentPlayIndex,
      isGameComplete,
      isPlaybackComplete: isGameComplete,
      decisionPrompt,
      submittingDecision,
      displayPlay: derived.displayPlay,
      displayDrive: derived.displayDrive,
      isTeamAOnOffense: derived.isTeamAOnOffense,
      openingIsTeamA: derived.openingIsTeamA,
      fieldPosition: derived.fieldPosition,
      previousPlayYards: derived.previousPlayYards,
      lastPlayText: derived.lastPlayText,
      isUserOffenseNow: derived.isUserOffenseNow,
      quarter: derived.quarter,
      clockSecondsLeft: derived.clockSecondsLeft,
      inOvertime: derived.inOvertime,
      overtimeCount: derived.overtimeCount,
    },
    actions: {
      start,
      reset,
      handleDecision,
      simulateAutoPlays,
      simulateAutoDrive,
      simulateToEnd,
    },
  };
};
