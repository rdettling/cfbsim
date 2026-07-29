import type { HistoryData, PrestigeConfig, TeamsData } from '../../types/baseData';
import type { PlayerRecord } from '../../types/db';
import type { LeagueState } from '../../types/league';
import type { WeightedNameData } from '../../types/recruiting';
import type {
  RecruitingBalanceMetric,
  RecruitingBalanceViolation,
  RecruitingClassScoreDistribution,
  RecruitingCountDistribution,
  RecruitingEvaluationAggregate,
  RecruitingEvaluationReport,
  RecruitingEvaluationRun,
  RecruitingEvaluationSeason,
  RecruitingEvaluationTeamYear,
  RecruitingTop25Composition,
  RecruitingSupplySummary,
} from '../../types/recruitingEvaluation';
import { updateHistoryForSeason } from '../league/history';
import {
  applyPrestigeChanges,
  calculatePrestigeChanges,
} from '../league/prestige';
import { buildRecruitingResults } from '../league/recruitingResults';
import { applyProgression } from '../roster';
import {
  applyRosterCutIds,
  assertFinalRosters,
  recommendRosterCuts,
} from '../rosterCuts';
import { recalculateTeamRatings, setStarters } from '../rosterRatings';
import { POSITION_ORDER, ROSTER } from '../rosterConfig';
import { generateWalkOns } from '../walkOns';
import { runAiRecruitingCycle } from './aiCycle';
import { calculateRecruitingClassScore } from './classScoring';
import {
  AI_RECRUITING,
  RECRUITING,
  RECRUIT_STAR_COUNTS,
  type RecruitStarCounts,
} from './config';
import { buildRecruitingContext } from './context';
import { buildCommittedFreshmen } from './freshmen';
import { generateProspectPool } from './generation';
import { createSeededRandom } from './random';
import { createTeamRecruitingStates } from './state';

const round = (value: number, digits = 6) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export const RECRUITING_BALANCE_TARGETS = {
  baseCapacityCompletion: { minimum: 0.985 },
  teamBaseCapacityCompletionRate: { minimum: 0.85 },
  oversigningsPerTeamSeason: { minimum: 1, maximum: 2.5 },
  teamsUsingAllFourOversignsRate: { maximum: 0.3 },
  walkOnsPerTeamSeason: { maximum: 0.2 },
  teamSeasonsUsingWalkOnsRate: { maximum: 0.15 },
  prestigeClassScoreCorrelation: { minimum: 0.35 },
  prestigeMobilityRate: { minimum: 0.05, maximum: 0.2 },
} as const satisfies Record<
  RecruitingBalanceMetric,
  { minimum?: number; maximum?: number }
>;

const BALANCE_VIOLATION_CODES: Record<
  RecruitingBalanceMetric,
  RecruitingBalanceViolation['code']
> = {
  baseCapacityCompletion: 'BASE_CAPACITY_COMPLETION_BELOW_MINIMUM',
  teamBaseCapacityCompletionRate:
    'TEAM_BASE_CAPACITY_COMPLETION_RATE_BELOW_MINIMUM',
  oversigningsPerTeamSeason:
    'OVERSIGNINGS_PER_TEAM_SEASON_OUT_OF_RANGE',
  teamsUsingAllFourOversignsRate:
    'ALL_FOUR_OVERSIGNS_RATE_ABOVE_MAXIMUM',
  walkOnsPerTeamSeason: 'WALK_ONS_PER_TEAM_SEASON_ABOVE_MAXIMUM',
  teamSeasonsUsingWalkOnsRate:
    'WALK_ON_TEAM_SEASON_RATE_ABOVE_MAXIMUM',
  prestigeClassScoreCorrelation:
    'PRESTIGE_CLASS_SCORE_CORRELATION_OUT_OF_RANGE',
  prestigeMobilityRate: 'PRESTIGE_MOBILITY_RATE_OUT_OF_RANGE',
};

