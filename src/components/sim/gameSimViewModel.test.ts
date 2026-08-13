import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { GameData } from '../../types/game';
import type { InteractiveDriveState, SimGame } from '../../types/sim';
import { buildGameSimViewModel } from './gameSimViewModel';

const teamA = buildTestTeam({ id: 1, name: 'Alpha' });
const teamB = buildTestTeam({ id: 2, name: 'Beta' });

const buildGame = (overrides: Partial<SimGame> = {}) => ({
  id: 7,
  teamA,
  teamB,
  scoreA: 21,
  scoreB: 14,
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 20,
  clockRunning: true,
  timeoutsRemainingA: 2,
  timeoutsRemainingB: 1,
  ...overrides,
}) as SimGame;

const gameData: GameData = {
  id: 7,
  base_label: 'Regular Season',
  story: null,
  neutralSite: false,
  venue: null,
  teamA: { id: teamA.id, name: teamA.name, ranking: 5, record: teamA.record },
  teamB: { id: teamB.id, name: teamB.name, ranking: 12, record: teamB.record },
  scoreA: 21,
  scoreB: 14,
};

const driveState = (
  overrides: Partial<InteractiveDriveState> = {},
): InteractiveDriveState => ({
  drive: {
    id: 7000,
    gameId: 7,
    driveNum: 0,
    offenseId: teamA.id,
    defenseId: teamB.id,
    startingFP: 25,
    result: '',
    points: 0,
    points_needed: 0,
    scoreAAfter: 21,
    scoreBAfter: 14,
  },
  phase: 'scrimmage',
  tryOrigin: null,
  tryTiming: null,
  fieldPosition: 42,
  down: 2,
  yardsLeft: 6,
  playCount: 1,
  ...overrides,
});

const input = (
  overrides: Partial<Parameters<typeof buildGameSimViewModel>[0]> = {},
): Parameters<typeof buildGameSimViewModel>[0] => ({
  phase: 'ready',
  plays: [],
  currentPlayIndex: 0,
  gameData,
  context: {
    simGame: buildGame(),
    userTeamId: teamA.id,
    inOvertime: false,
    currentDriveState: driveState(),
    currentOffense: teamA,
    currentDefense: teamB,
  },
  ...overrides,
});

describe('game simulation view model', () => {
  it('builds active-play, possession, field, and management state', () => {
    const view = buildGameSimViewModel(input());

    expect(view.displayPlay).toMatchObject({
      down: 2,
      yardsLeft: 6,
      startingFP: 42,
      header: '2nd & 6 at OWN 42',
    });
    expect(view.displayDrive).toMatchObject({ offense: 'Alpha', defense: 'Beta' });
    expect(view.isTeamAOnOffense).toBe(true);
    expect(view.fieldPosition).toBe(42);
    expect(view.userSide).toBe('offense');
    expect(view.userTimeoutsRemaining).toBe(2);
    expect(view.canUseTimeout).toBe(true);
    expect(view.canShowSpike).toBe(true);
    expect(view.canShowKneel).toBe(true);
  });

  it('derives defensive management without offensive clock actions', () => {
    const view = buildGameSimViewModel(input({
      context: {
        simGame: buildGame(),
        userTeamId: teamB.id,
        inOvertime: false,
        currentDriveState: driveState(),
        currentOffense: teamA,
        currentDefense: teamB,
      },
    }));

    expect(view.userSide).toBe('defense');
    expect(view.userTimeoutsRemaining).toBe(1);
    expect(view.canUseTimeout).toBe(true);
    expect(view.canShowSpike).toBe(false);
    expect(view.canShowKneel).toBe(false);
  });

  it('disables management during overtime tries and reports busy phases', () => {
    const view = buildGameSimViewModel(input({
      phase: 'finalizing',
      context: {
        simGame: buildGame({ overtime: 3 }),
        userTeamId: teamA.id,
        inOvertime: true,
        currentDriveState: driveState({
          phase: 'try',
          tryOrigin: 'overtime_shootout',
          fieldPosition: 97,
        }),
        currentOffense: teamA,
        currentDefense: teamB,
      },
    }));

    expect(view.displayPlay?.header).toBe('Try');
    expect(view.userSide).toBeNull();
    expect(view.canUseTimeout).toBe(false);
    expect(view.canShowSpike).toBe(false);
    expect(view.canShowKneel).toBe(false);
    expect(view.isBusy).toBe(true);
    expect(view.inOvertime).toBe(true);
    expect(view.overtimeCount).toBe(3);
  });
});
