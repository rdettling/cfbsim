import type { AiRecruitingTeamSnapshot } from '../../types/recruiting';
import {
  compareAiRecruitingCandidatePriorities,
  compareAiRecruitingCandidates,
  countCandidatesByPosition,
  getAiRecruitingCandidatePriority,
  type AiRecruitingCandidate,
  type AiRecruitingCandidatePriority,
} from './aiCandidates';
import { RECRUITING } from './config';

export interface AiTeamPursuitState {
  team: AiRecruitingTeamSnapshot;
  candidates: AiRecruitingCandidate[];
  active: AiRecruitingCandidate[];
  minimums: Record<number, number>;
  maximumAdmissions: number;
}

export interface AiPursuitAdmissions {
  admittedByTeam: Map<number, AiRecruitingCandidate[]>;
  unfilledByTeam: Map<number, number>;
}

const admissionCost = (
  candidate: AiRecruitingCandidate,
  minimums: Record<number, number>,
) =>
  Math.max(
    0,
    RECRUITING.meaningfulPursuitPoints -
      candidate.lifetimePoints -
      (minimums[candidate.prospect.id] ?? 0),
  );

export const admitAiRecruitingPursuits = (
  states: AiTeamPursuitState[],
): AiPursuitAdmissions => {
  const admittedByTeam = new Map(
    states.map(state => [state.team.teamId, [] as AiRecruitingCandidate[]]),
  );
  const budgets = new Map(
    states.map(state => [
      state.team.teamId,
      state.team.pointBudget -
        Object.values(state.minimums).reduce(
          (sum, points) => sum + points,
          0,
        ),
    ]),
  );
  const claimed = new Set(
    states.flatMap(state =>
      state.active.map(candidate => candidate.prospect.id),
    ),
  );

  interface Proposal {
    state: AiTeamPursuitState;
    candidate: AiRecruitingCandidate;
    priority: AiRecruitingCandidatePriority;
    cost: number;
  }
  const buildProposal = (
    state: AiTeamPursuitState,
  ): Proposal | undefined => {
    const admitted = admittedByTeam.get(state.team.teamId)!;
    if (admitted.length >= state.maximumAdmissions) {
      return undefined;
    }
    const selectedByPosition = countCandidatesByPosition([
      ...state.active,
      ...admitted,
    ]);
    const availableBudget = budgets.get(state.team.teamId)!;
    const candidate = state.candidates.reduce<
      AiRecruitingCandidate | undefined
    >((best, entry) => {
      const cost = admissionCost(entry, state.minimums);
      if (
        claimed.has(entry.prospect.id) ||
        cost > availableBudget ||
        (state.minimums[entry.prospect.id] ?? 0) + cost >
          state.team.perProspectCap
      ) {
        return best;
      }
      return !best ||
        compareAiRecruitingCandidates(
          entry,
          best,
          state.team,
          selectedByPosition,
        ) < 0
        ? entry
        : best;
    }, undefined);
    return candidate
      ? {
          state,
          candidate,
          priority: getAiRecruitingCandidatePriority(
            state.team,
            candidate,
            selectedByPosition,
          ),
          cost: admissionCost(candidate, state.minimums),
        }
      : undefined;
  };

  const proposals = new Map<number, Proposal>();
  states.forEach(state => {
    const proposal = buildProposal(state);
    if (proposal) proposals.set(state.team.teamId, proposal);
  });
  while (proposals.size > 0) {
    const selected = [...proposals.values()].reduce((best, proposal) => {
      const comparison = compareAiRecruitingCandidatePriorities(
        proposal.priority,
        best.priority,
      );
      return comparison < 0 ||
        (comparison === 0 &&
          proposal.state.team.teamId < best.state.team.teamId)
        ? proposal
        : best;
    });
    admittedByTeam
      .get(selected.state.team.teamId)!
      .push(selected.candidate);
    budgets.set(
      selected.state.team.teamId,
      budgets.get(selected.state.team.teamId)! - selected.cost,
    );
    claimed.add(selected.candidate.prospect.id);
    states.forEach(state => {
      const proposal = proposals.get(state.team.teamId);
      if (
        state.team.teamId !== selected.state.team.teamId &&
        proposal?.candidate.prospect.id !== selected.candidate.prospect.id
      ) {
        return;
      }
      const replacement = buildProposal(state);
      if (replacement) {
        proposals.set(state.team.teamId, replacement);
      } else {
        proposals.delete(state.team.teamId);
      }
    });
  }

  const unfilledByTeam = new Map<number, number>();
  states.forEach(state => {
    const admitted = admittedByTeam.get(state.team.teamId)!;
    let openings = Math.max(
      0,
      state.maximumAdmissions - admitted.length,
    );
    let budget = budgets.get(state.team.teamId)!;
    const unavailableCosts = state.candidates
      .filter(
        candidate =>
          claimed.has(candidate.prospect.id) &&
          !state.active.includes(candidate) &&
          !admitted.includes(candidate),
      )
      .map(candidate => admissionCost(candidate, state.minimums))
      .filter(cost => cost > 0 && cost <= state.team.perProspectCap)
      .sort((left, right) => left - right);
    let unfilled = 0;
    for (const cost of unavailableCosts) {
      if (openings <= 0 || cost > budget) break;
      unfilled += 1;
      openings -= 1;
      budget -= cost;
    }
    unfilledByTeam.set(state.team.teamId, unfilled);
  });

  return { admittedByTeam, unfilledByTeam };
};
