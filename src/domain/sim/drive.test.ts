import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Team } from '../../types/domain';
import type { LeagueState } from '../../types/league';
import type { InteractivePlayChoice, SimContext, SimGame } from '../../types/sim';
import { buildTestPlayer } from '../../test/fixtures';
import { createSeededRandom, withSeededMathRandom } from '../utils/random';
import {
  MAX_PLAYS_PER_DRIVE,
  simDrive,
  simOvertimeShootoutDrive,
  startInteractiveDrive,
  startOvertimeShootoutDrive,
  stepInteractiveDrive,
} from './drive';
import { buildStartersCacheFromPlayers } from './statistics';
import { OFFENSIVE_CONCEPTS } from './concepts';
import { AUTO_STEP_INSTRUCTION } from './clockManagement';

const instruction = (call: InteractivePlayChoice = 'auto') => ({
  ...AUTO_STEP_INSTRUCTION,
  timeoutAfter: { ...AUTO_STEP_INSTRUCTION.timeoutAfter },
  call,
});

const buildTeam = (id: number): Team => ({
  id,
  name: `Team ${id}`,
  abbreviation: `T${id}`,
  confGames: 0,
  confLimit: 0,
  nonConfGames: 0,
  nonConfLimit: 0,
  prestige: 75,
  ceiling: 99,
  floor: 1,
  mascot: 'Testers',
  city: 'Test',
  state: 'TS',
  stadium: 'Test Stadium',
  ranking: 0,
  offense: 75,
  defense: 75,
  colorPrimary: '#000000',
  colorSecondary: '#ffffff',
  conference: 'Test',
  confName: 'Test',
  confWins: 0,
  confLosses: 0,
  nonConfWins: 0,
  nonConfLosses: 0,
  rating: 75,
  totalWins: 0,
  totalLosses: 0,
  gamesPlayed: 0,
  record: '0-0',
  movement: 0,
  poll_score: 0,
  strength_of_record: 0,
  strength_of_record_avg: 0,
  last_rank: null,
  last_game: null,
  next_game: null,
});

const buildContext = (clockEnabled = false): SimContext => {
  const teamA = buildTeam(1);
  const teamB = buildTeam(2);
  const game: SimGame = {
    id: 91,
    teamA,
    teamB,
    homeTeam: null,
    awayTeam: null,
    neutralSite: true,
    venue: null,
    winner: null,
    baseLabel: 'Test',
    name: null,
    gameType: 'regular_season',
    rivalryKey: null,
    spreadA: '',
    spreadB: '',
    moneylineA: '',
    moneylineB: '',
    winProbA: 0.5,
    winProbB: 0.5,
    weekPlayed: 1,
    year: 2026,
    rankATOG: 0,
    rankBTOG: 0,
    resultA: null,
    resultB: null,
    overtime: 0,
    quarter: 1,
    clockSecondsLeft: 900,
    clockRunning: true,
    timeoutsRemainingA: 3,
    timeoutsRemainingB: 3,
    scoreA: 0,
    scoreB: 0,
    watchability: null,
  };
  let playerId = 1;
  const positions = ['qb', 'rb', 'wr', 'te', 'k', 'p', 'dl', 'lb', 'cb', 's'];
  const players = [teamA, teamB].flatMap(team => positions.map(position =>
    buildTestPlayer({
      id: playerId++,
      teamId: team.id,
      first: team.abbreviation,
      last: position.toUpperCase(),
      pos: position,
      starter: true,
    }),
  ));
  return {
    league: { teams: [teamA, teamB] } as LeagueState,
    game,
    starters: buildStartersCacheFromPlayers(players),
    offense: teamA,
    defense: teamB,
    clockEnabled,
    overtimePossession: clockEnabled ? null : 0,
  };
};

