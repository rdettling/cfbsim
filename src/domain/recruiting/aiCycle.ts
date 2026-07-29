import type {
  AiRecruitingCycleReport,
  AiRecruitingDecision,
  RecruitingCommitmentEvent,
  RecruitingSimulationState,
} from '../../types/recruiting';
import { applyAiRecruitingDecisions } from './aiRound';
import {
  buildAiRecruitingFitLookup,
  buildAiRecruitingSnapshot,
} from './aiSnapshot';
import { planAiRecruitingDecisions } from './aiStrategy';
import type { RecruitingContext } from './context';
import {
  resolveRecruitingRound,
  resolveSigningDay,
} from './resolution';
import { RECRUITING } from './config';

const checksum = (value: unknown) => {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const runAiRecruitingCycle = (
  source: RecruitingSimulationState,
  context: RecruitingContext,
) => {
  let state = structuredClone(source);
  const decisionsByRound: AiRecruitingDecision[][] = [];
  const commitments: RecruitingCommitmentEvent[] = [];
  let allocatedPoints = 0;
  let availablePoints = 0;
  let targetsLost = 0;
  const fitLookup = buildAiRecruitingFitLookup(state, context);

  while (state.status === 'active') {
    const snapshot = buildAiRecruitingSnapshot(
      state,
      context,
      fitLookup,
    );
    const decisions = planAiRecruitingDecisions(
      snapshot,
      state.teams.map(team => team.teamId),
    );
    const prepared = applyAiRecruitingDecisions(
      state,
      decisions,
      context,
    );
    const allocations = Object.fromEntries(
      decisions.map(decision => [
        decision.teamId,
        { ...decision.allocations },
      ]),
    );
    decisions.forEach(decision => {
      allocatedPoints += decision.diagnostics.budgetAllocated;
      availablePoints +=
        state.teams.find(team => team.teamId === decision.teamId)
          ?.pointBudget ?? 0;
    });
    const resolution = resolveRecruitingRound(
      prepared.state,
      allocations,
      context,
    );
    resolution.commitments.forEach(commitment => {
      targetsLost += prepared.state.teams.filter(
        team =>
          team.teamId !== commitment.teamId &&
          team.board.includes(commitment.prospectId),
      ).length;
    });
    state = resolution.state;
    decisionsByRound.push(decisions);
    commitments.push(...resolution.commitments);
  }
  const signingDay = resolveSigningDay(state, context);
  state = signingDay.state;
  commitments.push(...signingDay.commitments);

  const commitmentsByRound: Record<string, number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    signing_day: 0,
  };
  commitments.forEach(commitment => {
    const key = String(commitment.round);
    commitmentsByRound[key] = (commitmentsByRound[key] ?? 0) + 1;
  });
  const prestigeByTeam = new Map(
    [...context.teamsById.values()].map(team => [team.id, team.prestige]),
  );
  const classesByPrestige: AiRecruitingCycleReport['classesByPrestige'] = {};
  [...new Set(prestigeByTeam.values())]
    .sort((left, right) => left - right)
    .forEach(prestige => {
      classesByPrestige[prestige] = {
        teams: [...prestigeByTeam.values()].filter(
          value => value === prestige,
        ).length,
        signings: 0,
        averagePublicRating: 0,
        stars: {},
      };
    });
  const publicRatingTotals = new Map<number, number>();
  state.prospects
    .filter(prospect => prospect.committedTeamId !== null)
    .forEach(prospect => {
      const prestige = prestigeByTeam.get(prospect.committedTeamId!) ?? 0;
      const summary = classesByPrestige[prestige] ?? {
        teams: 0,
        signings: 0,
        averagePublicRating: 0,
        stars: {},
      };
      summary.signings += 1;
      summary.stars[prospect.stars] =
        (summary.stars[prospect.stars] ?? 0) + 1;
      publicRatingTotals.set(
        prestige,
        (publicRatingTotals.get(prestige) ?? 0) +
          (prospect.publicRatingMin + prospect.publicRatingMax) / 2,
      );
      classesByPrestige[prestige] = summary;
    });
  Object.entries(classesByPrestige).forEach(([prestigeText, summary]) => {
    summary.averagePublicRating =
      summary.signings > 0
        ? (publicRatingTotals.get(Number(prestigeText)) ?? 0) /
          summary.signings
        : 0;
  });
  const totalBaseCapacity = source.teams.reduce(
    (sum, team) => sum + team.baseSigningCapacity,
    0,
  );
  const completedBaseCapacity = state.teams.reduce(
    (sum, team) =>
      sum + Math.min(team.baseSigningCapacity, team.commitmentIds.length),
    0,
  );
  const oversignings = state.teams.reduce(
    (sum, team) =>
      sum +
      Math.max(0, team.commitmentIds.length - team.baseSigningCapacity),
    0,
  );
  const totalCommitments = commitments.length;
  const allDecisions = decisionsByRound.flat();
  const meaningfulPursuitCounts = state.prospects.map(
    prospect =>
      prospect.interest.filter(
        entry =>
          entry.lifetimePoints >= RECRUITING.meaningfulPursuitPoints,
      ).length,
  );
  const meaningfulPursuits = meaningfulPursuitCounts.reduce(
    (sum, count) => sum + count,
    0,
  );
  const meaningfullyPursuedProspects = meaningfulPursuitCounts.filter(
    count => count > 0,
  ).length;
  const contestedMeaningfulProspects = meaningfulPursuitCounts.filter(
    count => count > 1,
  ).length;
  const report: AiRecruitingCycleReport = {
    seed: source.seed,
    checksum: checksum(state),
    status: state.status,
    commitmentsByRound,
    signingDayShare:
      totalCommitments > 0
        ? commitmentsByRound.signing_day / totalCommitments
        : 0,
    averageBudgetUse:
      availablePoints > 0 ? allocatedPoints / availablePoints : 0,
    targetsAdded: allDecisions.reduce(
      (sum, decision) => sum + decision.diagnostics.targetsAdded,
      0,
    ),
    targetsRemoved: allDecisions.reduce(
      (sum, decision) => sum + decision.diagnostics.targetsRemoved,
      0,
    ),
    targetsLost,
    meaningfulPursuits,
    meaningfullyPursuedProspects,
    contestedMeaningfulProspects,
    meaningfulCompetitionRate:
      meaningfullyPursuedProspects > 0
        ? contestedMeaningfulProspects / meaningfullyPursuedProspects
        : 0,
    pursuitsAdmitted: allDecisions.reduce(
      (sum, decision) => sum + decision.diagnostics.pursuitsAdmitted,
      0,
    ),
    fundableOpeningsUnfilled: allDecisions.reduce(
      (sum, decision) =>
        sum + decision.diagnostics.fundableOpeningsUnfilled,
      0,
    ),
    baseSignings: completedBaseCapacity,
    oversignings,
    baseCapacityCompletion:
      totalBaseCapacity > 0
        ? completedBaseCapacity / totalBaseCapacity
        : 1,
    lowPrestigeEliteWins: state.prospects.filter(
      prospect =>
        prospect.committedTeamId !== null &&
        prospect.stars >= 4 &&
        (prestigeByTeam.get(prospect.committedTeamId) ?? 7) <= 3,
    ).length,
    flags:
      completedBaseCapacity < totalBaseCapacity
        ? ['BASE_CAPACITY_INCOMPLETE']
        : [],
    classesByPrestige,
    teams: state.teams.map(team => {
      const sourceTeam = source.teams.find(
        candidate => candidate.teamId === team.teamId,
      )!;
      return {
        teamId: team.teamId,
        baseCapacity: sourceTeam.baseSigningCapacity,
        signings: team.commitmentIds.length,
        baseSignings: Math.min(
          sourceTeam.baseSigningCapacity,
          team.commitmentIds.length,
        ),
        oversignings: Math.max(
          0,
          team.commitmentIds.length - sourceTeam.baseSigningCapacity,
        ),
      };
    }),
  };
  return { state, decisionsByRound, commitments, report };
};
