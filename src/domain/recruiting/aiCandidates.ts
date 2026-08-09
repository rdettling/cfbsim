import type {
  AiPublicProspect,
  AiRecruitingSnapshot,
  AiRecruitingTeamSnapshot,
} from '../../types/recruiting';
import { AI_RECRUITING } from './config';
import { createSeededRandom } from '../utils/random';
import {
  calculateInterestGain,
  roundRecruitingValue,
} from './rules';
import { buildPublicRecruitingValues } from './publicValue';

export interface AiRecruitingCandidate {
  prospect: AiPublicProspect;
  fit: number;
  ownInterest: number;
  lifetimePoints: number;
  competitorInterest: number;
  competitionViability: number;
  publicValue: number;
  tie: number;
}

export interface AiRecruitingCandidatePriority {
  starterShortage: boolean;
  score: number;
  tie: number;
  prospectId: number;
}

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

const needValue = (
  team: AiRecruitingTeamSnapshot,
  position: string,
  selectedAtPosition: number,
) => {
  const need = team.positions[position];
  if (!need) return AI_RECRUITING.otherNeed;
  if (need.projected + selectedAtPosition < need.starters) {
    return AI_RECRUITING.starterShortageNeed;
  }
  if (need.projected + selectedAtPosition < need.softTarget) {
    return AI_RECRUITING.softDeficitNeed;
  }
  return AI_RECRUITING.otherNeed;
};

export const scoreAiRecruitingCandidate = (
  candidate: AiRecruitingCandidate,
  team: AiRecruitingTeamSnapshot,
  selectedByPosition: ReadonlyMap<string, number>,
) =>
  candidate.publicValue * AI_RECRUITING.scoreValueWeight +
  candidate.fit * AI_RECRUITING.scoreFitWeight +
  needValue(
    team,
    candidate.prospect.position,
    selectedByPosition.get(candidate.prospect.position) ?? 0,
  ) *
    AI_RECRUITING.scoreNeedWeight +
  candidate.competitionViability *
    AI_RECRUITING.scoreCompetitionWeight;

export const getAiRecruitingCandidatePriority = (
  team: AiRecruitingTeamSnapshot,
  candidate: AiRecruitingCandidate,
  selectedByPosition: ReadonlyMap<string, number>,
): AiRecruitingCandidatePriority => {
  const position = candidate.prospect.position;
  const need = team.positions[position];
  return {
    starterShortage: Boolean(
      candidate.prospect.stars <= 3 &&
        need &&
        need.projected +
          (selectedByPosition.get(position) ?? 0) <
          need.starters,
    ),
    score: scoreAiRecruitingCandidate(
      candidate,
      team,
      selectedByPosition,
    ),
    tie: candidate.tie,
    prospectId: candidate.prospect.id,
  };
};

export const compareAiRecruitingCandidatePriorities = (
  left: AiRecruitingCandidatePriority,
  right: AiRecruitingCandidatePriority,
) =>
  Number(right.starterShortage) - Number(left.starterShortage) ||
  right.score - left.score ||
  left.tie - right.tie ||
  left.prospectId - right.prospectId;

export const compareAiRecruitingCandidates = (
  left: AiRecruitingCandidate,
  right: AiRecruitingCandidate,
  team: AiRecruitingTeamSnapshot,
  selectedByPosition: ReadonlyMap<string, number>,
) =>
  compareAiRecruitingCandidatePriorities(
    getAiRecruitingCandidatePriority(
      team,
      left,
      selectedByPosition,
    ),
    getAiRecruitingCandidatePriority(
      team,
      right,
      selectedByPosition,
    ),
  );

export const countCandidatesByPosition = (
  candidates: AiRecruitingCandidate[],
) => {
  const counts = new Map<string, number>();
  candidates.forEach(candidate => {
    counts.set(
      candidate.prospect.position,
      (counts.get(candidate.prospect.position) ?? 0) + 1,
    );
  });
  return counts;
};

export const orderAiRecruitingCandidates = (
  candidates: AiRecruitingCandidate[],
  team: AiRecruitingTeamSnapshot,
) => {
  const remaining = [...candidates];
  const selectedByPosition = new Map<string, number>();
  const ordered: AiRecruitingCandidate[] = [];
  while (remaining.length > 0) {
    const next = remaining.reduce((best, candidate) =>
      compareAiRecruitingCandidates(
        candidate,
        best,
        team,
        selectedByPosition,
      ) < 0
        ? candidate
        : best,
    );
    ordered.push(next);
    selectedByPosition.set(
      next.prospect.position,
      (selectedByPosition.get(next.prospect.position) ?? 0) + 1,
    );
    remaining.splice(remaining.indexOf(next), 1);
  }
  return ordered;
};

export const buildAiRecruitingCandidates = (
  snapshot: AiRecruitingSnapshot,
  team: AiRecruitingTeamSnapshot,
) => {
  if (team.remainingMaximumSlots <= 0) {
    return [] as AiRecruitingCandidate[];
  }
  const prospectsById = new Map(
    snapshot.prospects.map(prospect => [prospect.id, prospect]),
  );
  const random = createSeededRandom(snapshot.seed);
  const publicValues = buildPublicRecruitingValues(snapshot.prospects);
  return team.prospectFits.flatMap(teamFit => {
    const prospect = prospectsById.get(teamFit.prospectId);
    if (
      !prospect ||
      !teamFit.canAccept ||
      prospect.committedTeamId !== null
    ) {
      return [];
    }
    const ownEntry = prospect.interest.find(
      entry => entry.teamId === team.teamId,
    );
    const ownInterest =
      ownEntry?.totalInterest ??
      roundRecruitingValue(teamFit.fit * 0.4);
    const competitorInterest = prospect.interest
      .filter(entry => entry.teamId !== team.teamId)
      .reduce(
        (maximum, entry) => Math.max(maximum, entry.totalInterest),
        0,
      );
    const maxCatchup = roundRecruitingValue(
      calculateInterestGain(team.perProspectCap, teamFit.fit) *
        snapshot.remainingRounds,
    );
    if (ownInterest + maxCatchup < competitorInterest) return [];
    const gap = Math.max(0, competitorInterest - ownInterest);
    return [
      {
        prospect,
        fit: teamFit.fit,
        ownInterest,
        lifetimePoints: ownEntry?.lifetimePoints ?? 0,
        competitorInterest,
        competitionViability:
          gap === 0
            ? 100
            : clamp(100 - (gap / Math.max(1, maxCatchup)) * 100),
        publicValue:
          publicValues.get(prospect.id) ??
          prospect.stars * 20 * AI_RECRUITING.publicValueStarsWeight,
        tie: random
          .fork(
            `ai:candidate:${snapshot.year}:${snapshot.round}:${team.teamId}:${prospect.id}`,
          )
          .next(),
      },
    ];
  });
};
