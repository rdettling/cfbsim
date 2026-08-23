import type { GameRecord } from '../../../src/types/db';
import type { Team } from '../../../src/types/domain';
import { SIM_CALIBRATION_BENCHMARK } from '../sim/calibrationBenchmark';
import { checksumValues } from '../shared/checksum';
import {
  runSeasonCorpus,
  type SeasonCorpusData,
} from '../shared/seasonCorpus';
import type { SeasonBalanceProfile } from './cli';
import type { SeasonBalanceHistoricalReference } from './historicalReference';

const START_YEAR = 2026;
const EXPECTED_REGULAR_GAMES_PER_TEAM = 12;

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const mean = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;
const populationStandardDeviation = (values: number[]) => {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
};
const percentile = (values: number[], probability: number) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, ordered.length - 1);
  const weight = position - lower;
  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
};

interface Week14Team {
  id: number;
  name: string;
  prestige: number;
  ranking: number;
  rating: number;
  wins: number;
  losses: number;
}

export interface SeasonBalanceSeasonArtifact {
  seed: number;
  year: number;
  teamCount: number;
  regularGameCount: number;
  minimumGamesPerTeam: number;
  maximumGamesPerTeam: number;
  undefeatedTeams: number;
  oneLossOrBetterTeams: number;
  top5AverageLosses: number;
  top10AverageLosses: number;
  top25AverageLosses: number;
  oddsImplied: {
    undefeatedTeams: number;
    oneLossOrBetterTeams: number;
  };
  prestige7: {
    teamCount: number;
    ratingMean: number;
    ratingStandardDeviation: number;
    lossesMean: number;
    lossesStandardDeviation: number;
    oneLossOrBetterTeams: number;
    oneLossOrBetterShare: number;
  };
  numberOne: { teamId: number; team: string; wins: number; losses: number };
  topRatedTeam: {
    teamId: number;
    team: string;
    rating: number;
    wins: number;
    losses: number;
    expectedLosses: number;
  };
  marginHistogram: Record<string, number>;
}

export interface SeasonBalanceMetrics {
  meanUndefeatedTeams: number;
  noUndefeatedSeasonShare: number;
  meanOneLossOrBetterTeams: number;
  top5AverageLosses: number;
  top10AverageLosses: number;
  top25AverageLosses: number;
  meanOddsImpliedUndefeatedTeams: number;
  meanOddsImpliedOneLossOrBetterTeams: number;
  meanPrestige7Rating: number;
  meanPrestige7RatingStandardDeviation: number;
  meanPrestige7Losses: number;
  meanPrestige7LossStandardDeviation: number;
  meanPrestige7OneLossOrBetterTeams: number;
  meanPrestige7OneLossOrBetterShare: number;
  meanNumberOneLosses: number;
  meanTopRatedTeamLosses: number;
  meanTopRatedExpectedLosses: number;
  marginMean: number;
  marginStandardDeviation: number;
  marginP25: number;
  marginP50: number;
  marginP75: number;
  marginP90: number;
}

export interface SeasonBalanceTarget {
  metric: keyof SeasonBalanceMetrics;
  minimum?: number;
  maximum?: number;
  kind: 'elite_balance' | 'ranked_record_diagnostic' | 'national_margin_guardrail';
  rationale: string;
}

export interface SeasonBalanceGap {
  metric: keyof SeasonBalanceMetrics;
  observed: number;
  target: { minimum?: number; maximum?: number };
  kind: SeasonBalanceTarget['kind'];
  evidence: string;
}

export interface SeasonBalanceReplay {
  seed: number;
  expected: string;
  actual: string;
  matches: boolean;
}

export type SeasonBalanceStatus =
  | 'invalid'
  | 'needs_tuning'
  | 'ready_for_acceptance'
  | 'pass';

export interface SeasonBalanceSummary {
  contractVersion: 3;
  profile: SeasonBalanceProfile;
  representativeSample: boolean;
  seasons: number;
  checksum: string;
  status: SeasonBalanceStatus;
  exitCode: 0 | 1 | 2;
  structuralViolations: string[];
  replayChecks: SeasonBalanceReplay[];
  metrics: SeasonBalanceMetrics;
  numberOneLossDistribution: Record<string, number>;
  targets: SeasonBalanceTarget[];
  gaps: SeasonBalanceGap[];
  diagnosticGaps: SeasonBalanceGap[];
  diagnostics: {
    strongestTeamExpectedLossRange: { minimum: 1; maximum: 1.5 };
  };
  historicalReference: SeasonBalanceHistoricalReference;
  nextCommand: string;
}

