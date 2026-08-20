import type { RecruitingEvaluationAggregate, RecruitingEvaluationReport } from './types';
import { createSeededRandom } from '../../../src/domain/utils/random';
import {
  AI_RECRUITING,
  RECRUITING,
  RECRUIT_STAR_COUNTS,
} from '../../../src/domain/recruiting/config';
import { runRecruitingEvaluation, type EvaluateRunInput } from './evaluationSeason';
import {
  RECRUITING_BALANCE_TARGETS,
  aggregateSupplySummaries,
  buildClassScoreDistribution,
  buildCountDistribution,
  buildTop25ClassComposition,
  evaluateRecruitingBalance,
  evaluationChecksum,
  mean,
  round,
} from './evaluationMetrics';
export interface EvaluateSuiteInput
  extends Omit<EvaluateRunInput, 'seed' | 'seasons'> {
  rootSeed: number;
  seedCount: number;
  replaySeedCount: number;
  seasonsPerSeed: number;
}

export const runRecruitingEvaluationSuite = ({
  rootSeed,
  seedCount,
  replaySeedCount,
  seasonsPerSeed,
  ...input
}: EvaluateSuiteInput): RecruitingEvaluationReport => {
  const derivedSeeds = Array.from({ length: seedCount }, (_, index) =>
    createSeededRandom(rootSeed)
      .fork(`evaluation-run:${index}`)
      .int(0, 0xffff_ffff),
  );
  const runs = derivedSeeds.map(seed =>
    runRecruitingEvaluation({
      ...input,
      seed,
      seasons: seasonsPerSeed,
    }),
  );
  const repeatedSeeds = derivedSeeds.slice(
    0,
    Math.min(replaySeedCount, derivedSeeds.length),
  );
  const repeated = repeatedSeeds.map(seed =>
    runRecruitingEvaluation({
      ...input,
      seed,
      seasons: seasonsPerSeed,
    }),
  );
  const reproducibilityFailures = repeated.filter(
    (run, index) => run.checksum !== runs[index].checksum,
  ).length;
  const allSeasons = runs.flatMap(run => run.seasons);
  const allTeams = allSeasons.flatMap(season => season.teams);
  const totalCommitments = allSeasons.reduce(
    (sum, season) =>
      sum +
      Object.values(season.commitmentsByRound).reduce(
        (total, count) => total + count,
        0,
      ),
    0,
  );
  const signingDayCommitments = allSeasons.reduce(
    (sum, season) => sum + season.commitmentsByRound.signing_day,
    0,
  );
  const totalBase = allTeams.reduce(
    (sum, team) => sum + team.baseCapacity,
    0,
  );
  const totalBaseSignings = allTeams.reduce(
    (sum, team) => sum + team.baseSignings,
    0,
  );
  const eliteWins = allSeasons.reduce(
    (sum, season) => sum + season.lowPrestigeEliteWins,
    0,
  );
  const meaningfulPursuits = allSeasons.reduce(
    (sum, season) => sum + season.meaningfulPursuits,
    0,
  );
  const meaningfullyPursuedProspects = allSeasons.reduce(
    (sum, season) => sum + season.meaningfullyPursuedProspects,
    0,
  );
  const contestedMeaningfulProspects = allSeasons.reduce(
    (sum, season) => sum + season.contestedMeaningfulProspects,
    0,
  );
  const structuralViolations = [
    ...(reproducibilityFailures
      ? [`${reproducibilityFailures} reproducibility failures`]
      : []),
    ...runs.flatMap(run => run.structuralViolations),
  ];
  const warnings = [
    ...new Set(allSeasons.flatMap(season => season.warnings)),
  ].sort();
  const aggregate: RecruitingEvaluationAggregate = {
    signingDayShare: totalCommitments
      ? round(signingDayCommitments / totalCommitments)
      : 0,
    baseCapacityCompletion: totalBase
      ? round(totalBaseSignings / totalBase)
      : 1,
    teamsCompletingBaseCapacity: allTeams.filter(
      team => team.baseSignings === team.baseCapacity,
    ).length,
    teamBaseCapacityCompletionRate: round(
      allTeams.filter(team => team.baseSignings === team.baseCapacity)
        .length / Math.max(1, allTeams.length),
    ),
    oversigningsPerTeamSeason: round(
      allTeams.reduce((sum, team) => sum + team.oversignings, 0) /
        Math.max(1, allTeams.length),
    ),
    teamsUsingAllFourOversigns: allTeams.filter(
      team => team.oversignings === RECRUITING.oversignAllowance,
    ).length,
    teamsUsingAllFourOversignsRate: round(
      allTeams.filter(
        team => team.oversignings === RECRUITING.oversignAllowance,
      ).length / Math.max(1, allTeams.length),
    ),
    walkOnsPerTeamSeason: round(
      allTeams.reduce((sum, team) => sum + team.walkOns, 0) /
        Math.max(1, allTeams.length),
    ),
    teamSeasonsUsingWalkOns: allTeams.filter(team => team.walkOns > 0)
      .length,
    teamSeasonsUsingWalkOnsRate: round(
      allTeams.filter(team => team.walkOns > 0).length /
        Math.max(1, allTeams.length),
    ),
    meaningfulPursuits,
    meaningfullyPursuedProspects,
    contestedMeaningfulProspects,
    meaningfulCompetitionRate:
      meaningfullyPursuedProspects > 0
        ? round(
            contestedMeaningfulProspects /
              meaningfullyPursuedProspects,
          )
        : 0,
    pursuitsAdmitted: allSeasons.reduce(
      (sum, season) => sum + season.pursuitsAdmitted,
      0,
    ),
    fundableOpeningsUnfilled: allSeasons.reduce(
      (sum, season) => sum + season.fundableOpeningsUnfilled,
      0,
    ),
    lowPrestigeEliteWins: eliteWins,
    lowPrestigeEliteShare: round(
      mean(allSeasons.map(season => season.lowPrestigeEliteShare)),
    ),
    prestigeClassScoreCorrelation: round(
      mean(
        allSeasons.map(season => season.prestigeClassScoreCorrelation),
      ),
    ),
    classScoreDistribution: buildClassScoreDistribution(
      allTeams.map(team => team.classScoreExact),
    ),
    classSizeDistribution: buildCountDistribution(
      allTeams.map(team => team.signed),
    ),
    supplyByStar: aggregateSupplySummaries(
      allSeasons.map(season => season.supplyByStar),
    ),
    supplyByPosition: aggregateSupplySummaries(
      allSeasons.map(season => season.supplyByPosition),
    ),
    top25ClassComposition: buildTop25ClassComposition(allTeams),
    ratingSpreadChange: round(
      mean(runs.map(run => run.ratingSpreadChange)),
    ),
    steadyStateRatingSpreadChange: round(
      mean(
        runs.map(run => {
          const seasons = run.seasons;
          return seasons.length >= 2
            ? seasons[seasons.length - 1].ratingSpread -
                seasons[seasons.length - 2].ratingSpread
            : 0;
        }),
      ),
    ),
    prestigeMobility: runs.reduce(
      (sum, run) => sum + run.prestigeMobility,
      0,
    ),
    prestigeMobilityRate: round(
      runs.reduce((sum, run) => sum + run.prestigeMobility, 0) /
        Math.max(1, allTeams.length),
    ),
  };
  const balanceViolations = evaluateRecruitingBalance(aggregate);
  const reportWithoutChecksum = {
    rootSeed,
    derivedSeeds,
    seedCount,
    replaySeedCount: repeatedSeeds.length,
    seasonsPerSeed,
    startYear: input.startYear,
    endYear: input.startYear + seasonsPerSeed - 1,
    teamCount: input.league.teams.length,
    configuration: {
      rounds: RECRUITING.rounds,
      boardLimit: RECRUITING.boardLimit,
      meaningfulPursuitPoints: RECRUITING.meaningfulPursuitPoints,
      commitmentThreshold: RECRUITING.commitmentThreshold,
      commitmentLead: RECRUITING.commitmentLead,
      rosterSize: RECRUITING.rosterSize,
      oversignAllowance: RECRUITING.oversignAllowance,
      aiTargetOversignings: AI_RECRUITING.targetOversignings,
      recruitStarCounts: { ...(input.recruitStarCounts ?? RECRUIT_STAR_COUNTS) },
    },
    balanceTargets: RECRUITING_BALANCE_TARGETS,
    balanceViolations,
    reproducibilityFailures,
    structuralViolations,
    warnings,
    aggregate,
    runs,
  };
  return {
    ...reportWithoutChecksum,
    checksum: evaluationChecksum(reportWithoutChecksum),
  };
};
