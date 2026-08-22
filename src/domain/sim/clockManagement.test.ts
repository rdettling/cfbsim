import { describe, expect, it, vi } from 'vitest';
import type { SimGame } from '../../types/sim';
import { buildTestTeam } from '../../test/fixtures';
import {
  AUTO_STEP_INSTRUCTION,
  chargeTimeout,
  chooseAutomaticClockAction,
  chooseAutomaticTempo,
  isInteractiveStepInstruction,
  resetSecondHalfTimeouts,
  resolveTimeoutRequest,
} from './clockManagement';

const teamA = buildTestTeam({ id: 1, name: 'Alpha' });
const teamB = buildTestTeam({ id: 2, name: 'Beta' });

const game = (overrides: Partial<SimGame> = {}) => ({
  id: 7,
  teamA,
  teamB,
  timeoutsRemainingA: 3,
  timeoutsRemainingB: 3,
  ...overrides,
}) as SimGame;

const situation = (overrides: Partial<Parameters<typeof chooseAutomaticClockAction>[0]> = {}) => ({
  game: game(),
  offense: teamA,
  defense: teamB,
  offenseLead: 0,
  down: 1,
  clock: { quarter: 4, secondsLeft: 120, clockRunning: true },
  ...overrides,
});

describe('clock management strategy', () => {
  it('validates the exact step instruction without consuming football randomness', () => {
    const random = vi.spyOn(Math, 'random');
    expect(isInteractiveStepInstruction(AUTO_STEP_INSTRUCTION)).toBe(true);
    expect(isInteractiveStepInstruction({ ...AUTO_STEP_INSTRUCTION, extra: true })).toBe(false);
    expect(isInteractiveStepInstruction({
      ...AUTO_STEP_INSTRUCTION,
      timeoutAfter: { offense: 'use', defense: 'use' },
    })).toBe(false);
    expect(chooseAutomaticTempo(-3, {
      quarter: 4,
      secondsLeft: 200,
      clockRunning: true,
    })).toBe('hurry_up');
    expect(random).not.toHaveBeenCalled();
  });

  it('uses conservative spike and kneel thresholds', () => {
    const noTimeouts = game({ timeoutsRemainingA: 0 });
    expect(chooseAutomaticClockAction(situation({
      game: noTimeouts,
      offenseLead: -3,
      down: 2,
      clock: { quarter: 4, secondsLeft: 20, clockRunning: true },
    }))).toBe('spike');
    expect(chooseAutomaticClockAction(situation({
      offenseLead: 3,
      down: 1,
      game: game({ timeoutsRemainingB: 0 }),
      clock: { quarter: 4, secondsLeft: 120, clockRunning: false },
    }))).toBe('kneel');
    expect(chooseAutomaticClockAction(situation({
      offenseLead: 3,
      down: 1,
      game: game({ timeoutsRemainingB: 3 }),
      clock: { quarter: 4, secondsLeft: 120, clockRunning: false },
    }))).toBeNull();
  });

  it('resolves explicit and automatic timeout intent and resets at halftime', () => {
    const current = situation({
      offenseLead: -3,
      clock: { quarter: 2, secondsLeft: 80, clockRunning: true },
    });
    expect(resolveTimeoutRequest(
      { offense: 'auto', defense: 'auto' },
      current,
      { side: 'offense', timing: 'immediate' },
    )).toEqual({ side: 'offense', timing: 'immediate' });
    expect(resolveTimeoutRequest(
      { offense: 'hold', defense: 'use' },
      current,
      null,
    )).toEqual({ side: 'defense', timing: 'immediate' });
    expect(resolveTimeoutRequest(
      { offense: 'auto', defense: 'use' },
      current,
      { side: 'offense', timing: 'drain_to', targetSeconds: 3 },
    )).toEqual({ side: 'defense', timing: 'immediate' });
    chargeTimeout(current.game, teamA.id);
    expect(current.game.timeoutsRemainingA).toBe(2);
    current.game.timeoutsRemainingA = 0;
    current.game.timeoutsRemainingB = 1;
    resetSecondHalfTimeouts(current.game);
    expect(current.game.timeoutsRemainingA).toBe(3);
    expect(current.game.timeoutsRemainingB).toBe(3);
  });
});
