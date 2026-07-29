import { describe, expect, it } from 'vitest';
import type {
  AiPublicProspect,
  AiRecruitingTeamSnapshot,
} from '../../types/recruiting';
import {
  compareAiRecruitingCandidates,
  getAiRecruitingCandidatePriority,
  scoreAiRecruitingCandidate,
  type AiRecruitingCandidate,
} from './aiCandidates';

const prospect = (id: number, position: string): AiPublicProspect => ({
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
});

const team = (): AiRecruitingTeamSnapshot => ({
  teamId: 1,
  pointBudget: 100,
  perProspectCap: 25,
  board: [],
  commitmentIds: [],
  remainingBaseSlots: 10,
  remainingTargetSlots: 12,
  remainingMaximumSlots: 14,
  positions: {
    qb: {
      returning: 0,
      committed: 0,
      projected: 0,
      starters: 1,
      softTarget: 3,
      starterShortage: 1,
      softDeficit: 3,
    },
    wr: {
      returning: 4,
      committed: 0,
      projected: 4,
      starters: 3,
      softTarget: 6,
      starterShortage: 0,
      softDeficit: 2,
    },
  },
  prospectFits: [],
});

const candidate = (
  player: AiPublicProspect,
  overrides: Partial<AiRecruitingCandidate> = {},
): AiRecruitingCandidate => ({
  prospect: player,
  fit: 50,
  ownInterest: 20,
  lifetimePoints: 0,
  competitorInterest: 20,
  competitionViability: 100,
  publicValue: 60,
  tie: player.id / 100,
  ...overrides,
});

describe('AI recruiting candidate priority', () => {
  it('gives an unresolved starter shortage hard priority', () => {
    const selected = new Map<string, number>();
    const quarterback = candidate(prospect(1, 'qb'), {
      publicValue: 40,
      fit: 20,
    });
    const receiver = candidate(prospect(2, 'wr'), {
      publicValue: 90,
      fit: 100,
    });
    expect(
      compareAiRecruitingCandidates(
        quarterback,
        receiver,
        team(),
        selected,
      ),
    ).toBeLessThan(0);
    selected.set('qb', 1);
    expect(
      compareAiRecruitingCandidates(
        receiver,
        quarterback,
        team(),
        selected,
      ),
    ).toBeLessThan(0);
  });

  it('does not let starter shortages override elite-prospect plausibility', () => {
    const selected = new Map<string, number>();
    const threeStar = candidate(prospect(1, 'qb'));
    const fourStar = candidate(
      { ...prospect(2, 'qb'), stars: 4 },
    );

    expect(
      getAiRecruitingCandidatePriority(team(), threeStar, selected)
        .starterShortage,
    ).toBe(true);
    expect(
      getAiRecruitingCandidatePriority(team(), fourStar, selected)
        .starterShortage,
    ).toBe(false);
  });

  it('uses the existing public weighted score', () => {
    const value = candidate(prospect(1, 'wr'), {
      publicValue: 80,
      fit: 60,
      competitionViability: 40,
    });
    expect(scoreAiRecruitingCandidate(value, team(), new Map())).toBe(
      80 * 0.35 + 60 * 0.3 + 70 * 0.25 + 40 * 0.1,
    );
  });
});