const marginTarget = (
  metric: 'marginMean' | 'marginStandardDeviation' | 'marginP25' | 'marginP50' | 'marginP75' | 'marginP90',
): SeasonBalanceTarget => {
  const target = SIM_CALIBRATION_BENCHMARK.targets.scoreDistribution[metric];
  const delta = target.tolerance.kind === 'relative'
    ? target.value * target.tolerance.value
    : target.tolerance.value;
  return {
    metric,
    minimum: round(target.value - delta),
    maximum: round(target.value + delta),
    kind: 'national_margin_guardrail',
    rationale: 'Representative season margins must retain the frozen modern-FBS calibration band.',
  };
};

export const SEASON_BALANCE_TARGETS: SeasonBalanceTarget[] = [
  {
    metric: 'meanUndefeatedTeams',
    minimum: 0.9,
    maximum: 1.6,
    kind: 'elite_balance',
    rationale: 'Twelve-FBS-game seasons should usually retain at least one undefeated contender without matching the easier real schedule exactly.',
  },
  {
    metric: 'noUndefeatedSeasonShare',
    maximum: 0.35,
    kind: 'elite_balance',
    rationale: 'A season with no undefeated team should be possible but not typical.',
  },
  {
    metric: 'meanOneLossOrBetterTeams',
    minimum: 5,
    maximum: 6.5,
    kind: 'elite_balance',
    rationale: 'The national field should retain a realistic upper tier after twelve FBS games.',
  },
  {
    metric: 'top5AverageLosses',
    minimum: 1.1,
    maximum: 1.45,
    kind: 'ranked_record_diagnostic',
    rationale: 'Top-five records remain prominent without making the independent ranking order a tuning control.',
  },
  {
    metric: 'top10AverageLosses',
    minimum: 1.6,
    maximum: 1.9,
    kind: 'ranked_record_diagnostic',
    rationale: 'Top-ten records remain visible without making the independent ranking order a tuning control.',
  },
  {
    metric: 'top25AverageLosses',
    minimum: 2.4,
    maximum: 2.7,
    kind: 'ranked_record_diagnostic',
    rationale: 'Top-25 records remain visible without making the independent ranking order a tuning control.',
  },
  marginTarget('marginMean'),
  marginTarget('marginStandardDeviation'),
  marginTarget('marginP25'),
  marginTarget('marginP50'),
  marginTarget('marginP75'),
  marginTarget('marginP90'),
];

const snapshotTeam = (team: Team): Week14Team => ({
  id: team.id,
  name: team.name,
  prestige: team.prestige,
  ranking: team.ranking,
  rating: team.rating,
  wins: team.totalWins,
  losses: team.totalLosses,
});

const expectedLosses = (teamId: number, games: GameRecord[]) => games.reduce(
  (total, game) => {
    if (game.teamAId === teamId) return total + (1 - game.winProbA);
    if (game.teamBId === teamId) return total + (1 - game.winProbB);
    return total;
  },
  0,
);

const averageLosses = (teams: Week14Team[], count: number) =>
  mean(teams.slice(0, count).map(team => team.losses));

export const calculateRecordProbabilities = (winProbabilities: number[]) => {
  const undefeated = winProbabilities.reduce((product, probability) =>
    product * probability, 1);
  const exactlyOneLoss = winProbabilities.reduce((total, probability, index) =>
    total + (1 - probability) * winProbabilities.reduce(
      (product, other, otherIndex) =>
        product * (otherIndex === index ? 1 : other),
      1,
    ), 0);
  return { undefeated, oneLossOrBetter: undefeated + exactlyOneLoss };
};

const recordProbabilities = (teamId: number, games: GameRecord[]) =>
  calculateRecordProbabilities(games.flatMap(game => {
    if (game.teamAId === teamId) return [game.winProbA];
    if (game.teamBId === teamId) return [game.winProbB];
    return [];
  }));

