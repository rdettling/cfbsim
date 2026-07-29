import type {
  RecruitingRuleViolation,
  RecruitingSimulationState,
  TeamRecruitingState,
} from '../../types/recruiting';
import type { Team } from '../../types/domain';
import { calculateSigningCapacity } from './capacity';
import type { RecruitingContext } from './context';
import { calculateTeamFit } from './fit';
import { getRecruitingBudget, roundRecruitingValue } from './rules';
import { validateBoard } from './validation';

export const cloneRecruitingState = (
  state: RecruitingSimulationState,
): RecruitingSimulationState => structuredClone(state);

export const createTeamRecruitingStates = (
  teams: Team[],
  context: RecruitingContext,
): TeamRecruitingState[] =>
  teams.map(team => {
    const capacity = calculateSigningCapacity(context, team.id);
    return {
      teamId: team.id,
      board: [],
      allocations: {},
      commitmentIds: [],
      baseSigningCapacity: capacity.base,
      oversignCapacity: capacity.maximum,
      pointBudget: getRecruitingBudget(team.prestige),
    };
  });

export const updateRecruitingBoard = (
  source: RecruitingSimulationState,
  teamId: number,
  prospectIds: number[],
  context: RecruitingContext,
) =>
  updateRecruitingBoards(
    source,
    [{ teamId, prospectIds }],
    context,
  );

export const updateRecruitingBoards = (
  source: RecruitingSimulationState,
  updates: Array<{ teamId: number; prospectIds: number[] }>,
  context: RecruitingContext,
) => {
  const violations = updates.flatMap(update =>
    validateBoard(source, update.teamId, update.prospectIds),
  );
  if (violations.length) {
    return { state: cloneRecruitingState(source), violations };
  }
  const state = cloneRecruitingState(source);
  const prospectsById = new Map(
    state.prospects.map(prospect => [prospect.id, prospect]),
  );
  for (const update of updates) {
    const teamState = state.teams.find(
      team => team.teamId === update.teamId,
    )!;
    const team = context.teamsById.get(update.teamId);
    if (!team) {
      return {
        state: cloneRecruitingState(source),
        violations: [
          {
            code: 'UNKNOWN_TEAM',
            teamId: update.teamId,
          } satisfies RecruitingRuleViolation,
        ],
      };
    }
    teamState.board = [...update.prospectIds];
    teamState.allocations = Object.fromEntries(
      Object.entries(teamState.allocations).filter(([prospectId]) =>
        teamState.board.includes(Number(prospectId)),
      ),
    );
    update.prospectIds.forEach(prospectId => {
      const prospect = prospectsById.get(prospectId)!;
      if (
        prospect.interest.some(entry => entry.teamId === update.teamId)
      ) {
        return;
      }
      const fit = calculateTeamFit(prospect, team, context);
      prospect.interest.push({
        teamId: update.teamId,
        fit,
        initial: roundRecruitingValue(fit * 0.4),
        earned: 0,
        lifetimePoints: 0,
      });
    });
  }
  return {
    state,
    violations: [] as RecruitingRuleViolation[],
  };
};
