import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import type {
  RecruitingSimulationState,
} from '../../types/recruiting';
import {
  calculateSigningCapacity,
  canAcceptCommitment,
  canRosterAcceptCommitment,
} from './capacity';
import { buildRecruitingContext } from './context';
import {
  calculatePlayingTimeFit,
  calculatePrestigeFit,
  calculateProximityFit,
  calculateRecentSuccessFit,
  calculateTeamFit,
} from './fit';
import {
  calculateInterestGain,
  getMaxProspectAllocation,
  getRecruitingBudget,
  RecruitingRuleViolationError,
} from './rules';
import {
  createTeamRecruitingStates,
  updateRecruitingBoard,
} from './state';
import { validateAllocations, validateBoard } from './validation';
import { buildRecruitingProspect } from '../../test/recruitingFixtures';
import { FINAL_ROSTER_SIZE, ROSTER } from '../rosterConfig';

const teams = [
  buildTestTeam({ id: 1, prestige: 4, ranking: 1 }),
  buildTestTeam({ id: 2, prestige: 3, ranking: 2, state: 'OS' }),
];
let returningId = 1;
const returning = Object.entries(ROSTER).flatMap(([position, config]) =>
  Array.from(
    {
      length:
        config.total -
        (['wr', 'ol', 'dl', 'cb'].includes(position) ? 1 : 0),
    },
    () =>
      buildTestPlayer({
        id: returningId++,
        teamId: 1,
        pos: position,
      }),
  ),
);
export const context = buildRecruitingContext(teams, returning);
export const makeRecruitingState = (): RecruitingSimulationState => ({
  year: 2026,
  round: 1,
  status: 'active',
  seed: 10,
  prospects: [
    buildRecruitingProspect(),
    buildRecruitingProspect({ id: 2, nationalRank: 2 }),
  ],
  teams: createTeamRecruitingStates(teams, context),
});

describe('recruiting fit', () => {
  it('uses the locked component formulas', () => {
    expect(calculatePrestigeFit(1)).toBe(0);
    expect(calculatePrestigeFit(7)).toBe(100);
    expect(calculateProximityFit('ts', ' TS ')).toBe(100);
    expect(calculateProximityFit('TS', 'OS')).toBe(0);
    expect(calculateRecentSuccessFit(1, 10)).toBe(100);
    expect(calculateRecentSuccessFit(10, 10)).toBe(0);
    expect(calculateRecentSuccessFit(0, 10)).toBe(50);
    expect(calculateRecentSuccessFit(1, 1)).toBe(100);
  });

  it('combines starter path and roster room from indexed depth', () => {
    const empty = buildRecruitingContext([teams[0]], []);
    expect(calculatePlayingTimeFit(buildRecruitingProspect(), 1, empty)).toBe(
      100,
    );
    const depth = buildRecruitingContext(teams, [
      buildTestPlayer({ rating: 80, pos: 'qb' }),
      buildTestPlayer({ id: 2, rating: 60, pos: 'qb' }),
    ]);
    expect(calculatePlayingTimeFit(buildRecruitingProspect(), 1, depth)).toBe(
      15,
    );
    expect(
      calculateTeamFit(
        buildRecruitingProspect(),
        buildTestTeam({ prestige: 7, ranking: 1 }),
        buildRecruitingContext([buildTestTeam()], []),
      ),
    ).toBe(100);
  });

  it('makes elite prestige influence nonlinear without hard exclusions', () => {
    const prestigeTeams = [
      buildTestTeam({ id: 1, prestige: 1, ranking: 3 }),
      buildTestTeam({ id: 2, prestige: 4, ranking: 2 }),
      buildTestTeam({ id: 3, prestige: 7, ranking: 1 }),
    ];
    const fitContext = buildRecruitingContext(prestigeTeams, []);
    const fourStar = buildRecruitingProspect({
      stars: 4,
      state: 'OS',
    });
    const fiveStar = { ...fourStar, stars: 5 };
    const fits = prestigeTeams.map(team =>
      calculateTeamFit(fourStar, team, fitContext),
    );

    expect(fits[0]).toBeGreaterThan(0);
    expect(fits[2]).toBeGreaterThan(fits[1]);
    expect(fits[1]).toBeGreaterThan(fits[0]);
    expect(
      prestigeTeams.map(team =>
        calculateTeamFit(fiveStar, team, fitContext),
      ),
    ).toEqual(fits);
  });
});