export const evaluateRecruitingBalance = (
  aggregate: RecruitingEvaluationAggregate,
): RecruitingBalanceViolation[] =>
  (Object.keys(RECRUITING_BALANCE_TARGETS) as RecruitingBalanceMetric[])
    .filter(metric => {
      const target = RECRUITING_BALANCE_TARGETS[metric];
      return (
        ('minimum' in target && aggregate[metric] < target.minimum) ||
        ('maximum' in target && aggregate[metric] > target.maximum)
      );
    })
    .map(metric => ({
      code: BALANCE_VIOLATION_CODES[metric],
      metric,
      actual: aggregate[metric],
      ...RECRUITING_BALANCE_TARGETS[metric],
    }));

export const pearsonCorrelation = (left: number[], right: number[]) => {
  if (!left.length || left.length !== right.length) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftVariance = left.reduce(
    (sum, value) => sum + (value - leftMean) ** 2,
    0,
  );
  const rightVariance = right.reduce(
    (sum, value) => sum + (value - rightMean) ** 2,
    0,
  );
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? round(numerator / denominator) : 0;
};

const percentile = (values: number[], value: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.round((sorted.length - 1) * value);
  return sorted[index] ?? 0;
};

export const buildClassScoreDistribution = (
  scores: number[],
): RecruitingClassScoreDistribution => {
  if (!scores.length) {
    return {
      teams: 0,
      minimum: 0,
      p10: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      maximum: 0,
      mean: 0,
      standardDeviation: 0,
      exactDistinctScores: 0,
      displayedDistinctScores: 0,
      exactTieRate: 0,
      displayedTieRate: 0,
    };
  }
  const average = mean(scores);
  const exactScores = scores.map(score => round(score));
  const displayedScores = scores.map(score => round(score, 1));
  const exactDistinctScores = new Set(exactScores).size;
  const displayedDistinctScores = new Set(displayedScores).size;
  return {
    teams: scores.length,
    minimum: round(Math.min(...scores)),
    p10: round(percentile(scores, 0.1)),
    p25: round(percentile(scores, 0.25)),
    median: round(percentile(scores, 0.5)),
    p75: round(percentile(scores, 0.75)),
    p90: round(percentile(scores, 0.9)),
    maximum: round(Math.max(...scores)),
    mean: round(average),
    standardDeviation: round(
      Math.sqrt(
        mean(scores.map(score => (score - average) ** 2)),
      ),
    ),
    exactDistinctScores,
    displayedDistinctScores,
    exactTieRate: round(
      (scores.length - exactDistinctScores) / scores.length,
    ),
    displayedTieRate: round(
      (scores.length - displayedDistinctScores) / scores.length,
    ),
  };
};

export const buildCountDistribution = (
  values: number[],
): RecruitingCountDistribution => ({
  count: values.length,
  minimum: values.length ? Math.min(...values) : 0,
  p10: percentile(values, 0.1),
  p25: percentile(values, 0.25),
  median: percentile(values, 0.5),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.9),
  maximum: values.length ? Math.max(...values) : 0,
  mean: round(mean(values)),
});

const buildSupplyEntry = (
  available: number,
  signed: number,
): RecruitingSupplySummary => ({
  available,
  signed,
  unsigned: available - signed,
  signingRate: available ? round(signed / available) : 0,
});

export const buildRecruitingSupplySummary = <T>(
  values: T[],
  categories: readonly (string | number)[],
  category: (value: T) => string | number,
  signed: (value: T) => boolean,
): Record<string, RecruitingSupplySummary> =>
  Object.fromEntries(
    categories.map(item => {
      const matching = values.filter(value => category(value) === item);
      return [
        item,
        buildSupplyEntry(
          matching.length,
          matching.filter(signed).length,
        ),
      ];
    }),
  );

