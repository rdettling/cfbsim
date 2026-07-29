import type {
  RecruitingRuleViolation,
  RecruitingSimulationState,
} from '../../types/recruiting';
import { RECRUITING } from './config';
import { getMaxProspectAllocation } from './rules';

export const indexRecruitingState = (state: RecruitingSimulationState) => ({
  prospectsById: new Map(
    state.prospects.map(prospect => [prospect.id, prospect]),
  ),
  teamsById: new Map(state.teams.map(team => [team.teamId, team])),
});

type RecruitingStateIndex = ReturnType<typeof indexRecruitingState>;

export const validateBoard = (
  state: RecruitingSimulationState,
  teamId: number,
  prospectIds: number[],
  index = indexRecruitingState(state),
): RecruitingRuleViolation[] => {
  const violations: RecruitingRuleViolation[] = [];
  if (!index.teamsById.has(teamId)) {
    return [{ code: 'UNKNOWN_TEAM', teamId }];
  }
  if (prospectIds.length > RECRUITING.boardLimit) {
    violations.push({ code: 'BOARD_LIMIT', teamId });
  }
  const seen = new Set<number>();
  prospectIds.forEach(prospectId => {
    if (seen.has(prospectId)) {
      violations.push({ code: 'DUPLICATE_PROSPECT', teamId, prospectId });
      return;
    }
    seen.add(prospectId);
    const prospect = index.prospectsById.get(prospectId);
    if (!prospect) {
      violations.push({ code: 'UNKNOWN_PROSPECT', teamId, prospectId });
    } else if (prospect.committedTeamId !== null) {
      violations.push({ code: 'PROSPECT_COMMITTED', teamId, prospectId });
    }
  });
  return violations;
};

export const validateAllocations = (
  state: RecruitingSimulationState,
  teamId: number,
  allocations: Record<number, number>,
  index: RecruitingStateIndex = indexRecruitingState(state),
): RecruitingRuleViolation[] => {
  const team = index.teamsById.get(teamId);
  if (!team) return [{ code: 'UNKNOWN_TEAM', teamId }];
  const violations: RecruitingRuleViolation[] = [];
  const maximum = getMaxProspectAllocation(team.pointBudget);
  let total = 0;

  team.board.forEach(prospectId => {
    const prospect = index.prospectsById.get(prospectId);
    if (!prospect) {
      violations.push({ code: 'UNKNOWN_PROSPECT', teamId, prospectId });
    } else if (!prospect.interest.some(entry => entry.teamId === teamId)) {
      violations.push({ code: 'MISSING_INTEREST', teamId, prospectId });
    }
  });

  Object.entries(allocations).forEach(([prospectIdText, points]) => {
    const prospectId = Number(prospectIdText);
    total += points;
    if (!Number.isInteger(points) || points < 0) {
      violations.push({ code: 'INVALID_ALLOCATION', teamId, prospectId });
    }
    if (!team.board.includes(prospectId)) {
      violations.push({ code: 'NOT_ON_BOARD', teamId, prospectId });
    }
    const prospect = index.prospectsById.get(prospectId);
    if (!prospect) {
      violations.push({ code: 'UNKNOWN_PROSPECT', teamId, prospectId });
    } else {
      if (prospect.committedTeamId !== null) {
        violations.push({ code: 'PROSPECT_COMMITTED', teamId, prospectId });
      }
    }
    if (points > maximum) {
      violations.push({ code: 'PROSPECT_CAP_EXCEEDED', teamId, prospectId });
    }
  });
  if (total > team.pointBudget) {
    violations.push({ code: 'ROUND_BUDGET_EXCEEDED', teamId });
  }
  if (team.commitmentIds.length >= team.oversignCapacity && total > 0) {
    violations.push({ code: 'SIGNING_CAPACITY_FULL', teamId });
  }
  return violations;
};
