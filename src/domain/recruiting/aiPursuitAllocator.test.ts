import { describe, expect, it } from 'vitest';
import type {
  AiPublicProspect,
  AiRecruitingTeamSnapshot,
} from '../../types/recruiting';
import type { AiRecruitingCandidate } from './aiCandidates';
import { admitAiRecruitingPursuits } from './aiPursuitAllocator';

const team = (
  teamId: number,
  overrides: Partial<AiRecruitingTeamSnapshot> = {},
): AiRecruitingTeamSnapshot => ({
  teamId,
  pointBudget: 40,
  perProspectCap: 25,
  board: [],
  commitmentIds: [],
  remainingBaseSlots: 2,
  remainingTargetSlots: 2,
  remainingMaximumSlots: 4,
  positions: {
    qb: {
      returning: 0,
      committed: 0,
      projected: 0,
      starters: 1,
      softTarget: 2,
      starterShortage: 1,
      softDeficit: 2,
    },
    wr: {
      returning: 2,
      committed: 0,
      projected: 2,
      starters: 2,
      softTarget: 4,
      starterShortage: 0,
      softDeficit: 2,
    },
  },
  prospectFits: [],
  ...overrides,
});

const candidate = (
  id: number,
  position: string,
  score: number,
): AiRecruitingCandidate => ({
  prospect: {
    id,
    nationalRank: id,
    position,
    stars: 3,
    preferenceWeights: {
      prestige: 25,
      proximity: 25,
      playingTime: 25,
      recentSuccess: 25,
    },
    committedTeamId: null,
    interest: [],
  } satisfies AiPublicProspect,
  fit: 50,
  ownInterest: 20,
  lifetimePoints: 0,
  competitorInterest: 20,
  competitionViability: 100,
  publicValue: score,
  tie: id / 100,
});

describe('AI pursuit admission', () => {
  it('is exclusive, budget bounded, and input-order invariant', () => {
    const shared = candidate(1, 'qb', 90);
    const states = [
      {
        team: team(1),
        candidates: [shared, candidate(2, 'wr', 80)],
        active: [],
        minimums: {},
        maximumAdmissions: 2,
      },
      {
        team: team(2),
        candidates: [shared, candidate(3, 'wr', 70)],
        active: [],
        minimums: {},
        maximumAdmissions: 2,
      },
    ];
    const first = admitAiRecruitingPursuits(states);
    const repeated = admitAiRecruitingPursuits(
      [...states].reverse().map(state => ({
        ...state,
        candidates: [...state.candidates].reverse(),
      })),
    );
    const ids = (result: typeof first) =>
      [...result.admittedByTeam.entries()]
        .sort(([left], [right]) => left - right)
        .map(([teamId, admitted]) => [
          teamId,
          admitted.map(entry => entry.prospect.id),
        ]);
    expect(ids(repeated)).toEqual(ids(first));
    expect(
      ids(first)
        .flatMap(([, admitted]) => admitted as number[])
        .filter(id => id === 1),
    ).toHaveLength(1);
  });

  it('recomputes starter shortages and respects the cap', () => {
    const sourceTeam = team(1);
    sourceTeam.positions.wr = {
      ...sourceTeam.positions.wr,
      returning: 1,
      projected: 1,
      starterShortage: 1,
    };
    const result = admitAiRecruitingPursuits([
      {
        team: sourceTeam,
        candidates: [
          candidate(1, 'qb', 90),
          candidate(2, 'qb', 85),
          candidate(3, 'wr', 60),
        ],
        active: [],
        minimums: {},
        maximumAdmissions: 2,
      },
    ]);
    expect(
      result.admittedByTeam.get(1)?.map(entry => entry.prospect.id),
    ).toEqual([1, 3]);

    const capped = admitAiRecruitingPursuits([
      {
        team: team(1, { pointBudget: 30, perProspectCap: 15 }),
        candidates: [candidate(1, 'qb', 90)],
        active: [],
        minimums: {},
        maximumAdmissions: 2,
      },
    ]);
    expect(capped.admittedByTeam.get(1)).toEqual([]);
  });
});
