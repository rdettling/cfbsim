import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayCall } from '../../types/db';
import type { Team } from '../../types/domain';
import type { SimGame } from '../../types/sim';
import {
  buildTryTiming,
  buildTryTimingFromTouchdown,
  chooseAutomaticTryAttempt,
  makeExtraPoint,
  mapTwoPointResult,
  tryRequiredAfterTouchdown,
  tryResultMatchesCall,
} from './conversions';

const teamA = { id: 1 } as Team;
const teamB = { id: 2 } as Team;

const buildGame = (changes: Partial<SimGame> = {}) => ({
  teamA,
  teamB,
  scoreA: 7,
  scoreB: 7,
  overtime: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  ...changes,
} as SimGame);

const runTry = {
  kind: 'try',
  attempt: 'two_point',
  offense: 'inside_run',
  defense: 'base',
} satisfies PlayCall;

const passTry = {
  kind: 'try',
  attempt: 'two_point',
  offense: 'quick_pass',
  defense: 'coverage',
} satisfies PlayCall;

afterEach(() => vi.restoreAllMocks());

describe('try scoring', () => {
  it('uses the fixed extra-point probability without player ratings', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9549).mockReturnValueOnce(0.955);
    expect(makeExtraPoint()).toBe(true);
    expect(makeExtraPoint()).toBe(false);
  });

  it.each([-10, -8, -5, -2, 1])(
    'selects two points at the configured late margin %i',
    margin => {
      const game = buildGame({
        quarter: 4,
        clockSecondsLeft: 300,
        scoreA: 20 + margin,
        scoreB: 20,
      });
      expect(chooseAutomaticTryAttempt({
        game,
        offense: teamA,
        origin: 'touchdown',
        overtimePossession: null,
      })).toBe('two_point');
    },
  );

  it('normally kicks and enforces the overtime conversion structure', () => {
    expect(chooseAutomaticTryAttempt({
      game: buildGame(),
      offense: teamA,
      origin: 'touchdown',
      overtimePossession: null,
    })).toBe('extra_point');
    expect(chooseAutomaticTryAttempt({
      game: buildGame({ overtime: 1, scoreA: 12, scoreB: 14 }),
      offense: teamA,
      origin: 'touchdown',
      overtimePossession: 1,
    })).toBe('two_point');
    expect(chooseAutomaticTryAttempt({
      game: buildGame({ overtime: 2 }),
      offense: teamA,
      origin: 'touchdown',
      overtimePossession: 0,
    })).toBe('two_point');
    expect(chooseAutomaticTryAttempt({
      game: buildGame({ overtime: 3 }),
      offense: teamA,
      origin: 'overtime_shootout',
      overtimePossession: 0,
    })).toBe('two_point');
  });

  it('skips only terminal touchdowns that cannot be changed by a try', () => {
    expect(tryRequiredAfterTouchdown({
      game: buildGame({ quarter: 4, clockSecondsLeft: 0, scoreA: 21, scoreB: 20 }),
      offense: teamA,
      overtimePossession: null,
    })).toBe(false);
    expect(tryRequiredAfterTouchdown({
      game: buildGame({ quarter: 4, clockSecondsLeft: 0, scoreA: 20, scoreB: 20 }),
      offense: teamA,
      overtimePossession: null,
    })).toBe(true);
    expect(tryRequiredAfterTouchdown({
      game: buildGame({ overtime: 1, scoreA: 28, scoreB: 27 }),
      offense: teamA,
      overtimePossession: 1,
    })).toBe(false);
  });

  it('maps underlying run and pass outcomes to exact persisted results', () => {
    expect(mapTwoPointResult(runTry, 'touchdown')).toBe('made two point run');
    expect(mapTwoPointResult(runTry, 'fumble')).toBe('failed two point fumble');
    expect(mapTwoPointResult(passTry, 'touchdown')).toBe('made two point pass');
    expect(mapTwoPointResult(passTry, 'incomplete pass')).toBe('failed two point incomplete');
    expect(mapTwoPointResult(passTry, 'sack')).toBe('failed two point sack');
    expect(mapTwoPointResult(passTry, 'interception')).toBe('failed two point interception');
    expect(tryResultMatchesCall(runTry, 'failed two point pass')).toBe(false);
    expect(tryResultMatchesCall(passTry, 'failed two point run')).toBe(false);
  });

  it('preserves touchdown dead-ball time in an explicit untimed timing shape', () => {
    expect(buildTryTiming(buildGame({ overtime: 3 }))).toEqual({
      kind: 'try',
      context: 'overtime',
      period: 3,
    });
    expect(buildTryTimingFromTouchdown({
      kind: 'regulation',
      start: { quarter: 4, secondsLeft: 12, running: true },
      end: { quarter: 4, secondsLeft: 6, running: false },
      elapsedSeconds: 6,
      outOfBounds: false,
      tempo: 'normal',
      eventAfter: null,
      chargedTimeoutAfter: null,
    })).toEqual({
      kind: 'try',
      context: 'regulation',
      quarter: 4,
      secondsLeft: 6,
    });
  });
});