export const collectSeasonBalanceArtifact = (
  data: SeasonCorpusData,
  seed: number,
): { artifact: SeasonBalanceSeasonArtifact; violations: string[] } => {
  let preseasonTeams: Week14Team[] | null = null;
  let scheduledGames: GameRecord[] | null = null;
  let week14Teams: Week14Team[] | null = null;
  let completedGames: GameRecord[] | null = null;
  runSeasonCorpus(data, { seed, seeds: 1, seasons: 1, startYear: START_YEAR }, {
    onPreseason: context => {
      preseasonTeams = context.league.teams.map(snapshotTeam);
      scheduledGames = context.games.map(game => ({ ...game }));
    },
    onRankingsUpdated: context => {
      if (context.league.info.currentWeek === 14) {
        week14Teams = context.league.teams.map(snapshotTeam);
      }
    },
    onSeasonComplete: context => {
      completedGames = context.games
        .filter(game => game.gameType === 'regular_season')
        .map(game => ({ ...game }));
    },
  });
  if (!preseasonTeams || !scheduledGames || !week14Teams || !completedGames) {
    throw new Error(`Season-balance seed ${seed} did not produce complete Week 14 artifacts.`);
  }

  const preseason = preseasonTeams as Week14Team[];
  const schedule = scheduledGames as GameRecord[];
  const ranked = [...(week14Teams as Week14Team[])]
    .sort((left, right) => left.ranking - right.ranking);
  const regular = completedGames as GameRecord[];
  const violations: string[] = [];
  const rankingValues = ranked.map(team => team.ranking);
  if (
    new Set(rankingValues).size !== ranked.length ||
    rankingValues.some((ranking, index) => ranking !== index + 1)
  ) violations.push(`${seed}: Week 14 rankings are not a complete unique ordering.`);
  if (regular.length * 2 !== ranked.length * EXPECTED_REGULAR_GAMES_PER_TEAM) {
    violations.push(`${seed}: regular-season game count does not provide twelve games per team.`);
  }

  const gamesByTeam = new Map(ranked.map(team => [team.id, 0]));
  const margins: number[] = [];
  regular.forEach(game => {
    gamesByTeam.set(game.teamAId, (gamesByTeam.get(game.teamAId) ?? 0) + 1);
    gamesByTeam.set(game.teamBId, (gamesByTeam.get(game.teamBId) ?? 0) + 1);
    if (
      game.winnerId === null ||
      game.scoreA === null ||
      game.scoreB === null ||
      game.scoreA === game.scoreB
    ) {
      violations.push(`${seed}: game ${game.id} is not a completed non-tied regular-season game.`);
      return;
    }
    margins.push(Math.abs(game.scoreA - game.scoreB));
  });
  const gameCounts = [...gamesByTeam.values()];
  if (gameCounts.some(count => count !== EXPECTED_REGULAR_GAMES_PER_TEAM)) {
    violations.push(`${seed}: at least one team does not have twelve completed regular-season games.`);
  }
  if (ranked.length < 25) violations.push(`${seed}: fewer than 25 teams are available for ranked cohorts.`);

  const strongest = [...preseason]
    .sort((left, right) => right.rating - left.rating || left.ranking - right.ranking)[0];
  const strongestAtWeek14 = ranked.find(team => team.id === strongest?.id);
  if (!strongest || !strongestAtWeek14) {
    throw new Error(`Season-balance seed ${seed} cannot identify its strongest preseason team.`);
  }
  const numberOne = ranked[0];
  if (!numberOne) throw new Error(`Season-balance seed ${seed} has no Week 14 No. 1 team.`);
  const prestige7Preseason = preseason.filter(team => team.prestige === 7);
  const prestige7 = ranked.filter(team => team.prestige === 7);
  if (!prestige7Preseason.length || prestige7Preseason.length !== prestige7.length) {
    violations.push(`${seed}: Prestige 7 cohort is missing or changes during the season.`);
  }
  const impliedRecords = preseason.map(team => recordProbabilities(team.id, schedule));
  const marginHistogram = Object.fromEntries(
    [...new Set(margins)].sort((left, right) => left - right).map(margin => [
      String(margin),
      margins.filter(value => value === margin).length,
    ]),
  );
  return {
    artifact: {
      seed,
      year: START_YEAR,
      teamCount: ranked.length,
      regularGameCount: regular.length,
      minimumGamesPerTeam: Math.min(...gameCounts),
      maximumGamesPerTeam: Math.max(...gameCounts),
      undefeatedTeams: ranked.filter(team => team.losses === 0).length,
      oneLossOrBetterTeams: ranked.filter(team => team.losses <= 1).length,
      top5AverageLosses: round(averageLosses(ranked, 5)),
      top10AverageLosses: round(averageLosses(ranked, 10)),
      top25AverageLosses: round(averageLosses(ranked, 25)),
      oddsImplied: {
        undefeatedTeams: round(impliedRecords.reduce(
          (sum, record) => sum + record.undefeated,
          0,
        )),
        oneLossOrBetterTeams: round(impliedRecords.reduce(
          (sum, record) => sum + record.oneLossOrBetter,
          0,
        )),
      },
      prestige7: {
        teamCount: prestige7.length,
        ratingMean: round(mean(prestige7Preseason.map(team => team.rating))),
        ratingStandardDeviation: round(populationStandardDeviation(
          prestige7Preseason.map(team => team.rating),
        )),
        lossesMean: round(mean(prestige7.map(team => team.losses))),
        lossesStandardDeviation: round(populationStandardDeviation(
          prestige7.map(team => team.losses),
        )),
        oneLossOrBetterTeams: prestige7.filter(team => team.losses <= 1).length,
        oneLossOrBetterShare: round(mean(
          prestige7.map(team => team.losses <= 1 ? 1 : 0),
        )),
      },
      numberOne: {
        teamId: numberOne.id,
        team: numberOne.name,
        wins: numberOne.wins,
        losses: numberOne.losses,
      },
      topRatedTeam: {
        teamId: strongest.id,
        team: strongest.name,
        rating: strongest.rating,
        wins: strongestAtWeek14.wins,
        losses: strongestAtWeek14.losses,
        expectedLosses: round(expectedLosses(strongest.id, schedule)),
      },
      marginHistogram,
    },
    violations: [...new Set(violations)],
  };
};

