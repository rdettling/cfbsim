import type {
  AiRecruitingDecision,
  RecruitingSimulationState,
} from '../../types/recruiting';
import type { RecruitingContext } from './context';
import { RecruitingRuleViolationError } from './rules';
import { updateRecruitingBoards } from './state';
import { validateAllocations } from './validation';

export const applyAiRecruitingDecisions = (
  source: RecruitingSimulationState,
  decisions: AiRecruitingDecision[],
  context: RecruitingContext,
) => {
  const boardResult = updateRecruitingBoards(
    source,
    decisions.map(decision => ({
      teamId: decision.teamId,
      prospectIds: decision.board,
    })),
    context,
  );
  if (boardResult.violations.length) {
    throw new RecruitingRuleViolationError(boardResult.violations);
  }
  for (const decision of decisions) {
    const violations = validateAllocations(
      boardResult.state,
      decision.teamId,
      decision.allocations,
    );
    if (violations.length) {
      throw new RecruitingRuleViolationError(violations);
    }
  }
  return {
    state: boardResult.state,
    allocations: Object.fromEntries(
      decisions.map(decision => [
        decision.teamId,
        { ...decision.allocations },
      ]),
    ),
  };
};
