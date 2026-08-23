import { describe, expect, it, vi } from 'vitest';
import type { ClockState, SimGame } from '../../types/sim';
import {
  resolveOvertimeTiming,
  resolveRegulationTiming,
  sampleGameRunoffMultiplier,
  type ClockPlayContext,
} from './clock';

const runContext = (
  overrides: Partial<ClockPlayContext> = {},
): ClockPlayContext => ({
  playType: 'run',
  result: 'run',
  isFirstDown: false,
  possessionEnds: false,
  tempo: 'normal',
  clockAction: null,
  timeoutRequest: null,
  ...overrides,
});

const clock = (overrides: Partial<ClockState> = {}): ClockState => ({
  quarter: 1,
  secondsLeft: 600,
  clockRunning: true,
  ...overrides,
});

const findOutOfBoundsPlayId = () => {
  for (let playId = 1; playId < 100; playId += 1) {
    const result = resolveRegulationTiming(
      playId,
      clock(),
      runContext({ playType: 'pass', result: 'pass' }),
    );
    if (result.timing.outOfBounds) return playId;
  }
  throw new Error('No deterministic out-of-bounds play ID found.');
};

describe('regulation clock', () => {
  it('uses keyed timing without consuming Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('football random stream consumed');
    });
    const first = resolveRegulationTiming(91, clock(), runContext());
    const second = resolveRegulationTiming(91, clock(), runContext());

    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
    expect(first.timing.elapsedSeconds).toBeGreaterThanOrEqual(32);
    expect(first.timing.elapsedSeconds).toBeLessThanOrEqual(46);
    expect(first.timing.end.running).toBe(true);
  });

  it('applies tempo only to post-play runoff', () => {
    const fast = resolveRegulationTiming(17, clock(), runContext({ tempo: 'hurry_up' }));
    const normal = resolveRegulationTiming(17, clock(), runContext());
    const chew = resolveRegulationTiming(17, clock(), runContext({ tempo: 'chew_clock' }));

    expect(fast.timing.elapsedSeconds).toBeLessThan(normal.timing.elapsedSeconds);
    expect(normal.timing.elapsedSeconds).toBeLessThan(chew.timing.elapsedSeconds);
  });

  it('uses one deterministic game-identity runoff environment for both teams', () => {
    const game = {
      id: 17,
      year: 2026,
      teamA: { id: 1 },
      teamB: { id: 2 },
    } as Pick<SimGame, 'id' | 'year' | 'teamA' | 'teamB'>;
    const first = sampleGameRunoffMultiplier(game);
    const second = sampleGameRunoffMultiplier(game);
    const otherMatchup = sampleGameRunoffMultiplier({
      ...game,
      teamB: { id: 3 } as SimGame['teamB'],
    });

    expect(second).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0.65);
    expect(first).toBeLessThanOrEqual(1.35);
    expect(otherMatchup).not.toBe(first);
  });

  it('applies the shared game environment only to post-play runoff', () => {
    const fast = resolveRegulationTiming(17, clock(), runContext(), 0.65);
    const slow = resolveRegulationTiming(17, clock(), runContext(), 1.35);

    expect(fast.timing.elapsedSeconds).toBeLessThan(slow.timing.elapsedSeconds);
  });

  it('stops first downs only in the final two minutes of a half', () => {
    const ordinary = resolveRegulationTiming(
      22,
      clock({ quarter: 2, secondsLeft: 300 }),
      runContext({ isFirstDown: true }),
    );
    const late = resolveRegulationTiming(
      22,
      clock({ quarter: 2, secondsLeft: 100 }),
      runContext({ isFirstDown: true }),
    );

    expect(ordinary.timing.end.running).toBe(true);
    expect(ordinary.timing.elapsedSeconds).toBeGreaterThan(8);
    expect(late.timing.end.running).toBe(false);
    expect(late.timing.elapsedSeconds).toBeGreaterThanOrEqual(4);
    expect(late.timing.elapsedSeconds).toBeLessThanOrEqual(8);
  });

  it('uses the first-half and fourth-quarter out-of-bounds windows', () => {
    const playId = findOutOfBoundsPlayId();
    const context = runContext({ playType: 'pass', result: 'pass' });
    const firstQuarter = resolveRegulationTiming(playId, clock(), context);
    const lateSecond = resolveRegulationTiming(
      playId,
      clock({ quarter: 2, secondsLeft: 90 }),
      context,
    );
    const lateFourth = resolveRegulationTiming(
      playId,
      clock({ quarter: 4, secondsLeft: 240 }),
      context,
    );

    expect(firstQuarter.timing.outOfBounds).toBe(true);
    expect(firstQuarter.timing.end.running).toBe(true);
    expect(lateSecond.timing.end.running).toBe(false);
    expect(lateFourth.timing.end.running).toBe(false);
  });

  it('clamps runoff at two minutes and preserves live-play crossings', () => {
    const duringRunoff = resolveRegulationTiming(
      40,
      clock({ quarter: 2, secondsLeft: 145 }),
      runContext(),
    );
    const duringPlay = resolveRegulationTiming(
      40,
      clock({ quarter: 4, secondsLeft: 123 }),
      runContext(),
    );
    const afterTimeout = resolveRegulationTiming(
      40,
      clock({ quarter: 4, secondsLeft: 110, clockRunning: false }),
      runContext(),
    );

    expect(duringRunoff.timing.eventAfter).toBe('two_minute_timeout');
    expect(duringRunoff.timing.end.secondsLeft).toBe(120);
    expect(duringRunoff.timing.end.running).toBe(false);
    expect(duringPlay.timing.eventAfter).toBe('two_minute_timeout');
    expect(duringPlay.timing.end.secondsLeft).toBeLessThan(120);
    expect(afterTimeout.timing.eventAfter).toBeNull();
  });

  it('emits exact period boundaries and clamps elapsed time', () => {
    const quarter = resolveRegulationTiming(
      6,
      clock({ quarter: 1, secondsLeft: 3 }),
      runContext(),
    );
    const half = resolveRegulationTiming(
      6,
      clock({ quarter: 2, secondsLeft: 3 }),
      runContext(),
    );
    const regulation = resolveRegulationTiming(
      6,
      clock({ quarter: 4, secondsLeft: 3 }),
      runContext(),
    );

    expect(quarter.timing.eventAfter).toBe('end_of_quarter');
    expect(quarter.timing.elapsedSeconds).toBe(3);
    expect(quarter.clock).toEqual({ quarter: 2, secondsLeft: 900, clockRunning: false });
    expect(half.timing.eventAfter).toBe('halftime');
    expect(half.halfEnded).toBe(true);
    expect(regulation.timing.eventAfter).toBe('end_of_regulation');
    expect(regulation.gameEnded).toBe(true);
  });

  it('charges a timeout before runoff but not after a natural stop or clock event', () => {
    const charged = resolveRegulationTiming(
      33,
      clock({ quarter: 4, secondsLeft: 110 }),
      runContext({ timeoutRequest: { side: 'defense', timing: 'immediate' } }),
    );
    const incomplete = resolveRegulationTiming(
      33,
      clock({ quarter: 4, secondsLeft: 110 }),
      runContext({
        playType: 'pass',
        result: 'incomplete pass',
        timeoutRequest: { side: 'offense', timing: 'immediate' },
      }),
    );
    const event = resolveRegulationTiming(
      33,
      clock({ quarter: 4, secondsLeft: 122 }),
      runContext({ timeoutRequest: { side: 'defense', timing: 'immediate' } }),
    );

    expect(charged.timing.chargedTimeoutAfter).toBe('defense');
    expect(charged.timing.elapsedSeconds).toBeLessThanOrEqual(8);
    expect(charged.timing.end.running).toBe(false);
    expect(incomplete.timing.chargedTimeoutAfter).toBeNull();
    expect(event.timing.eventAfter).toBe('two_minute_timeout');
    expect(event.timing.chargedTimeoutAfter).toBeNull();
  });

  it('drains to a requested timeout target unless the play stops the clock naturally', () => {
    const request = {
      side: 'offense' as const,
      timing: 'drain_to' as const,
      targetSeconds: 3,
    };
    const drained = resolveRegulationTiming(
      33,
      clock({ quarter: 4, secondsLeft: 33, clockRunning: false }),
      runContext({ timeoutRequest: request }),
    );
    const firstDown = resolveRegulationTiming(
      33,
      clock({ quarter: 4, secondsLeft: 33, clockRunning: false }),
      runContext({ isFirstDown: true, timeoutRequest: request }),
    );

    expect(drained.timing).toMatchObject({
      elapsedSeconds: 30,
      chargedTimeoutAfter: 'offense',
      end: { secondsLeft: 3, running: false },
    });
    expect(firstDown.timing.chargedTimeoutAfter).toBeNull();
    expect(firstDown.timing.elapsedSeconds).toBeGreaterThanOrEqual(4);
    expect(firstDown.timing.elapsedSeconds).toBeLessThanOrEqual(8);
    expect(firstDown.timing.end.running).toBe(false);
  });

  it('uses dedicated spike and kneel timing', () => {
    const spike = resolveRegulationTiming(
      19,
      clock({ quarter: 4, secondsLeft: 20 }),
      runContext({
        playType: 'pass',
        result: 'spike',
        tempo: 'hurry_up',
        clockAction: 'spike',
      }),
    );
    const kneel = resolveRegulationTiming(
      19,
      clock({ quarter: 4, secondsLeft: 80 }),
      runContext({
        result: 'kneel',
        tempo: 'chew_clock',
        clockAction: 'kneel',
      }),
    );

    expect(spike.timing.elapsedSeconds).toBeGreaterThanOrEqual(1);
    expect(spike.timing.elapsedSeconds).toBeLessThanOrEqual(2);
    expect(spike.timing.end.running).toBe(false);
    expect(kneel.timing.elapsedSeconds).toBe(40);
    expect(kneel.timing.end.running).toBe(true);
  });

  it('keeps overtime explicit and untimed', () => {
    expect(resolveOvertimeTiming(10, 3, 'pass', 'pass')).toMatchObject({
      kind: 'overtime',
      period: 3,
    });
  });
});