const expandMargins = (artifact: SeasonBalanceSeasonArtifact) =>
  Object.entries(artifact.marginHistogram).flatMap(([margin, count]) =>
    Array.from({ length: count }, () => Number(margin)));

export const calculateSeasonBalanceMetrics = (
  seasons: SeasonBalanceSeasonArtifact[],
): SeasonBalanceMetrics => {
  const margins = seasons.flatMap(expandMargins);
  return {
    meanUndefeatedTeams: round(mean(seasons.map(season => season.undefeatedTeams))),
    noUndefeatedSeasonShare: round(mean(seasons.map(season => season.undefeatedTeams === 0 ? 1 : 0))),
    meanOneLossOrBetterTeams: round(mean(seasons.map(season => season.oneLossOrBetterTeams))),
    top5AverageLosses: round(mean(seasons.map(season => season.top5AverageLosses))),
    top10AverageLosses: round(mean(seasons.map(season => season.top10AverageLosses))),
    top25AverageLosses: round(mean(seasons.map(season => season.top25AverageLosses))),
    meanOddsImpliedUndefeatedTeams: round(mean(
      seasons.map(season => season.oddsImplied.undefeatedTeams),
    )),
    meanOddsImpliedOneLossOrBetterTeams: round(mean(
      seasons.map(season => season.oddsImplied.oneLossOrBetterTeams),
    )),
    meanPrestige7Rating: round(mean(
      seasons.map(season => season.prestige7.ratingMean),
    )),
    meanPrestige7RatingStandardDeviation: round(mean(
      seasons.map(season => season.prestige7.ratingStandardDeviation),
    )),
    meanPrestige7Losses: round(mean(
      seasons.map(season => season.prestige7.lossesMean),
    )),
    meanPrestige7LossStandardDeviation: round(mean(
      seasons.map(season => season.prestige7.lossesStandardDeviation),
    )),
    meanPrestige7OneLossOrBetterTeams: round(mean(
      seasons.map(season => season.prestige7.oneLossOrBetterTeams),
    )),
    meanPrestige7OneLossOrBetterShare: round(mean(
      seasons.map(season => season.prestige7.oneLossOrBetterShare),
    )),
    meanNumberOneLosses: round(mean(seasons.map(season => season.numberOne.losses))),
    meanTopRatedTeamLosses: round(mean(seasons.map(season => season.topRatedTeam.losses))),
    meanTopRatedExpectedLosses: round(mean(seasons.map(season => season.topRatedTeam.expectedLosses))),
    marginMean: round(mean(margins)),
    marginStandardDeviation: round(populationStandardDeviation(margins)),
    marginP25: round(percentile(margins, 0.25)),
    marginP50: round(percentile(margins, 0.5)),
    marginP75: round(percentile(margins, 0.75)),
    marginP90: round(percentile(margins, 0.9)),
  };
};

