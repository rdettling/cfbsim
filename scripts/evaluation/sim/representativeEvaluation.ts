import { checksumValues } from '../shared/checksum';
import { parsePositiveInteger } from '../shared/cli';
import {
  runSeasonCorpus,
  type SeasonCorpusData,
  type SeasonCorpusOptions,
} from '../shared/seasonCorpus';
import { loadSeasonCorpusData } from '../shared/seasonCorpusData';
import { groupCalibrationMeasurements } from './calibrationStages';
import {
  buildCalibrationSummary,
  createConceptTotals,
  createDefensiveMatchupTotals,
  createDefensiveTotals,
  createEqualTeamTotals,
  recordGameMetrics,
  summarizeEqualTeamDistributions,
  summarizeEqualTeams,
} from './evaluationMetrics';

export type RepresentativeBoxScoreOptions = {
  seed: number;
  seeds: number;
  seasons: number;
};

type CorpusRunner = typeof runSeasonCorpus;

const DEFAULT_OPTIONS: RepresentativeBoxScoreOptions = {
  seed: 20260809,
  seeds: 3,
  seasons: 1,
};

export const parseRepresentativeBoxScoreArguments = (
  arguments_: string[],
): RepresentativeBoxScoreOptions => {
  const options = { ...DEFAULT_OPTIONS };
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === '--seed') options.seed = parsePositiveInteger(name, value);
    else if (name === '--seeds') options.seeds = parsePositiveInteger(name, value);
    else if (name === '--seasons') options.seasons = parsePositiveInteger(name, value);
    else throw new Error(`Unknown representative box-score argument: ${name ?? '(missing)'}.`);
  }
  return options;
};

const createAccumulator = (rootSeed: number) => ({
  rootSeed,
  expectedRegularGames: 0,
  regularGames: 0,
  totals: createEqualTeamTotals(),
  concepts: createConceptTotals(),
  defenses: createDefensiveTotals(),
  matchups: createDefensiveMatchupTotals(),
});

const summarizeAccumulator = (accumulator: ReturnType<typeof createAccumulator>) => {
  const metrics = summarizeEqualTeams(accumulator.totals);
  const distributions = summarizeEqualTeamDistributions(accumulator.totals);
  const { calibration, gaps } = buildCalibrationSummary(metrics, distributions);
  return {
    rootSeed: accumulator.rootSeed,
    expectedRegularGames: accumulator.expectedRegularGames,
    regularGames: accumulator.regularGames,
    metrics,
    distributions,
    calibration,
    gaps,
  };
};

const recordRepresentativeGame = (
  accumulator: ReturnType<typeof createAccumulator>,
  game: { scoreA: number; scoreB: number; overtime: number },
  drives: Parameters<typeof recordGameMetrics>[5],
) => {
  recordGameMetrics(
    accumulator.totals,
    accumulator.concepts,
    accumulator.defenses,
    accumulator.matchups,
    game,
    drives,
  );
  for (const drive of drives) {
    const positions = [
      drive.record.startingFP,
      ...drive.plays.map(play => play.startingFP),
    ];
    for (const position of positions) {
      accumulator.totals.minimumFieldPosition = Math.min(
        accumulator.totals.minimumFieldPosition,
        position,
      );
      accumulator.totals.maximumFieldPosition = Math.max(
        accumulator.totals.maximumFieldPosition,
        position,
      );
      if (!Number.isFinite(position) || position < 1 || position > 99) {
        accumulator.totals.invalidFieldPositions += 1;
      }
    }
  }
};

export const evaluateRepresentativeBoxScores = (
  options: RepresentativeBoxScoreOptions,
  data: SeasonCorpusData = loadSeasonCorpusData(2026),
  runCorpus: CorpusRunner = runSeasonCorpus,
) => {
  const accumulators = new Map<number, ReturnType<typeof createAccumulator>>();
  const pooled = createAccumulator(-1);
  const structuralViolations: string[] = [];
  const corpusOptions: SeasonCorpusOptions = {
    ...options,
    startYear: 2026,
  };
  const getAccumulator = (rootSeed: number) => {
    const existing = accumulators.get(rootSeed);
    if (existing) return existing;
    const created = createAccumulator(rootSeed);
    accumulators.set(rootSeed, created);
    return created;
  };

  runCorpus(data, corpusOptions, {
    onPreseason: context => {
      const expectedGames = context.league.teams.length * 12 / 2;
      getAccumulator(context.rootSeed).expectedRegularGames += expectedGames;
      pooled.expectedRegularGames += expectedGames;
    },
    onGameComplete: context => {
      if (context.game.gameType !== 'regular_season') return;
      const { scoreA, scoreB } = context.game;
      if (scoreA === null || scoreB === null || scoreA === scoreB) {
        structuralViolations.push(
          `${context.rootSeed}: game ${context.game.id} is not a completed non-tied regular-season game.`,
        );
        return;
      }
      const drives = context.detail.drives.map(drive => ({
        record: drive,
        plays: drive.plays,
      }));
      const metricGame = { scoreA, scoreB, overtime: context.game.overtime };
      const block = getAccumulator(context.rootSeed);
      recordRepresentativeGame(block, metricGame, drives);
      recordRepresentativeGame(pooled, metricGame, drives);
      block.regularGames += 1;
      pooled.regularGames += 1;
    },
  });

  const blocks = [...accumulators.values()]
    .sort((left, right) => left.rootSeed - right.rootSeed)
    .map(summarizeAccumulator);
  for (const block of blocks) {
    if (block.regularGames !== block.expectedRegularGames) {
      structuralViolations.push(
        `${block.rootSeed}: measured ${block.regularGames} of ${block.expectedRegularGames} expected regular-season games.`,
      );
    }
    if (block.metrics.fieldPosition.invalidCount) {
      structuralViolations.push(
        `${block.rootSeed}: measured ${block.metrics.fieldPosition.invalidCount} invalid field positions.`,
      );
    }
  }
  if (blocks.length !== options.seeds) {
    structuralViolations.push(
      `Measured ${blocks.length} of ${options.seeds} expected deterministic seed blocks.`,
    );
  }
  const pooledSummary = summarizeAccumulator(pooled);
  const { rootSeed: _pooledRootSeed, ...pooledReport } = pooledSummary;
  const blockReports = blocks.map(({ calibration: _calibration, ...block }) => block);
  const resultWithoutChecksum = {
    configuration: {
      ...corpusOptions,
      rootSeeds: blocks.map(block => block.rootSeed),
    },
    pooled: {
      ...pooledReport,
      causalGroups: groupCalibrationMeasurements(
        pooledSummary.calibration.production,
        pooledSummary.calibration.scoreDistribution,
      ),
    },
    blocks: blockReports,
    structuralViolations: [...new Set(structuralViolations)].sort(),
    recommendation: structuralViolations.length
      ? 'Resolve structural violations before using this corpus for calibration.'
      : 'Use these mixed-matchup findings with equal-team and season audits; gaps remain diagnostic until a candidate passes existing acceptance checks.',
  };
  return {
    ...resultWithoutChecksum,
    checksum: checksumValues([resultWithoutChecksum]),
    exitCode: structuralViolations.length ? 1 : 0,
  };
};
