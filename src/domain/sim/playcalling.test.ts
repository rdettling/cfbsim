import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import type { SimGame } from '../../types/sim';
import { SIM_TUNING, withSimTuning } from './config';
import {
  chooseAutomaticOffensePlan,
  type AutomaticOffenseSituation,
} from './playcalling';

const offense = buildTestTeam({ id: 1, name: 'Alpha' });
const defense = buildTestTeam({ id: 2, name: 'Beta' });

const buildSituation = (
  overrides: Partial<AutomaticOffenseSituation> = {},
): AutomaticOffenseSituation => ({
  game: {
    id: 7,
    teamA: offense,
    teamB: defense,
    timeoutsRemainingA: 3,
    timeoutsRemainingB: 3,
  } as SimGame,
  offense,
  defense,
  offenseLead: 0,
  down: 4,
  yardsLeft: 10,
  fieldPosition: 25,
  clockEnabled: true,
  clock: { quarter: 1, secondsLeft: 900, clockRunning: false },
  automaticOffenseIntent: 'standard',
  ...overrides,
});

const plan = (
  overrides: Partial<AutomaticOffenseSituation>,
  timeout: 'auto' | 'use' | 'hold' = 'auto',
) => chooseAutomaticOffensePlan(buildSituation(overrides), timeout);

const action = (overrides: Partial<AutomaticOffenseSituation>) => plan(overrides).action;

describe('automatic offensive decisions', () => {
  it.each([
    [40, 1, { kind: 'special_teams', concept: 'punt' }],
    [41, 2, { kind: 'scrimmage', offense: 'auto' }],
    [41, 3, { kind: 'special_teams', concept: 'punt' }],
    [50, 2, { kind: 'scrimmage', offense: 'auto' }],
    [50, 3, { kind: 'special_teams', concept: 'punt' }],
    [51, 3, { kind: 'scrimmage', offense: 'auto' }],
    [51, 4, { kind: 'special_teams', concept: 'punt' }],
    [62, 3, { kind: 'scrimmage', offense: 'auto' }],
    [62, 4, { kind: 'special_teams', concept: 'punt' }],
    [63, 4, { kind: 'special_teams', concept: 'field_goal' }],
    [63, 5, { kind: 'special_teams', concept: 'field_goal' }],
  ] as const)(
    'preserves the normal fourth-down chart at field position %i and distance %i',
    (fieldPosition, yardsLeft, expected) => {
      expect(action({ fieldPosition, yardsLeft })).toEqual(expected);
    },
  );

  it('uses the live score and clock for final-possession fourth downs', () => {
    const late = {
      clock: { quarter: 4 as const, secondsLeft: 60, clockRunning: false },
      down: 4,
      yardsLeft: 10,
    };
    expect(action({ ...late, fieldPosition: 20, offenseLead: -1 })).toEqual({
      kind: 'scrimmage',
      offense: 'auto',
    });
    expect(action({ ...late, fieldPosition: 70, offenseLead: -2 })).toEqual({
      kind: 'special_teams',
      concept: 'field_goal',
    });
    expect(action({ ...late, fieldPosition: 70, offenseLead: -4 })).toEqual({
      kind: 'scrimmage',
      offense: 'auto',
    });
  });

  it.each([1, 2, 3, 4])(
    'kicks on down %i when the guaranteed final snap can win the game',
    down => {
      expect(action({
        down,
        yardsLeft: 1,
        fieldPosition: 82,
        offenseLead: -2,
        clock: { quarter: 4, secondsLeft: 3, clockRunning: true },
      })).toEqual({ kind: 'special_teams', concept: 'field_goal' });
    },
  );

  it('kicks to win or force overtime but not when three points leave a deficit', () => {
    const terminal = {
      down: 2,
      fieldPosition: 82,
      clock: { quarter: 4 as const, secondsLeft: 3, clockRunning: true },
    };
    for (const offenseLead of [-3, -2, -1, 0]) {
      expect(action({ ...terminal, offenseLead })).toEqual({
        kind: 'special_teams',
        concept: 'field_goal',
      });
    }
    expect(action({ ...terminal, offenseLead: -4 })).toEqual({
      kind: 'scrimmage',
      offense: 'auto',
    });
    expect(action({ ...terminal, fieldPosition: 62, offenseLead: -2 })).toEqual({
      kind: 'scrimmage',
      offense: 'auto',
    });
  });

  it('coordinates a setup run, delayed timeout, and pending kick', () => {
    const closeout = plan({
      down: 1,
      fieldPosition: 77,
      offenseLead: 0,
      clock: { quarter: 4, secondsLeft: 33, clockRunning: false },
    });
    expect(closeout).toEqual({
      action: { kind: 'scrimmage', offense: 'inside_run' },
      tempo: 'normal',
      offenseTimeoutRequest: { side: 'offense', timing: 'drain_to', targetSeconds: 3 },
      intentAfterPlay: 'field_goal_kick_next',
    });
    expect(plan({
      down: 2,
      fieldPosition: 62,
      offenseLead: 0,
      clock: { quarter: 4, secondsLeft: 20, clockRunning: false },
      automaticOffenseIntent: 'field_goal_kick_next',
    }).action).toEqual({ kind: 'special_teams', concept: 'field_goal' });
  });

  it('kicks without automatic timeout authority and honors explicit timeout use', () => {
    const situation = {
      down: 1,
      fieldPosition: 77,
      offenseLead: 0,
      clock: { quarter: 4 as const, secondsLeft: 33, clockRunning: false },
    };
    expect(plan(situation, 'hold').action).toEqual({
      kind: 'special_teams',
      concept: 'field_goal',
    });
    expect(plan(situation, 'use')).toMatchObject({
      action: { kind: 'scrimmage', offense: 'inside_run' },
      offenseTimeoutRequest: { side: 'offense', timing: 'immediate' },
    });
    expect(plan({ ...situation, down: 4 }).action).toEqual({
      kind: 'special_teams',
      concept: 'field_goal',
    });
  });

  it('derives the closeout boundary and normal chart from tuning', () => {
    const tuning = structuredClone(SIM_TUNING);
    tuning.clock.liveBallSeconds.scrimmage.max = 10;
    tuning.clock.runoffSeconds.runOrSack.max = 40;
    tuning.playcalling.fourthDown.midfieldGoMaxYards = 1;

    withSimTuning(tuning, () => {
      expect(plan({
        down: 1,
        fieldPosition: 82,
        offenseLead: 0,
        clock: { quarter: 4, secondsLeft: 50, clockRunning: false },
      }).action).toEqual({ kind: 'scrimmage', offense: 'inside_run' });
      expect(action({
        down: 1,
        fieldPosition: 82,
        offenseLead: 0,
        clock: { quarter: 4, secondsLeft: 51, clockRunning: false },
      })).toEqual({ kind: 'scrimmage', offense: 'auto' });
      expect(action({ fieldPosition: 45, yardsLeft: 2 })).toEqual({
        kind: 'special_teams',
        concept: 'punt',
      });
    });
    expect(SIM_TUNING.clock.liveBallSeconds.scrimmage.max).toBe(8);
    expect(SIM_TUNING.playcalling.fourthDown.midfieldGoMaxYards).toBe(2);
  });
});