describe('recruiting scalar rules and capacity', () => {
  it('calculates budgets, interest, and protected-freshman capacity', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(getRecruitingBudget)).toEqual([
      90, 95, 100, 105, 110, 115, 120,
    ]);
    expect(getMaxProspectAllocation(105)).toBe(26);
    expect(calculateInterestGain(20, 50)).toBe(20);
    expect(calculateSigningCapacity(context, 1)).toEqual({
      returning: FINAL_ROSTER_SIZE - 4,
      base: 4,
      maximum: 8,
    });
    expect(
      canAcceptCommitment(context, 1, [
        'wr',
        'ol',
        'dl',
        'cb',
        'qb',
        'qb',
        'qb',
        'qb',
      ]),
    ).toBe(true);
    expect(canAcceptCommitment(context, 1, Array(9).fill('qb'))).toBe(false);
  });

  it('rejects unknown teams and infeasible protected classes', () => {
    expect(() => calculateSigningCapacity(context, 99)).toThrowError(
      expect.objectContaining<Partial<RecruitingRuleViolationError>>({
        violations: [expect.objectContaining({ code: 'UNKNOWN_TEAM' })],
      }),
    );
    const empty = buildRecruitingContext([teams[0]], []);
    const legalClass = Object.entries(ROSTER).flatMap(([position, config]) =>
      Array(config.starters).fill(position),
    );
    legalClass.push(
      ...Array(FINAL_ROSTER_SIZE - legalClass.length).fill('qb'),
    );
    expect(canAcceptCommitment(empty, 1, legalClass)).toBe(true);
    expect(
      canAcceptCommitment(empty, 1, Array(FINAL_ROSTER_SIZE + 1).fill('qb')),
    ).toBe(false);
    expect(
      canRosterAcceptCommitment(
        {
          activeCount: 23,
          positions: new Map([
            ['qb', { count: 1, ratings: [80] }],
            ['rb', { count: 2, ratings: [80, 80] }],
            ['wr', { count: 3, ratings: [80, 80, 80] }],
            ['te', { count: 1, ratings: [80] }],
            ['ol', { count: 5, ratings: Array(5).fill(80) }],
            ['dl', { count: 4, ratings: Array(4).fill(80) }],
            ['lb', { count: 3, ratings: Array(3).fill(80) }],
            ['cb', { count: 2, ratings: [80, 80] }],
            ['s', { count: 2, ratings: [80, 80] }],
            ['k', { count: 1, ratings: [80] }],
            ['p', { count: 1, ratings: [80] }],
          ]),
        },
        45,
        Array(42).fill('ath'),
      ),
    ).toBe(false);
  });

  it('reserves remaining commitment slots for starter shortages', () => {
    const roster = {
      activeCount: FINAL_ROSTER_SIZE - 1,
      positions: new Map(
        Object.entries(ROSTER).map(([position, config]) => [
          position,
          {
            count:
              config.total -
              (position === 'p' ? 2 : 0) +
              (position === 'qb' ? 1 : 0),
            ratings: Array(
              config.total -
                (position === 'p' ? 2 : 0) +
                (position === 'qb' ? 1 : 0),
            ).fill(70),
          },
        ]),
      ),
    };

    expect(canRosterAcceptCommitment(roster, 1, ['qb'])).toBe(false);
    expect(canRosterAcceptCommitment(roster, 1, ['p'])).toBe(true);
  });
});

describe('board and allocation validation', () => {
  it('uses stored point budgets and stable violation codes', () => {
    const state = makeRecruitingState();
    expect(validateBoard(state, 1, [1, 1]).map(item => item.code)).toContain(
      'DUPLICATE_PROSPECT',
    );
    const updated = updateRecruitingBoard(state, 1, [1], context).state;
    expect(
      validateAllocations(updated, 1, { 1: 27 }).map(item => item.code),
    ).toContain('PROSPECT_CAP_EXCEEDED');
    expect(
      validateAllocations(updated, 1, { 2: 1 }).map(item => item.code),
    ).toContain('NOT_ON_BOARD');
    expect(
      validateAllocations(updated, 1, { 1: -1 }).map(item => item.code),
    ).toContain('INVALID_ALLOCATION');
    updated.teams[0].pointBudget = 20;
    expect(
      validateAllocations(updated, 1, { 1: 21 }).map(item => item.code),
    ).toContain('ROUND_BUDGET_EXCEEDED');
  });

  it('rejects oversized, unknown, and committed board targets', () => {
    const state = makeRecruitingState();
    state.prospects[0].committedTeamId = 2;
    const codes = validateBoard(
      state,
      1,
      [1, 99, ...Array.from({ length: 24 }, (_, index) => index + 100)],
    ).map(item => item.code);
    expect(codes).toContain('BOARD_LIMIT');
    expect(codes).toContain('UNKNOWN_PROSPECT');
    expect(codes).toContain('PROSPECT_COMMITTED');
    expect(validateBoard(state, 99, []).map(item => item.code)).toEqual([
      'UNKNOWN_TEAM',
    ]);
  });

  it('returns an unaliased unchanged state for invalid board changes', () => {
    const state = makeRecruitingState();
    const result = updateRecruitingBoard(state, 1, [1, 1], context);
    expect(result.state).toEqual(state);
    expect(result.state).not.toBe(state);
    expect(result.state.prospects).not.toBe(state.prospects);
  });

  it('clears allocations only for prospects removed from a board', () => {
    const state = updateRecruitingBoard(
      makeRecruitingState(),
      1,
      [1, 2],
      context,
    ).state;
    state.teams[0].allocations = { 1: 10, 2: 15 };
    const updated = updateRecruitingBoard(state, 1, [2], context).state;
    expect(updated.teams[0].allocations).toEqual({ 2: 15 });
  });

  it('treats missing sparse interest as an invariant violation', () => {
    const state = makeRecruitingState();
    state.teams[0].board = [1];
    expect(validateAllocations(state, 1, { 1: 1 })).toContainEqual(
      expect.objectContaining({ code: 'MISSING_INTEREST' }),
    );
  });
});