const aggregateSupplySummaries = (
  summaries: Record<string, RecruitingSupplySummary>[],
) => {
  const categories = [
    ...new Set(summaries.flatMap(summary => Object.keys(summary))),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return Object.fromEntries(
    categories.map(category => {
      const available = summaries.reduce(
        (sum, summary) => sum + (summary[category]?.available ?? 0),
        0,
      );
      const signed = summaries.reduce(
        (sum, summary) => sum + (summary[category]?.signed ?? 0),
        0,
      );
      return [category, buildSupplyEntry(available, signed)];
    }),
  );
};

export const buildTop25ClassComposition = (
  teams: Array<
    Pick<RecruitingEvaluationTeamYear, 'classRank' | 'prestigeBefore'>
  >,
): RecruitingTop25Composition => {
  const top25 = teams.filter(team => team.classRank <= 25);
  return Object.fromEntries(
    [...new Set(teams.map(team => team.prestigeBefore))]
      .sort((left, right) => left - right)
      .map(prestige => {
        const eligibleTeamSeasons = teams.filter(
          team => team.prestigeBefore === prestige,
        ).length;
        const appearances = top25.filter(
          team => team.prestigeBefore === prestige,
        ).length;
        return [
          prestige,
          {
            eligibleTeamSeasons,
            appearances,
            compositionShare: round(
              appearances / Math.max(1, top25.length),
            ),
            appearanceRate: round(
              appearances / Math.max(1, eligibleTeamSeasons),
            ),
          },
        ];
      }),
  );
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
};

export const evaluationChecksum = (value: unknown) => {
  const text = JSON.stringify(canonicalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const countBy = <T>(values: T[], key: (value: T) => string) =>
  values.reduce<Record<string, number>>((counts, value) => {
    const item = key(value);
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});

const assertStarters = (league: LeagueState, players: PlayerRecord[]) => {
  for (const team of league.teams) {
    for (const position of POSITION_ORDER) {
      const count = players.filter(
        player =>
          player.active &&
          player.starter &&
          player.teamId === team.id &&
          player.pos === position,
      ).length;
      if (count !== ROSTER[position].starters) {
        throw new Error(
          `Team ${team.id} has ${count} ${position} starters in evaluation.`,
        );
      }
    }
  }
};

const buildPrestigeSummaries = (
  teams: RecruitingEvaluationTeamYear[],
) =>
  Object.fromEntries(
    [...new Set(teams.map(team => team.prestigeBefore))]
      .sort((left, right) => left - right)
      .map(prestige => {
        const tier = teams.filter(team => team.prestigeBefore === prestige);
        const ratings = tier.map(team => team.rosterRating);
        const stars = tier.reduce<Record<number, number>>((counts, team) => {
          Object.entries(team.stars).forEach(([star, count]) => {
            counts[Number(star)] = (counts[Number(star)] ?? 0) + count;
          });
          return counts;
        }, {});
        return [
          prestige,
          {
            teams: tier.length,
            averageClassScore: round(mean(tier.map(team => team.classScore))),
            averagePublicRating: round(
              mean(tier.map(team => team.averagePublicRating)),
            ),
            averageRosterRating: round(mean(ratings)),
            rosterRatingP10: percentile(ratings, 0.1),
            rosterRatingP50: percentile(ratings, 0.5),
            rosterRatingP90: percentile(ratings, 0.9),
            stars,
            walkOns: tier.reduce((sum, team) => sum + team.walkOns, 0),
            cuts: tier.reduce((sum, team) => sum + team.cuts, 0),
          },
        ];
      }),
  );

interface EvaluateRunInput {
  league: LeagueState;
  players: PlayerRecord[];
  names: WeightedNameData;
  states: Record<string, number>;
  history: HistoryData;
  teamsData: TeamsData;
  prestigeConfig: PrestigeConfig;
  seed: number;
  seasons: number;
  startYear: number;
  recruitStarCounts?: RecruitStarCounts;
}

export const runRecruitingEvaluation = ({
  league: sourceLeague,
  players: sourcePlayers,
  names,
  states,
  history: sourceHistory,
  teamsData,
  prestigeConfig,
  seed,
  seasons,
  startYear,
  recruitStarCounts = RECRUIT_STAR_COUNTS,
}: EvaluateRunInput): RecruitingEvaluationRun => {
  const league = structuredClone(sourceLeague);
  const players = structuredClone(sourcePlayers);
  let history = structuredClone(sourceHistory);
  const initialPrestige = new Map(
    league.teams.map(team => [team.id, team.prestige]),
  );
  const seasonReports: RecruitingEvaluationSeason[] = [];
  let nextPlayerId = Math.max(
    league.idCounters.player,
    ...players.map(player => player.id + 1),
  );

  for (let offset = 0; offset < seasons; offset += 1) {
    const year = startYear + offset;
    league.info.currentYear = year;
    applyProgression(players);
    const yearSeed = createSeededRandom(seed)
      .fork(`recruiting-year:${year}`)
      .int(0, 0xffff_ffff);
    const context = buildRecruitingContext(league.teams, players);
    const initialState = {
      year,
      round: 1 as const,
      status: 'active' as const,
      seed: yearSeed,
      prospects: generateProspectPool({
        teams: league.teams,
        returningPlayers: players,
        names,
        states,
        year,
        seed: yearSeed,
        starCounts: recruitStarCounts,
      }),
      teams: createTeamRecruitingStates(league.teams, context),
    };
    const cycle = runAiRecruitingCycle(initialState, context);
    const committedProspectIds = cycle.commitments.map(
      commitment => commitment.prospectId,
    );
    if (
      new Set(committedProspectIds).size !== committedProspectIds.length
    ) {
      throw new Error('Evaluation produced a duplicate prospect commitment.');
    }
    cycle.state.teams.forEach(team => {
      if (team.commitmentIds.length > team.oversignCapacity) {
        throw new Error(
          `Team ${team.teamId} exceeded its signing capacity in evaluation.`,
        );
      }
    });
    const converted = buildCommittedFreshmen({
      prospects: cycle.state.prospects,
      existingPlayers: players,
      nextPlayerId,
    });
    if (converted.players.length !== committedProspectIds.length) {
      throw new Error(
        'Evaluation freshman conversion did not match the committed class.',
      );
    }
    players.push(...converted.players);
    nextPlayerId = converted.nextPlayerId;
    if (new Set(players.map(player => player.id)).size !== players.length) {
      throw new Error('Evaluation produced duplicate player IDs.');
    }
    if (
      nextPlayerId <=
      players.reduce((highest, player) => Math.max(highest, player.id), 0)
    ) {
      throw new Error('Evaluation player ID cursor did not advance.');
    }
    const classResults = buildRecruitingResults(
      league.teams,
      cycle.state.prospects,
      league.teams[0].id,
    );
    const classByTeam = new Map(
      classResults.teamRankings.map(result => [result.teamId, result]),
    );
    const prestigeBefore = new Map(
      league.teams.map(team => [team.id, team.prestige]),
    );
    const publicByTeam = new Map<number, number[]>();
    cycle.state.prospects.forEach(prospect => {
      if (prospect.committedTeamId === null) return;
      const values = publicByTeam.get(prospect.committedTeamId) ?? [];
      values.push((prospect.publicRatingMin + prospect.publicRatingMax) / 2);
      publicByTeam.set(prospect.committedTeamId, values);
    });

    const walkOns = generateWalkOns({
      teams: league.teams,
      players,
      names,
      year,
      seed: yearSeed,
      nextPlayerId,
    });
    players.push(...walkOns.players);
    nextPlayerId = walkOns.nextPlayerId;
    const cuts = league.teams.flatMap(team =>
      recommendRosterCuts({
        players,
        teamId: team.id,
        year,
        seed: yearSeed,
        selectedCutIds: [],
      }),
    );
    const arrivingFreshmen = new Set(
      [...converted.players, ...walkOns.players].map(player => player.id),
    );
    if (cuts.some(player => arrivingFreshmen.has(player.id))) {
      throw new Error('Evaluation attempted to cut an arriving freshman.');
    }
    applyRosterCutIds(
      players,
      cuts.map(player => player.id),
    );
    assertFinalRosters(league.teams, players);
    setStarters(league.teams, players);
    assertStarters(league, players);
    recalculateTeamRatings(
      league.teams,
      players,
      createSeededRandom(yearSeed)
        .fork(`roster-finalization:${year}`)
        .fork('team-ratings'),
    );

    calculatePrestigeChanges(league, history, teamsData, prestigeConfig);
    history = updateHistoryForSeason(league, history);
    applyPrestigeChanges(league);
    const prestigeAfter = new Map(
      league.teams.map(team => [team.id, team.prestige]),
    );
    const aiTeams = new Map(
      cycle.report.teams.map(team => [team.teamId, team]),
    );
    const teams: RecruitingEvaluationTeamYear[] = league.teams
      .map(team => {
        const recruiting = aiTeams.get(team.id)!;
        const classResult = classByTeam.get(team.id);
        const teamWalkOns = walkOns.players.filter(
          player => player.teamId === team.id,
        );
        const teamCuts = cuts.filter(player => player.teamId === team.id);
        return {
          teamId: team.id,
          teamName: team.name,
          prestigeBefore: prestigeBefore.get(team.id)!,
          prestigeAfter: prestigeAfter.get(team.id)!,
          classRank: classResult?.rank ?? league.teams.length + 1,
          classScore: classResult?.classScore ?? 0,
          classScoreExact: classResult
            ? round(calculateRecruitingClassScore(classResult.recruits))
            : 0,
          signed: recruiting.signings,
          baseCapacity: recruiting.baseCapacity,
          baseSignings: recruiting.baseSignings,
          oversignings: recruiting.oversignings,
          walkOns: teamWalkOns.length,
          cuts: teamCuts.length,
          averagePublicRating: round(mean(publicByTeam.get(team.id) ?? [])),
          stars: classResult
            ? {
                1: classResult.starCounts.one,
                2: classResult.starCounts.two,
                3: classResult.starCounts.three,
                4: classResult.starCounts.four,
                5: classResult.starCounts.five,
              }
            : ({} as Record<number, number>),
          rosterRating: team.rating,
        };
      })
      .sort((left, right) => left.teamId - right.teamId);

    const elite = cycle.state.prospects.filter(
      prospect => prospect.committedTeamId !== null && prospect.stars >= 4,
    );
    const ratingValues = teams.map(team => team.rosterRating);
    const totalBase = teams.reduce((sum, team) => sum + team.baseCapacity, 0);
    const totalBaseSignings = teams.reduce(
      (sum, team) => sum + team.baseSignings,
      0,
    );
    const totalCommitments = Object.values(
      cycle.report.commitmentsByRound,
    ).reduce((sum, count) => sum + count, 0);
    const seasonWithoutChecksum = {
      year,
      seed: yearSeed,
      commitmentsByRound: cycle.report.commitmentsByRound,
      signingDayShare:
        totalCommitments > 0
          ? cycle.report.commitmentsByRound.signing_day / totalCommitments
          : 0,
      averageBudgetUse: round(cycle.report.averageBudgetUse),
      targetsLost: cycle.report.targetsLost,
      targetsAdded: cycle.report.targetsAdded,
      targetsRemoved: cycle.report.targetsRemoved,
      meaningfulPursuits: cycle.report.meaningfulPursuits,
      meaningfullyPursuedProspects:
        cycle.report.meaningfullyPursuedProspects,
      contestedMeaningfulProspects:
        cycle.report.contestedMeaningfulProspects,
      meaningfulCompetitionRate: round(
        cycle.report.meaningfulCompetitionRate,
      ),
      pursuitsAdmitted: cycle.report.pursuitsAdmitted,
      fundableOpeningsUnfilled:
        cycle.report.fundableOpeningsUnfilled,
      baseCapacityCompletion: totalBase
        ? round(totalBaseSignings / totalBase)
        : 1,
      teamsCompletingBaseCapacity: teams.filter(
        team => team.baseSignings === team.baseCapacity,
      ).length,
      teamBaseCapacityCompletionRate: round(
        teams.filter(team => team.baseSignings === team.baseCapacity).length /
          Math.max(1, teams.length),
      ),
      oversignings: teams.reduce(
        (sum, team) => sum + team.oversignings,
        0,
      ),
      teamsUsingAllFourOversigns: teams.filter(
        team => team.oversignings === RECRUITING.oversignAllowance,
      ).length,
      lowPrestigeEliteWins: elite.filter(
        prospect =>
          (prestigeBefore.get(prospect.committedTeamId!) ?? 7) <= 3,
      ).length,
      lowPrestigeEliteShare: elite.length
        ? round(
            elite.filter(
              prospect =>
                (prestigeBefore.get(prospect.committedTeamId!) ?? 7) <= 3,
            ).length / elite.length,
          )
        : 0,
      prestigeClassScoreCorrelation: pearsonCorrelation(
        teams.map(team => team.prestigeBefore),
        teams.map(team => team.classScore),
      ),
      classScoreDistribution: buildClassScoreDistribution(
        teams.map(team => team.classScoreExact),
      ),
      classSizeDistribution: buildCountDistribution(
        teams.map(team => team.signed),
      ),
      supplyByStar: buildRecruitingSupplySummary(
        cycle.state.prospects,
        [2, 3, 4, 5],
        prospect => prospect.stars,
        prospect => prospect.committedTeamId !== null,
      ),
      supplyByPosition: buildRecruitingSupplySummary(
        cycle.state.prospects,
        POSITION_ORDER,
        prospect => prospect.position,
        prospect => prospect.committedTeamId !== null,
      ),
      top25ClassComposition: buildTop25ClassComposition(teams),
      walkOnsByPosition: countBy(walkOns.players, player => player.pos),
      walkOnsByPrestige: countBy(
        walkOns.players,
        player => String(prestigeBefore.get(player.teamId) ?? 0),
      ),
      cutsByPosition: countBy(cuts, player => player.pos),
      cutsByClass: countBy(cuts, player => player.year),
      averageCutRating: round(mean(cuts.map(player => player.rating))),
      averageCutSeniorRating: round(
        mean(cuts.map(player => player.rating_sr)),
      ),
      teamsOversigningWithoutCuts: teams.filter(
        team => team.oversignings > 0 && team.cuts === 0,
      ).length,
      ratingSpread:
        ratingValues.length
          ? Math.max(...ratingValues) - Math.min(...ratingValues)
          : 0,
      prestigePromotions: teams.filter(
        team => team.prestigeAfter > team.prestigeBefore,
      ).length,
      prestigeDemotions: teams.filter(
        team => team.prestigeAfter < team.prestigeBefore,
      ).length,
      prestigeUnchanged: teams.filter(
        team => team.prestigeAfter === team.prestigeBefore,
      ).length,
      structuralViolations: [] as string[],
      warnings: [
        ...(cycle.report.signingDayShare > 0.9
          ? ['SIGNING_DAY_CONCENTRATION']
          : []),
        ...(teams.every(
          team => team.oversignings === RECRUITING.oversignAllowance,
        )
          ? ['UNIVERSAL_MAX_OVERSIGNING']
          : []),
        ...(walkOns.players.length > league.teams.length
          ? ['EXCESSIVE_WALK_ON_DEPENDENCE']
          : []),
      ],
      prestigeSummaries: buildPrestigeSummaries(teams),
      teams,
    };
    seasonReports.push({
      ...seasonWithoutChecksum,
      checksum: evaluationChecksum(seasonWithoutChecksum),
    });
  }

  const endingRatings = league.teams
    .sort((left, right) => left.id - right.id)
    .map(team => team.rating);
  const initialPrestiges = league.teams
    .sort((left, right) => left.id - right.id)
    .map(team => initialPrestige.get(team.id) ?? team.prestige);
  const firstSpread = seasonReports[0]?.ratingSpread ?? 0;
  const lastSpread =
    seasonReports[seasonReports.length - 1]?.ratingSpread ?? 0;
  const structuralViolations = seasonReports.flatMap(
    season => season.structuralViolations,
  );
  const resultWithoutChecksum = {
    seed,
    startYear,
    endYear: startYear + seasons - 1,
    seasons: seasonReports,
    initialPrestigeEndingRatingCorrelation: pearsonCorrelation(
      initialPrestiges,
      endingRatings,
    ),
    ratingSpreadChange: lastSpread - firstSpread,
    prestigeMobility: seasonReports.reduce(
      (sum, season) =>
        sum + season.prestigePromotions + season.prestigeDemotions,
      0,
    ),
    structuralViolations,
  };
  return {
    ...resultWithoutChecksum,
    checksum: evaluationChecksum(resultWithoutChecksum),
  };
};

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
