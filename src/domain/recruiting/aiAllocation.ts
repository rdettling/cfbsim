import type { AiRecruitingTeamSnapshot } from '../../types/recruiting';
import {
  orderAiRecruitingCandidates,
  type AiRecruitingCandidate,
} from './aiCandidates';
import { RECRUITING } from './config';

export const allocateAiRecruitingBudget = (
  team: AiRecruitingTeamSnapshot,
  active: AiRecruitingCandidate[],
  admitted: AiRecruitingCandidate[],
  minimums: Record<number, number>,
) => {
  const allocations = { ...minimums };
  let remainingBudget =
    team.pointBudget -
    Object.values(minimums).reduce((sum, points) => sum + points, 0);

  admitted.forEach(candidate => {
    const allocated = allocations[candidate.prospect.id] ?? 0;
    const needed = Math.max(
      0,
      RECRUITING.meaningfulPursuitPoints -
        candidate.lifetimePoints -
        allocated,
    );
    allocations[candidate.prospect.id] = allocated + needed;
    remainingBudget -= needed;
  });

  for (const candidate of orderAiRecruitingCandidates(
    [...active, ...admitted],
    team,
  )) {
    if (remainingBudget <= 0) break;
    const allocated = allocations[candidate.prospect.id] ?? 0;
    const points = Math.min(
      remainingBudget,
      team.perProspectCap - allocated,
    );
    if (points <= 0) continue;
    allocations[candidate.prospect.id] = allocated + points;
    remainingBudget -= points;
  }
  return allocations;
};