const buildFieldGoalCloseoutContext = (scoreA = 24, scoreB = 24) => {
  const context = buildContext(true);
  context.game.quarter = 4;
  context.game.clockSecondsLeft = 33;
  context.game.clockRunning = false;
  context.game.scoreA = scoreA;
  context.game.scoreB = scoreB;
  return context;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drive resolution', () => {
  it('matches a batch drive when the same drive is stepped automatically', () => {
    const batch = withSeededMathRandom(
      createSeededRandom(2468),
      () => simDrive(buildContext(), 25, 0),
    );
    const context = buildContext();
    const stepped = withSeededMathRandom(createSeededRandom(2468), () => {
      let state = startInteractiveDrive(context, 25, 0);
      const plays = [];
      while (true) {
        const result = stepInteractiveDrive(context, state, instruction());
        state = result.state;
        plays.push(result.play);
        if (result.driveComplete) {
          return {
            record: state.drive,
            plays,
            nextFieldPosition: result.nextFieldPosition ?? 25,
          };
        }
      }
    });

    expect(stepped).toEqual(batch);
    expect(batch.plays.every(play => play.timing.kind === 'overtime')).toBe(true);
  });

  it('resolves an overtime shootout try identically in batch and live paths', () => {
    const batchContext = buildContext();
    batchContext.game.overtime = 3;
    batchContext.overtimePossession = 0;
    const batch = withSeededMathRandom(
      createSeededRandom(9917),
      () => simOvertimeShootoutDrive(batchContext, 4),
    );
    const liveContext = buildContext();
    liveContext.game.overtime = 3;
    liveContext.overtimePossession = 0;
    const live = withSeededMathRandom(createSeededRandom(9917), () => {
      const result = stepInteractiveDrive(
        liveContext,
        startOvertimeShootoutDrive(liveContext, 4),
        instruction(),
      );
      return {
        record: result.state.drive,
        plays: [result.play],
        nextFieldPosition: result.nextFieldPosition ?? 97,
      };
    });

    expect(live).toEqual(batch);
    expect(batch.plays[0].call).toMatchObject({ kind: 'try', attempt: 'two_point' });
    expect(batch.plays[0].timing).toEqual({ kind: 'try', context: 'overtime', period: 3 });
  });

  it.each(OFFENSIVE_CONCEPTS)(
    'resolves %s identically through repeated shared steps',
    concept => {
      const firstContext = buildContext(true);
      const secondContext = buildContext(true);
      const first = withSeededMathRandom(createSeededRandom(8492), () =>
        stepInteractiveDrive(
          firstContext,
          startInteractiveDrive(firstContext, 40, 0),
          instruction({ kind: 'offense', concept }),
        ));
      const second = withSeededMathRandom(createSeededRandom(8492), () =>
        stepInteractiveDrive(
          secondContext,
          startInteractiveDrive(secondContext, 40, 0),
          instruction({ kind: 'offense', concept }),
        ));

      expect(second).toEqual(first);
      expect(first.play.call).toEqual(expect.objectContaining({
        kind: 'scrimmage',
        offense: concept,
      }));
    },
  );

  it('allows field goals on any down but rejects punts before fourth down', () => {
    const context = buildContext();
    expect(() => stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 25, 0),
      instruction({ kind: 'special_teams', concept: 'punt' }),
    )).toThrow('punt before fourth down');

    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const fieldGoalContext = buildContext();
    const fieldGoal = stepInteractiveDrive(
      fieldGoalContext,
      startInteractiveDrive(fieldGoalContext, 90, 0),
      instruction({ kind: 'special_teams', concept: 'field_goal' }),
    );
    expect(fieldGoal.play.result).toBe('made field goal');
  });

  it('pairs a manual defensive intent with a hidden automatic offensive concept', () => {
    const firstContext = buildContext(true);
    const secondContext = buildContext(true);
    const first = withSeededMathRandom(createSeededRandom(1204), () =>
      stepInteractiveDrive(
        firstContext,
        startInteractiveDrive(firstContext, 40, 0),
        instruction({ kind: 'defense', intent: 'coverage' }),
      ));
    const second = withSeededMathRandom(createSeededRandom(1204), () =>
      stepInteractiveDrive(
        secondContext,
        startInteractiveDrive(secondContext, 40, 0),
        instruction({ kind: 'defense', intent: 'coverage' }),
      ));

    expect(second).toEqual(first);
    expect(first.play.call).toEqual(expect.objectContaining({
      kind: 'scrimmage',
      defense: 'coverage',
    }));
  });

  it('rejects defensive intent when the automatic fourth-down call is special teams', () => {
    const context = buildContext();
    const state = startInteractiveDrive(context, 25, 0);
    state.down = 4;
    state.yardsLeft = 10;

    expect(() => stepInteractiveDrive(
      context,
      state,
      instruction({ kind: 'defense', intent: 'pressure' }),
    )).toThrow('cannot apply defensive intent to special teams');
  });

  it('rejects malformed interactive instructions', () => {
    const context = buildContext();
    expect(() => stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 25, 0),
      { ...instruction({ kind: 'defense', intent: 'base' }), extra: true } as never,
    )).toThrow('invalid interactive instruction');
  });

  it.each([
    [20, 40],
    [50, 10],
    [60, 20],
    [65, 20],
  ])('places a punt from field position %i at %i', (fieldPosition, expected) => {
    const context = buildContext();
    const state = startInteractiveDrive(context, fieldPosition, 0);
    state.down = 4;
    state.yardsLeft = 10;

    const result = stepInteractiveDrive(
      context,
      state,
      instruction({ kind: 'special_teams', concept: 'punt' }),
    );

    expect(result.play.result).toBe('punt');
    expect(result.nextFieldPosition).toBe(expected);
  });

  it('resolves touchdowns, first downs, turnovers, and field goals', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const touchdownContext = buildContext();
    const touchdown = stepInteractiveDrive(
      touchdownContext,
      startInteractiveDrive(touchdownContext, 99, 0),
      instruction({ kind: 'offense', concept: 'inside_run' }),
    );
    expect(touchdown.play.result).toBe('touchdown');
    expect(touchdown.state.drive.points).toBe(6);
    expect(touchdown.driveComplete).toBe(false);
    expect(touchdown.state.phase).toBe('try');
    const extraPoint = stepInteractiveDrive(
      touchdownContext,
      touchdown.state,
      instruction({ kind: 'try', attempt: 'extra_point' }),
    );
    expect(extraPoint.play.result).toBe('made extra point');
    expect(extraPoint.play.timing).toMatchObject({ kind: 'try', context: 'overtime' });
    expect(extraPoint.state.drive.points).toBe(7);
    expect(extraPoint.driveComplete).toBe(true);

    vi.mocked(Math.random).mockReturnValue(0.1);
    const firstDownContext = buildContext();
    const firstDownState = startInteractiveDrive(firstDownContext, 20, 0);
    firstDownState.down = 2;
    firstDownState.yardsLeft = 1;
    const firstDown = stepInteractiveDrive(
      firstDownContext,
      firstDownState,
      instruction({ kind: 'offense', concept: 'inside_run' }),
    );
    expect(firstDown.driveComplete).toBe(false);
    expect(firstDown.state.down).toBe(1);
    expect(firstDown.play.yardsLeft).toBe(1);

    vi.mocked(Math.random).mockReturnValue(0.5);
    const downsContext = buildContext();
    const downsState = startInteractiveDrive(downsContext, 40, 0);
    downsState.down = 4;
    downsState.yardsLeft = 10;
    const turnover = stepInteractiveDrive(
      downsContext,
      downsState,
      instruction({ kind: 'offense', concept: 'inside_run' }),
    );
    expect(turnover.state.drive.result).toBe('turnover on downs');

    vi.mocked(Math.random).mockReturnValue(0.001);
    const fumbleContext = buildContext();
    const fumble = stepInteractiveDrive(
      fumbleContext,
      startInteractiveDrive(fumbleContext, 40, 0),
      instruction({ kind: 'offense', concept: 'inside_run' }),
    );
    expect(fumble.state.drive.result).toBe('fumble');

    vi.mocked(Math.random).mockReturnValue(0.5);
    const fieldGoalContext = buildContext();
    const fieldGoalState = startInteractiveDrive(fieldGoalContext, 90, 0);
    fieldGoalState.down = 4;
    const fieldGoal = stepInteractiveDrive(
      fieldGoalContext,
      fieldGoalState,
      instruction({ kind: 'special_teams', concept: 'field_goal' }),
    );
    expect(fieldGoal.state.drive.result).toBe('made field goal');
    expect(fieldGoal.state.drive.points).toBe(3);
  });

  it('rejects illegal try calls and clock management during an untimed try', () => {
    const context = buildContext();
    context.game.overtime = 2;
    context.overtimePossession = 0;
    const state = startInteractiveDrive(context, 75, 0);
    state.phase = 'try';
    state.tryOrigin = 'touchdown';
    state.tryTiming = { kind: 'try', context: 'overtime', period: 2 };
    state.fieldPosition = 97;
    state.yardsLeft = 3;

    expect(() => stepInteractiveDrive(
      context,
      structuredClone(state),
      instruction({ kind: 'try', attempt: 'extra_point' }),
    )).toThrow('extra point is not allowed');

    const timed = instruction({ kind: 'try_offense', concept: 'inside_run' });
    timed.tempo = 'normal';
    expect(() => stepInteractiveDrive(context, structuredClone(state), timed)).toThrow(
      'cannot apply clock management to a try',
    );

    const timeout = instruction({ kind: 'try_offense', concept: 'inside_run' });
    timeout.timeoutAfter.offense = 'use';
    expect(() => stepInteractiveDrive(context, structuredClone(state), timeout)).toThrow(
      'cannot apply clock management to a try',
    );
  });

  it('ends a drive when halftime is reached', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = buildContext(true);
    context.game.quarter = 2;
    context.game.clockSecondsLeft = 1;

    const result = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 25, 0),
      instruction({ kind: 'offense', concept: 'inside_run' }),
    );

    expect(result.state.drive.result).toBe('end of half');
    expect(context.game.quarter).toBe(3);
  });

  it('kicks the winning field goal instead of running out the final clock', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const context = buildContext(true);
    context.game.quarter = 4;
    context.game.clockSecondsLeft = 3;
    context.game.clockRunning = true;
    context.game.timeoutsRemainingA = 0;
    context.game.scoreA = 24;
    context.game.scoreB = 26;
    const state = startInteractiveDrive(context, 82, 0);
    state.down = 4;
    state.yardsLeft = 1;

    const result = stepInteractiveDrive(context, state, instruction());

    expect(result.play.call).toEqual({ kind: 'special_teams', concept: 'field_goal' });
    expect(result.play.result).toBe('made field goal');
    expect(result.play.timing).toMatchObject({
      kind: 'regulation',
      eventAfter: 'end_of_regulation',
      end: { secondsLeft: 0 },
    });
    expect(context.game.scoreA).toBe(27);
    expect(context.game.scoreB).toBe(26);
    expect(result.driveComplete).toBe(true);
    expect(result.gameComplete).toBe(true);
  });

  it('runs one field-goal setup play, drains to three seconds, and kicks', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValue(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.24)
      .mockReturnValueOnce(0.5);
    const context = buildFieldGoalCloseoutContext();
    const state = startInteractiveDrive(context, 77, 0);

    const setup = stepInteractiveDrive(context, state, instruction());

    expect(setup.play.call).toMatchObject({
      kind: 'scrimmage',
      offense: 'inside_run',
    });
    expect(setup.play.yardsGained).toBe(0);
    expect(setup.play.timing).toMatchObject({
      kind: 'regulation',
      elapsedSeconds: 30,
      chargedTimeoutAfter: 'offense',
      end: { secondsLeft: 3, running: false },
    });
    expect(setup.state.automaticOffenseIntent).toBe('field_goal_kick_next');
    expect(context.game.timeoutsRemainingA).toBe(2);

    const kick = stepInteractiveDrive(context, setup.state, instruction());

    expect(kick.play.call).toEqual({ kind: 'special_teams', concept: 'field_goal' });
    expect(kick.play.result).toBe('made field goal');
    expect(kick.play.startingFP).toBe(77);
    expect(kick.play.timing).toMatchObject({
      kind: 'regulation',
      eventAfter: 'end_of_regulation',
      end: { secondsLeft: 0 },
    });
    expect(kick.state.automaticOffenseIntent).toBe('standard');
    expect(context.game.scoreA).toBe(27);
    expect(kick.gameComplete).toBe(true);
  });

  it('keeps the coordinated closeout plan for a defensive-only instruction', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = buildFieldGoalCloseoutContext();

    const setup = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 77, 0),
      instruction({ kind: 'defense', intent: 'coverage' }),
    );

    expect(setup.play.call).toMatchObject({
      kind: 'scrimmage',
      offense: 'inside_run',
      defense: 'coverage',
    });
    expect(setup.play.timing).toMatchObject({
      kind: 'regulation',
      chargedTimeoutAfter: 'offense',
      end: { secondsLeft: 3, running: false },
    });
    expect(setup.state.automaticOffenseIntent).toBe('field_goal_kick_next');
  });

  it.each([
    ['holds for a tied offense on Auto', 24, 'auto', null, 3],
    ['uses an ordinary automatic timeout while trailing', 20, 'auto', 'offense', 2],
    ['honors explicit timeout Use', 24, 'use', 'offense', 2],
  ] as const)(
    '%s on a manual closeout call',
    (_label, scoreA, timeoutInstruction, chargedTimeoutAfter, timeoutsRemaining) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const context = buildFieldGoalCloseoutContext(scoreA, 24);
      const manual = instruction({ kind: 'offense', concept: 'inside_run' });
      manual.timeoutAfter.offense = timeoutInstruction;

      const result = stepInteractiveDrive(
        context,
        startInteractiveDrive(context, 77, 0),
        manual,
      );

      expect(result.play.timing).toMatchObject({
        kind: 'regulation',
        chargedTimeoutAfter,
      });
      if (chargedTimeoutAfter !== null) {
        if (result.play.timing.kind !== 'regulation') {
          throw new Error('Expected regulation timing.');
        }
        expect(result.play.timing.end.secondsLeft).toBeGreaterThan(3);
      }
      expect(result.state.automaticOffenseIntent).toBe('standard');
      expect(context.game.timeoutsRemainingA).toBe(timeoutsRemaining);
    },
  );

  it('consumes a pending automatic kick when the offense calls a manual play', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = buildFieldGoalCloseoutContext();
    const state = startInteractiveDrive(context, 77, 0);
    state.automaticOffenseIntent = 'field_goal_kick_next';

    const result = stepInteractiveDrive(
      context,
      state,
      instruction({ kind: 'offense', concept: 'inside_run' }),
    );

    expect(result.play.call).toMatchObject({ kind: 'scrimmage', offense: 'inside_run' });
    expect(result.play.timing).toMatchObject({ chargedTimeoutAfter: null });
    expect(result.state.automaticOffenseIntent).toBe('standard');
  });

  it('kicks immediately when a closeout timeout is unavailable', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const context = buildFieldGoalCloseoutContext();
    context.game.timeoutsRemainingA = 0;

    const result = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 77, 0),
      instruction(),
    );

    expect(result.play.call).toEqual({ kind: 'special_teams', concept: 'field_goal' });
    expect(result.play.timing).toMatchObject({
      kind: 'regulation',
      chargedTimeoutAfter: null,
    });
  });

  it('keeps the pending kick after a setup first down stops the clock naturally', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValue(0.5)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.001);
    const context = buildFieldGoalCloseoutContext();

    const setup = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 77, 0),
      instruction(),
    );

    expect(setup.play.yardsGained).toBeGreaterThanOrEqual(10);
    expect(setup.play.timing).toMatchObject({
      kind: 'regulation',
      chargedTimeoutAfter: null,
      end: { running: false },
    });
    expect(setup.state.automaticOffenseIntent).toBe('field_goal_kick_next');
    expect(context.game.timeoutsRemainingA).toBe(3);

    const kick = stepInteractiveDrive(context, setup.state, instruction());
    expect(kick.play.call).toEqual({ kind: 'special_teams', concept: 'field_goal' });
  });

  it('cancels the pending kick intent when the setup run loses a fumble', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const context = buildFieldGoalCloseoutContext();

    const result = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 77, 0),
      instruction(),
    );

    expect(result.play.call).toMatchObject({ kind: 'scrimmage', offense: 'inside_run' });
    expect(result.play.result).toBe('fumble');
    expect(result.driveComplete).toBe(true);
    expect(result.state.automaticOffenseIntent).toBe('standard');
  });

  it.each([
    [0.001, 'made field goal', 24, false],
    [0.999, 'missed field goal', 21, true],
  ] as const)(
    'resolves a final field goal that can force overtime (random %s)',
    (random, expectedResult, expectedScoreA, expectedGameComplete) => {
      vi.spyOn(Math, 'random').mockReturnValue(random);
      const context = buildContext(true);
      context.game.quarter = 4;
      context.game.clockSecondsLeft = 3;
      context.game.clockRunning = false;
      context.game.scoreA = 21;
      context.game.scoreB = 24;

      const result = stepInteractiveDrive(
        context,
        startInteractiveDrive(context, 77, 0),
        instruction(),
      );

      expect(result.play.result).toBe(expectedResult);
      expect(context.game.scoreA).toBe(expectedScoreA);
      expect(result.gameComplete).toBe(expectedGameComplete);
      expect(result.play.timing).toMatchObject({
        kind: 'regulation',
        eventAfter: 'end_of_regulation',
      });
    },
  );

  it('resolves participant-linked spikes without accepting fewer than three seconds', () => {
    const context = buildContext(true);
    context.game.quarter = 4;
    context.game.clockSecondsLeft = 3;
    context.game.clockRunning = true;
    const result = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 60, 0),
      instruction({ kind: 'clock_management', action: 'spike' }),
    );

    expect(result.play.call).toEqual({ kind: 'clock_management', action: 'spike' });
    expect(result.play.result).toBe('spike');
    expect(result.play.playType).toBe('pass');
    expect(result.play.participants.passerId).not.toBeNull();
    expect(result.play.participants.targetId).toBeNull();
    expect(result.play.timing).toMatchObject({ kind: 'regulation', tempo: 'hurry_up' });

    const illegal = buildContext(true);
    illegal.game.quarter = 4;
    illegal.game.clockSecondsLeft = 2;
    illegal.game.clockRunning = true;
    expect(() => stepInteractiveDrive(
      illegal,
      startInteractiveDrive(illegal, 60, 0),
      instruction({ kind: 'clock_management', action: 'spike' }),
    )).toThrow('cannot spike');
  });

  it('charges a defensive timeout after a kneel and turns over a fourth-down kneel', () => {
    const context = buildContext(true);
    context.game.quarter = 4;
    context.game.clockSecondsLeft = 80;
    context.game.scoreA = 3;
    const timeoutInstruction = instruction({ kind: 'clock_management', action: 'kneel' });
    timeoutInstruction.timeoutAfter = { offense: 'hold', defense: 'use' };
    const result = stepInteractiveDrive(
      context,
      startInteractiveDrive(context, 60, 0),
      timeoutInstruction,
    );

    expect(result.play.result).toBe('kneel');
    expect(result.play.yardsGained).toBe(-1);
    expect(result.play.participants.rusherId).not.toBeNull();
    expect(result.play.participants.tacklerId).toBeNull();
    expect(result.play.timing).toMatchObject({
      kind: 'regulation',
      tempo: 'chew_clock',
      chargedTimeoutAfter: 'defense',
    });
    expect(context.game.timeoutsRemainingB).toBe(2);

    const fourthContext = buildContext(true);
    fourthContext.game.quarter = 4;
    fourthContext.game.clockSecondsLeft = 80;
    const fourth = startInteractiveDrive(fourthContext, 60, 0);
    fourth.down = 4;
    fourth.yardsLeft = 2;
    const turnover = stepInteractiveDrive(
      fourthContext,
      fourth,
      instruction({ kind: 'clock_management', action: 'kneel' }),
    );
    expect(turnover.driveComplete).toBe(true);
    expect(turnover.state.drive.result).toBe('turnover on downs');
  });

  it('throws at the interactive drive safety limit', () => {
    const context = buildContext();
    const state = startInteractiveDrive(context, 25, 0);
    state.playCount = MAX_PLAYS_PER_DRIVE;

    expect(() => stepInteractiveDrive(
      context,
      state,
      instruction({ kind: 'offense', concept: 'inside_run' }),
    )).toThrow(
      'The drive exceeded the simulation safety limit.',
    );
  });
});