const buildTargetGaps = (
  metrics: SeasonBalanceMetrics,
  targets: SeasonBalanceTarget[],
): SeasonBalanceGap[] => targets.flatMap(target => {
  const observed = metrics[target.metric];
  const below = target.minimum !== undefined && observed < target.minimum;
  const above = target.maximum !== undefined && observed > target.maximum;
  if (!below && !above) return [];
  return [{
    metric: target.metric,
    observed,
    target: { minimum: target.minimum, maximum: target.maximum },
    kind: target.kind,
    evidence: `${target.metric}=${observed}; expected ${target.minimum ?? '-∞'}–${target.maximum ?? '∞'}.`,
  }];
});

export const buildSeasonBalanceGaps = (
  metrics: SeasonBalanceMetrics,
  targets = SEASON_BALANCE_TARGETS,
): SeasonBalanceGap[] => buildTargetGaps(
  metrics,
  targets.filter(target => target.kind !== 'ranked_record_diagnostic'),
);

export const buildSeasonBalanceDiagnosticGaps = (
  metrics: SeasonBalanceMetrics,
  targets = SEASON_BALANCE_TARGETS,
): SeasonBalanceGap[] => buildTargetGaps(
  metrics,
  targets.filter(target => target.kind === 'ranked_record_diagnostic'),
);

export const seasonBalanceExitCode = (
  profile: SeasonBalanceProfile,
  structuralViolations: readonly unknown[],
  replayChecks: readonly SeasonBalanceReplay[],
  gaps: readonly unknown[],
): 0 | 1 | 2 => structuralViolations.length || replayChecks.some(check => !check.matches)
  ? 1
  : profile === 'acceptance' && gaps.length ? 2 : 0;

export const seasonBalanceStatus = (
  profile: SeasonBalanceProfile,
  exitCode: 0 | 1 | 2,
  gaps: readonly unknown[],
): SeasonBalanceStatus => exitCode === 1 ? 'invalid'
  : gaps.length ? 'needs_tuning'
    : profile === 'acceptance' ? 'pass' : 'ready_for_acceptance';

export const evaluateSeasonBalance = ({
  artifacts,
  historicalReference,
  profile,
  replayChecks,
  structuralViolations,
}: {
  artifacts: SeasonBalanceSeasonArtifact[];
  historicalReference: SeasonBalanceHistoricalReference;
  profile: SeasonBalanceProfile;
  replayChecks: SeasonBalanceReplay[];
  structuralViolations: string[];
}): SeasonBalanceSummary => {
  const metrics = calculateSeasonBalanceMetrics(artifacts);
  const gaps = buildSeasonBalanceGaps(metrics);
  const diagnosticGaps = buildSeasonBalanceDiagnosticGaps(metrics);
  const exitCode = seasonBalanceExitCode(
    profile,
    structuralViolations,
    replayChecks,
    gaps,
  );
  const status = seasonBalanceStatus(profile, exitCode, gaps);
  const numberOneLossDistribution = Object.fromEntries(
    [...new Set(artifacts.map(artifact => artifact.numberOne.losses))]
      .sort((left, right) => left - right)
      .map(losses => [
        String(losses),
        artifacts.filter(artifact => artifact.numberOne.losses === losses).length,
      ]),
  );
  const nextCommand = status === 'invalid'
    ? 'npm run eval:season-balance -- --profile smoke'
    : 'npm run eval:season-balance -- --profile acceptance';
  return {
    contractVersion: 3,
    profile,
    representativeSample: profile === 'acceptance' && artifacts.length >= 40,
    seasons: artifacts.length,
    checksum: checksumValues(artifacts),
    status,
    exitCode,
    structuralViolations: [...new Set(structuralViolations)],
    replayChecks,
    metrics,
    numberOneLossDistribution,
    targets: SEASON_BALANCE_TARGETS,
    gaps,
    diagnosticGaps,
    diagnostics: {
      strongestTeamExpectedLossRange: { minimum: 1, maximum: 1.5 },
    },
    historicalReference,
    nextCommand,
  };
};

export const artifactChecksum = (artifact: SeasonBalanceSeasonArtifact) =>
  checksumValues([artifact]);
