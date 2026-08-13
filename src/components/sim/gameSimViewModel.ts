import { SECONDS_PER_QUARTER } from '../../domain/sim/clock';
import { canShowKneel, canShowSpike } from '../../domain/sim/clockManagement';
import { kickoffStartFieldPosition } from '../../domain/sim/kickoffs';
import { emptyPlayParticipants } from '../../domain/sim/participants';
import { buildNextHeader } from '../../domain/sim/ui';
import type { Team } from '../../types/domain';
import type { Drive, GameData, Play } from '../../types/game';
import type { InteractiveDriveState, SimGame } from '../../types/sim';
import type { GameSimUserSide, SimulationPhase } from './gameSimTypes';

type GameSimViewContext = {
  simGame: SimGame;
  userTeamId: number | null;
  inOvertime: boolean;
  currentDriveState: InteractiveDriveState | null;
  currentOffense: Team | null;
  currentDefense: Team | null;
};

type GameSimViewModelInput = {
  phase: SimulationPhase;
  plays: Play[];
  currentPlayIndex: number;
  gameData: GameData | null;
  context: GameSimViewContext | null;
};

export const buildGameSimViewModel = ({
  phase,
  plays,
  currentPlayIndex,
  gameData,
  context,
}: GameSimViewModelInput) => {
  const lastPlay = plays.length > 0 ? plays[plays.length - 1] : null;
  const currentPlay = plays.length > 0 ? plays[currentPlayIndex] ?? null : null;
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
              driveState.yardsLeft,
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
  const fieldPosition = displayPlay?.startingFP
    ?? driveState?.fieldPosition
    ?? kickoffStartFieldPosition();
  const isBusy = phase === 'preparing' || phase === 'advancing' || phase === 'finalizing';
  const userSide: GameSimUserSide = driveState?.phase === 'try'
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
    displayPlay,
    displayDrive,
    isTeamAOnOffense,
    fieldPosition,
    isBusy,
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
    canUseTimeout: Boolean(userSide) && !context?.inOvertime && userTimeoutsRemaining > 0,
    canShowSpike: userSide === 'offense'
      && !context?.inOvertime
      && Boolean(driveState)
      && canShowSpike(driveState?.down ?? 1, managementClock),
    canShowKneel: userSide === 'offense'
      && !context?.inOvertime
      && Boolean(driveState)
      && canShowKneel(offenseLead, managementClock),
  };
};
