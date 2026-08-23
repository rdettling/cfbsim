import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import { buildRecruitingProspect } from '../../test/recruitingFixtures';
import type { RecruitingSimulationState } from '../../types/recruiting';
import { applyAiRecruitingDecisions } from './aiRound';
import { buildAiRecruitingSnapshot } from './aiSnapshot';
import {
  planAiRecruitingDecisions,
  planAssistedRecruitingDecisions,
} from './aiStrategy';
import { buildRecruitingContext } from './context';
import { createTeamRecruitingStates } from './state';
import { validateAllocations, validateBoard } from './validation';
import { ROSTER } from '../rosterConfig';
import { canAcceptCommitment } from './capacity';

const teams = [
  buildTestTeam({ id: 1, name: 'One', abbreviation: 'ONE' }),
  buildTestTeam({
    id: 2,
    name: 'Two',
    abbreviation: 'TWO',
    state: 'OS',
    ranking: 2,
  }),
];
const players = teams.flatMap(team => {
  let id = (team.id - 1) * 100 + 1;
  return Object.entries(ROSTER).flatMap(([position, config]) =>
    Array.from(
      {
        length:
          config.total -
          (['qb', 'rb', 'ol', 'dl'].includes(position) ? 1 : 0),
      },
      (_, index) =>
        buildTestPlayer({
          id: id++,
          teamId: team.id,
          pos: position,
          rating: 60 + (index % 20),
        }),
    ),
  );
});
const context = buildRecruitingContext(teams, players);

const makeState = (): RecruitingSimulationState => ({
  year: 2026,
  round: 1,
  status: 'active',
  seed: 42,
  prospects: [
    buildRecruitingProspect({ id: 1, nationalRank: 1, position: 'qb' }),
    buildRecruitingProspect({
      id: 2,
      nationalRank: 2,
      position: 'rb',
      publicRatingMin: 64,
      publicRatingMax: 74,
    }),
    buildRecruitingProspect({
      id: 3,
      nationalRank: 3,
      position: 'ol',
      publicRatingMin: 63,
      publicRatingMax: 73,
    }),
    buildRecruitingProspect({
      id: 4,
      nationalRank: 4,
      position: 'dl',
      publicRatingMin: 62,
      publicRatingMax: 72,
    }),
  ],
  teams: createTeamRecruitingStates(teams, context),
});

describe('AI recruiting public boundary', () => {
  it('constructs fresh public prospect objects with no hidden ratings', () => {
    const snapshot = buildAiRecruitingSnapshot(makeState(), context);
    expect(Object.keys(snapshot.prospects[0]).sort()).toEqual([
      'committedTeamId',
      'id',
      'interest',
      'nationalRank',
      'position',
      'preferenceWeights',
      'stars',
    ]);
    expect(snapshot.prospects[0]).not.toHaveProperty('ratingFr');
    expect(snapshot.prospects[0]).not.toHaveProperty('ratingSo');
    expect(snapshot.prospects[0].preferenceWeights).not.toBe(
      makeState().prospects[0].preferenceWeights,
    );
  });

  it('cannot change decisions by changing only hidden prospect fields', () => {
    const first = makeState();
    const second = structuredClone(first);
    second.prospects.forEach(prospect => {
      prospect.ratingFr = 30;
      prospect.ratingSo = 99;
      prospect.ratingJr = 99;
      prospect.ratingSr = 99;
      prospect.publicRatingMin = 30;
      prospect.publicRatingMax = 40;
    });
    expect(
      planAiRecruitingDecisions(
        buildAiRecruitingSnapshot(first, context),
        [1, 2],
      ),
    ).toEqual(
      planAiRecruitingDecisions(
        buildAiRecruitingSnapshot(second, context),
        [1, 2],
      ),
    );
  });
});

