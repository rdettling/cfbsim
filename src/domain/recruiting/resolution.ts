import type {
  RecruitingCommitmentEvent,
  RecruitingResolution,
  RecruitingSimulationState,
} from '../../types/recruiting';
import { RECRUITING } from './config';
import type { RecruitingContext } from './context';
import {
  calculateInterestGain,
  RecruitingRuleViolationError,
  roundRecruitingValue,
} from './rules';
import { cloneRecruitingState } from './state';
import {
  getRecruitingCommitmentCandidates,
} from './standings';
import {
  indexRecruitingState,
  validateAllocations,
} from './validation';

const commit = (
  state: RecruitingSimulationState,
  prospectId: number,
  teamId: number,
  round: RecruitingSimulationState['round'] | 'signing_day',
  prospectsById: ReturnType<
    typeof indexRecruitingState
  >['prospectsById'],
  teamsById: ReturnType<typeof indexRecruitingState>['teamsById'],
) => {
  const prospect = prospectsById.get(prospectId)!;
  prospect.committedTeamId = teamId;
  prospect.committedRound = round;
  state.teams.forEach(team => {
    team.board = team.board.filter(id => id !== prospectId);
    delete team.allocations[prospectId];
  });
  teamsById.get(teamId)!.commitmentIds.push(prospectId);
};

const statusError = (
  state: RecruitingSimulationState,
  code: 'INVALID_ROUND' | 'INVALID_STATUS',
) =>
  new RecruitingRuleViolationError([
    { code, teamId: state.teams[0]?.teamId ?? 0 },
  ]);

export const resolveRecruitingRound = (
  source: RecruitingSimulationState,
  allocationsByTeam: Record<number, Record<number, number>>,
  context: RecruitingContext,
): RecruitingResolution => {
  if (source.status !== 'active') throw statusError(source, 'INVALID_STATUS');
  if (source.round < 1 || source.round > RECRUITING.rounds) {
    throw statusError(source, 'INVALID_ROUND');
  }

  const state = cloneRecruitingState(source);
  const stateIndex = indexRecruitingState(state);
  const { prospectsById, teamsById } = stateIndex;
  state.teams.forEach(team => {
    const allocations = allocationsByTeam[team.teamId] ?? {};
    const violations = validateAllocations(
      state,
      team.teamId,
      allocations,
      stateIndex,
    );
    if (violations.length) throw new RecruitingRuleViolationError(violations);
    team.allocations = { ...allocations };
    Object.entries(allocations).forEach(([prospectIdText, points]) => {
      if (points <= 0) return;
      const prospect = prospectsById.get(Number(prospectIdText))!;
      const interest = prospect.interest.find(
        entry => entry.teamId === team.teamId,
      )!;
      interest.earned = roundRecruitingValue(
        interest.earned + calculateInterestGain(points, interest.fit),
      );
      interest.lifetimePoints += points;
    });
  });

  const commitments: RecruitingCommitmentEvent[] = [];
  [...state.prospects]
    .filter(prospect => prospect.committedTeamId === null)
    .sort((left, right) => left.nationalRank - right.nationalRank)
    .forEach(prospect => {
      const candidates = getRecruitingCommitmentCandidates(
        state,
        prospect.id,
        context,
        'round',
        stateIndex,
      );
      const leader = candidates[0];
      if (!leader) return;
      const runnerUp = candidates[1];
      const lead =
        leader.totalInterest - (runnerUp?.totalInterest ?? 0);
      if (
        leader.totalInterest < RECRUITING.commitmentThreshold ||
        lead < RECRUITING.commitmentLead
      ) {
        return;
      }
      commit(
        state,
        prospect.id,
        leader.team.teamId,
        state.round,
        prospectsById,
        teamsById,
      );
      commitments.push({
        prospectId: prospect.id,
        teamId: leader.team.teamId,
        round: state.round,
      });
    });

  state.teams.forEach(team => {
    team.allocations = {};
  });
  if (state.round === RECRUITING.rounds) {
    state.status = 'ready_for_signing_day';
  } else {
    state.round = (state.round + 1) as RecruitingSimulationState['round'];
  }
  return { state, commitments };
};

export const resolveSigningDay = (
  source: RecruitingSimulationState,
  context: RecruitingContext,
): RecruitingResolution => {
  if (source.status !== 'ready_for_signing_day') {
    throw statusError(source, 'INVALID_STATUS');
  }
  if (source.round !== RECRUITING.rounds) {
    throw statusError(source, 'INVALID_ROUND');
  }
  const state = cloneRecruitingState(source);
  const { prospectsById, teamsById } = indexRecruitingState(state);
  const commitments: RecruitingCommitmentEvent[] = [];

  [...state.prospects]
    .filter(prospect => prospect.committedTeamId === null)
    .sort((left, right) => left.nationalRank - right.nationalRank)
    .forEach(prospect => {
      const candidates = getRecruitingCommitmentCandidates(
        state,
        prospect.id,
        context,
        'signing_day',
        { prospectsById, teamsById },
      );
      if (!candidates[0]) return;
      commit(
        state,
        prospect.id,
        candidates[0].team.teamId,
        'signing_day',
        prospectsById,
        teamsById,
      );
      commitments.push({
        prospectId: prospect.id,
        teamId: candidates[0].team.teamId,
        round: 'signing_day',
      });
    });
  state.status = 'finalized';
  return { state, commitments };
};
