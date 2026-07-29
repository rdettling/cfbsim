import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import type { RecruitingSimulationState } from '../../types/recruiting';
import { buildRecruitingContext } from './context';
import { MAX_ROSTER_SIZE } from '../rosterConfig';
import {
  resolveRecruitingRound,
  resolveSigningDay,
} from './resolution';
import { RecruitingRuleViolationError } from './rules';
import {
  createTeamRecruitingStates,
  updateRecruitingBoard,
} from './state';
import { buildRecruitingProspect } from '../../test/recruitingFixtures';
import { ROSTER } from '../rosterConfig';

const teams = [
  buildTestTeam({ id: 1, prestige: 4, ranking: 1 }),
  buildTestTeam({ id: 2, prestige: 3, ranking: 2, state: 'OS' }),
];
let returningId = 1;
const returning = Object.entries(ROSTER).flatMap(([position, config]) =>
  Array.from(
    { length: config.total - (position === 'qb' ? 4 : 0) },
    () =>
      buildTestPlayer({
        id: returningId++,
        teamId: 1,
        pos: position,
      }),
  ),
);
const context = buildRecruitingContext(teams, returning);

const makeState = (): RecruitingSimulationState => ({
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

const violationCodes = (action: () => unknown) => {
  try {
    action();
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(RecruitingRuleViolationError);
    return (error as RecruitingRuleViolationError).violations.map(
      violation => violation.code,
    );
  }
};

describe('recruiting round resolution', () => {
  it('commits at the exact threshold and lead boundaries but not below them', () => {
    let boundary = updateRecruitingBoard(
      updateRecruitingBoard(makeState(), 1, [1], context).state,
      2,
      [1],
      context,
    ).state;
    const interest = boundary.prospects[0].interest;
    const leader = interest.find(entry => entry.teamId === 1)!;
    const runnerUp = interest.find(entry => entry.teamId === 2)!;
    leader.initial = 55;
    leader.lifetimePoints = 20;
    runnerUp.initial = 45;
    runnerUp.lifetimePoints = 20;

    expect(resolveRecruitingRound(boundary, {}, context).commitments).toEqual([
      { prospectId: 1, teamId: 1, round: 1 },
    ]);

    const belowThreshold = structuredClone(boundary);
    belowThreshold.prospects[0].interest.find(
      entry => entry.teamId === 1,
    )!.initial = 54.999;
    belowThreshold.prospects[0].interest.find(
      entry => entry.teamId === 2,
    )!.initial = 44.999;
    expect(
      resolveRecruitingRound(belowThreshold, {}, context).commitments,
    ).toEqual([]);

    const belowLead = structuredClone(boundary);
    belowLead.prospects[0].interest.find(
      entry => entry.teamId === 2,
    )!.initial = 45.001;
    expect(resolveRecruitingRound(belowLead, {}, context).commitments).toEqual(
      [],
    );
  });

  it('resolves a binding commitment without mutating its actual input', () => {
    let state = updateRecruitingBoard(
      makeState(),
      1,
      [1, 2],
      context,
    ).state;
    state.prospects[0].interest.find(entry => entry.teamId === 1)!.initial = 120;
    const before = structuredClone(state);

    const result = resolveRecruitingRound(state, { 1: { 1: 20 } }, context);

    expect(result.commitments).toEqual([
      { prospectId: 1, teamId: 1, round: 1 },
    ]);
    expect(result.state.prospects[0].committedTeamId).toBe(1);
    expect(result.state.teams[0].board).not.toContain(1);
    expect(state).toEqual(before);
  });

  it('advances rounds 1–5 and marks round 6 ready without creating round 7', () => {
    let state = makeState();
    for (let expectedRound = 2; expectedRound <= 6; expectedRound += 1) {
      state = resolveRecruitingRound(state, {}, context).state;
      expect(state.round).toBe(expectedRound);
      expect(state.status).toBe('active');
    }
    state = resolveRecruitingRound(state, {}, context).state;
    expect(state.round).toBe(6);
    expect(state.status).toBe('ready_for_signing_day');
    expect(violationCodes(() => resolveRecruitingRound(state, {}, context))).toContain(
      'INVALID_STATUS',
    );
  });

  it('rejects out-of-order rounds and missing interest invariants', () => {
    const invalidRound = {
      ...makeState(),
      round: 7,
    } as unknown as RecruitingSimulationState;
    expect(
      violationCodes(() => resolveRecruitingRound(invalidRound, {}, context)),
    ).toContain('INVALID_ROUND');

    const missingInterest = makeState();
    missingInterest.teams[0].board = [1];
    expect(
      violationCodes(() =>
        resolveRecruitingRound(missingInterest, {}, context),
      ),
    ).toContain('MISSING_INTEREST');
  });
});

describe('signing day resolution', () => {
  it('requires the ready status, finalizes once, and preserves withdrawn interest', () => {
    let state = updateRecruitingBoard(makeState(), 1, [1], context).state;
    const entry = state.prospects[0].interest.find(item => item.teamId === 1)!;
    entry.earned = 50;
    entry.lifetimePoints = 20;
    state = updateRecruitingBoard(state, 1, [], context).state;
    state.round = 6;
    state.status = 'ready_for_signing_day';
    const before = structuredClone(state);

    const result = resolveSigningDay(state, context);

    expect(result.commitments).toEqual([]);
    expect(result.state.status).toBe('finalized');
    expect(state).toEqual(before);
    expect(
      violationCodes(() => resolveSigningDay(result.state, context)),
    ).toContain('INVALID_STATUS');
  });

  it('falls through to the next interested team when the leader is full', () => {
    const fullRoster = Array.from({ length: MAX_ROSTER_SIZE }, (_, index) =>
      buildTestPlayer({ id: index + 1, teamId: 1, pos: 'wr' }),
    );
    const fallbackContext = buildRecruitingContext(teams, fullRoster);
    const prospect = buildRecruitingProspect({
      interest: [
        {
          teamId: 1,
          fit: 90,
          initial: 100,
          earned: 100,
          lifetimePoints: 20,
        },
        {
          teamId: 2,
          fit: 80,
          initial: 90,
          earned: 90,
          lifetimePoints: 20,
        },
      ],
    });
    const state: RecruitingSimulationState = {
      year: 2026,
      round: 6,
      status: 'ready_for_signing_day',
      seed: 10,
      prospects: [prospect],
      teams: createTeamRecruitingStates(teams, fallbackContext).map(team => ({
        ...team,
        board: [prospect.id],
      })),
    };

    expect(resolveSigningDay(state, fallbackContext).commitments).toEqual([
      { prospectId: 1, teamId: 2, round: 'signing_day' },
    ]);
  });

  it('uses national rank when prospects compete for the last capacity', () => {
    const oneTeam = [teams[0]];
    let playerId = 1;
    const nearlyFull = [
      ...Object.entries(ROSTER).flatMap(([position, config]) =>
        Array.from({ length: config.total }, () =>
          buildTestPlayer({
            id: playerId++,
            teamId: 1,
            pos: position,
          }),
        ),
      ),
      ...Array.from({ length: 3 }, () =>
        buildTestPlayer({
          id: playerId++,
          teamId: 1,
          pos: 'qb',
        }),
      ),
    ];
    const limitedContext = buildRecruitingContext(oneTeam, nearlyFull);
    const pursued = (id: number, nationalRank: number) =>
      buildRecruitingProspect({
        id,
        nationalRank,
        interest: [
          {
            teamId: 1,
            fit: 80,
            initial: 100,
            earned: 50,
            lifetimePoints: 20,
          },
        ],
      });
    const state: RecruitingSimulationState = {
      year: 2026,
      round: 6,
      status: 'ready_for_signing_day',
      seed: 10,
      prospects: [pursued(2, 2), pursued(1, 1)],
      teams: createTeamRecruitingStates(oneTeam, limitedContext).map(team => ({
        ...team,
        board: [1, 2],
      })),
    };

    expect(resolveSigningDay(state, limitedContext).commitments).toEqual([
      { prospectId: 1, teamId: 1, round: 'signing_day' },
    ]);
  });
});
