import type {
  AiRecruitingDecision,
  AiRecruitingSnapshot,
} from '../../types/recruiting';
import { allocateAiRecruitingBudget } from './aiAllocation';
import {
  buildAiRecruitingCandidates,
  orderAiRecruitingCandidates,
} from './aiCandidates';
import {
  admitAiRecruitingPursuits,
  type AiTeamPursuitState,
} from './aiPursuitAllocator';
import { RECRUITING } from './config';

interface AssistedRecruitingPlan {
  teamId: number;
  allocations: Record<number, number>;
}

const planRecruitingDecisions = (
  snapshot: AiRecruitingSnapshot,
  teamIds: number[],
  assisted?: AssistedRecruitingPlan,
): AiRecruitingDecision[] => {
  const states: AiTeamPursuitState[] = [...new Set(teamIds)]
    .sort((left, right) => left - right)
    .map(teamId => {
      const team = snapshot.teams.find(candidate => candidate.teamId === teamId);
      if (!team) {
        throw new Error(`AI recruiting snapshot is missing team ${teamId}.`);
      }
      const candidates = buildAiRecruitingCandidates(snapshot, team);
      const minimums =
        assisted?.teamId === teamId ? assisted.allocations : {};
      const active =
        team.remainingTargetSlots > 0
          ? candidates.filter(
              candidate =>
                team.board.includes(candidate.prospect.id) &&
                candidate.lifetimePoints +
                  (minimums[candidate.prospect.id] ?? 0) >=
                  RECRUITING.meaningfulPursuitPoints,
            )
          : [];
      const openPursuitSlots = Math.max(
        0,
        team.remainingTargetSlots - active.length,
      );
      const occupiedBoardSlots =
        assisted?.teamId === teamId ? team.board.length : active.length;
      const maximumAdmissions = Math.min(
        openPursuitSlots,
        RECRUITING.boardLimit - occupiedBoardSlots,
      );
      return {
        team,
        candidates,
        active,
        minimums,
        maximumAdmissions,
      };
    });
  const admissions = admitAiRecruitingPursuits(states);

  return states.map(state => {
    const admitted =
      admissions.admittedByTeam.get(state.team.teamId) ?? [];
    const orderedActive = orderAiRecruitingCandidates(
      [...state.active, ...admitted],
      state.team,
    );
    const preservedBoard =
      assisted?.teamId === state.team.teamId ? state.team.board : [];
    const board = [
      ...preservedBoard,
      ...orderedActive
        .map(candidate => candidate.prospect.id)
        .filter(prospectId => !preservedBoard.includes(prospectId)),
    ].slice(0, RECRUITING.boardLimit);
    const allocations =
      state.team.remainingTargetSlots > 0
        ? allocateAiRecruitingBudget(
            state.team,
            state.active,
            admitted,
            state.minimums,
          )
        : {};
    const offBoardAllocations = Object.keys(allocations)
      .map(Number)
      .filter(prospectId => !board.includes(prospectId));
    if (offBoardAllocations.length > 0) {
      throw new Error(
        `AI recruiting planned off-board allocations for team ${state.team.teamId}: ${offBoardAllocations.join(', ')}.`,
      );
    }
    const prior = new Set(state.team.board);
    const next = new Set(board);
    return {
      teamId: state.team.teamId,
      board,
      allocations,
      diagnostics: {
        targetsAdded: board.filter(id => !prior.has(id)).length,
        targetsRemoved: state.team.board.filter(id => !next.has(id)).length,
        meaningfulTargets: orderedActive.length,
        budgetAllocated: Object.values(allocations).reduce(
          (sum, points) => sum + points,
          0,
        ),
        pursuitsAdmitted: admitted.length,
        fundableOpeningsUnfilled:
          admissions.unfilledByTeam.get(state.team.teamId) ?? 0,
      },
    };
  });
};

export const planAiRecruitingDecisions = (
  snapshot: AiRecruitingSnapshot,
  aiTeamIds: number[],
) => planRecruitingDecisions(snapshot, aiTeamIds);

export const planAssistedRecruitingDecisions = (
  snapshot: AiRecruitingSnapshot,
  teamIds: number[],
  assisted: AssistedRecruitingPlan,
) => planRecruitingDecisions(snapshot, teamIds, assisted);