describe('AI recruiting decisions', () => {
  it('is deterministic, order-independent, concentrated, and validator-safe', () => {
    const state = makeState();
    const snapshot = buildAiRecruitingSnapshot(state, context);
    snapshot.teams.forEach(team => {
      expect(team.remainingTargetSlots).toBe(
        Math.min(
          team.remainingMaximumSlots,
          team.remainingBaseSlots + 2,
        ),
      );
    });
    const decisions = planAiRecruitingDecisions(snapshot, [2, 1]);
    const reordered = structuredClone(state);
    reordered.prospects.reverse();
    reordered.teams.reverse();
    const repeated = planAiRecruitingDecisions(
      buildAiRecruitingSnapshot(reordered, context),
      [1, 2],
    );

    expect(decisions).toEqual(repeated);
    const pursuedProspects = decisions.flatMap(decision =>
      Object.keys(decision.allocations).map(Number),
    );
    expect(new Set(pursuedProspects).size).toBe(
      pursuedProspects.length,
    );
    expect(pursuedProspects.length).toBeGreaterThan(0);
    decisions.forEach(decision => {
      expect(decision.board.length).toBeLessThanOrEqual(25);
      expect([...decision.board].sort((left, right) => left - right)).toEqual(
        Object.keys(decision.allocations)
          .map(Number)
          .filter(prospectId => decision.allocations[prospectId] > 0)
          .sort((left, right) => left - right),
      );
      expect(Object.values(decision.allocations).reduce(
        (sum, points) => sum + points,
        0,
      )).toBeLessThanOrEqual(105);
      expect(
        Object.values(decision.allocations).every(
          points => points >= 20,
        ),
      ).toBe(true);
    });

    const applied = applyAiRecruitingDecisions(
      state,
      decisions,
      context,
    );
    decisions.forEach(decision => {
      expect(validateBoard(
        applied.state,
        decision.teamId,
        decision.board,
      )).toEqual([]);
      expect(validateAllocations(
        applied.state,
        decision.teamId,
        decision.allocations,
      )).toEqual([]);
    });
    expect(state).toEqual(makeState());
  });

  it('drops unreachable pursuits, replaces committed targets, and stops at capacity', () => {
    const state = makeState();
    state.teams[0].board = [1, 2];
    state.teams[1].board = [1];
    state.prospects[0].interest = [
      {
        teamId: 1,
        fit: 10,
        initial: 4,
        earned: 0,
        lifetimePoints: 20,
      },
      {
        teamId: 2,
        fit: 100,
        initial: 40,
        earned: 400,
        lifetimePoints: 20,
      },
    ];
    state.prospects[1].committedTeamId = 2;
    const decision = planAiRecruitingDecisions(
      buildAiRecruitingSnapshot(state, context),
      [1],
    )[0];
    expect(decision.board).not.toContain(1);
    expect(decision.board).not.toContain(2);
    expect(decision.diagnostics.targetsRemoved).toBe(2);

    state.teams[0].oversignCapacity = 0;
    state.teams[0].baseSigningCapacity = 0;
    const full = planAiRecruitingDecisions(
      buildAiRecruitingSnapshot(state, context),
      [1],
    )[0];
    expect(full.board).toEqual([]);
    expect(full.allocations).toEqual({});
  });

  it('targets two oversignings while preserving the legal four-player allowance', () => {
    const state = makeState();
    const team = state.teams[0];
    team.baseSigningCapacity = 0;
    team.oversignCapacity = 4;
    team.commitmentIds = [1, 2];
    team.board = [3, 4];
    state.prospects.slice(0, 4).forEach(prospect => {
      prospect.interest = [
        {
          teamId: team.teamId,
          fit: 80,
          initial: 40,
          earned: 20,
          lifetimePoints: 20,
        },
      ];
    });

    const snapshot = buildAiRecruitingSnapshot(state, context);
    const teamSnapshot = snapshot.teams.find(
      candidate => candidate.teamId === team.teamId,
    )!;
    expect(teamSnapshot.remainingBaseSlots).toBe(0);
    expect(teamSnapshot.remainingTargetSlots).toBe(0);
    expect(teamSnapshot.remainingMaximumSlots).toBe(2);

    const decision = planAiRecruitingDecisions(snapshot, [team.teamId])[0];
    expect(decision.board).toEqual([]);
    expect(decision.allocations).toEqual({});
    const fullContext = buildRecruitingContext(teams, [
      ...players,
      ...['qb', 'rb', 'ol', 'dl'].map((pos, index) =>
        buildTestPlayer({
          id: 1_000 + index,
          teamId: team.teamId,
          pos,
        }),
      ),
    ]);
    expect(
      canAcceptCommitment(
        fullContext,
        team.teamId,
        ['wr', 'te', 'lb', 's'],
      ),
    ).toBe(true);
    expect(
      canAcceptCommitment(
        fullContext,
        team.teamId,
        ['wr', 'te', 'lb', 's', 'cb'],
      ),
    ).toBe(false);
  });

  it('preserves manual choices and deterministically fills the feasible remainder', () => {
    const state = makeState();
    state.teams[0].board = [1];
    const snapshot = buildAiRecruitingSnapshot(state, context);
    const assisted = {
      teamId: 1,
      allocations: { 1: 10 },
    };
    const decisions = planAssistedRecruitingDecisions(
      snapshot,
      [1, 2],
      assisted,
    );
    const repeated = planAssistedRecruitingDecisions(
      structuredClone(snapshot),
      [2, 1],
      assisted,
    );
    expect(decisions).toEqual(repeated);

    const user = decisions.find(decision => decision.teamId === 1)!;
    expect(user.board[0]).toBe(1);
    expect(user.board.length).toBeGreaterThan(1);
    expect(user.board.length).toBeLessThanOrEqual(25);
    expect(user.allocations[1]).toBeGreaterThanOrEqual(10);
    expect(
      Object.values(user.allocations).reduce(
        (sum, points) => sum + points,
        0,
      ),
    ).toBeLessThanOrEqual(snapshot.teams[0].pointBudget);
    expect(
      Object.values(user.allocations).every(
        points => points <= snapshot.teams[0].perProspectCap,
      ),
    ).toBe(true);

    const applied = applyAiRecruitingDecisions(state, decisions, context);
    expect(validateBoard(applied.state, 1, user.board)).toEqual([]);
    expect(
      validateAllocations(applied.state, 1, user.allocations),
    ).toEqual([]);

    const zeroManual = planAssistedRecruitingDecisions(
      snapshot,
      [1, 2],
      { teamId: 1, allocations: {} },
    ).find(decision => decision.teamId === 1)!;
    expect(
      Object.values(zeroManual.allocations).reduce(
        (sum, points) => sum + points,
        0,
      ),
    ).toBeGreaterThan(0);
  });

  it('adds no points when the manual allocation consumes all feasible capacity', () => {
    const state = makeState();
    state.teams[0].board = [1, 2, 3, 4];
    const snapshot = buildAiRecruitingSnapshot(state, context);
    const allocations = { 1: 26, 2: 26, 3: 26, 4: 26 };
    const decision = planAssistedRecruitingDecisions(
      snapshot,
      [1],
      { teamId: 1, allocations },
    )[0];
    expect(decision.board).toEqual([1, 2, 3, 4]);
    expect(decision.allocations).toEqual(allocations);
  });
});
