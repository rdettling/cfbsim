import rawBenchmark from './calibration_benchmark.json';
import { checksumValues } from '../utils/checksum';

export const CALIBRATION_BENCHMARK_SEASONS = [2023, 2024, 2025] as const;

export type CalibrationTolerance = {
  kind: 'relative' | 'absolute';
  value: number;
};

export type CalibrationTarget = {
  value: number;
  tolerance: CalibrationTolerance;
};

export type CalibrationBenchmark = {
  schemaVersion: 3;
  seasons: number[];
  sources: {
    teamStatistics: string;
    individualFieldGoals: string;
    scoreboard: string;
  };
  sampleCounts: {
    teamGames: number;
    fbsVsFbsGames: number;
    qualifiedKickerRows: number;
    qualifiedFieldGoalsMade: number;
    qualifiedFieldGoalsAttempted: number;
    qualifiedFieldGoalCoverage: number;
    bySeason: Record<string, {
      teams: number;
      teamGames: number;
      fbsVsFbsGames: number;
      qualifiedKickerRows: number;
      qualifiedFieldGoalsMade: number;
      qualifiedFieldGoalsAttempted: number;
      qualifiedFieldGoalMakeRate: number;
      qualifiedFieldGoalCoverage: number;
      thirdDownAttemptsPerGame: number;
      fourthDownAttemptsPerGame: number;
    }>;
  };
  sourceChecksum: string;
  targets: {
    production: Record<string, CalibrationTarget>;
    scoreDistribution: Record<string, CalibrationTarget>;
  };
};

export type ParsedStatisticsTable = {
  headers: string[];
  rows: Record<string, string>[];
};

export type BenchmarkContest = {
  contestId: number;
  season: number;
  gameState: string;
  teams: Array<{
    seoname: string;
    score: number;
  }>;
};

export type BenchmarkSeasonInput = {
  season: number;
  teamRows: Record<string, Record<string, string>[]>;
  qualifiedKickerRows: Record<string, string>[];
  fbsTeamSlugs: Set<string>;
  contests: BenchmarkContest[];
};

export const parseCalibrationBenchmarkArguments = (arguments_: string[]) => {
  if (!arguments_.length) return { check: false };
  if (arguments_.length === 1 && arguments_[0] === '--check') return { check: true };
  throw new Error(`Unknown simulation benchmark argument: ${arguments_[0]}.`);
};

const decodeHtml = (value: string) => value
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .split('&amp;').join('&')
  .split('&quot;').join('"')
  .split('&#039;').join("'")
  .split('&nbsp;').join(' ');

const textContent = (value: string) => decodeHtml(value.replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

export const parseStatisticsTable = (document: string): ParsedStatisticsTable => {
  const table = document.match(
    /<table[^>]*class="[^"]*stats-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) throw new Error('NCAA statistics response is missing the statistics table.');
  const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map(match => textContent(match[1]));
  if (!headers.length || new Set(headers).size !== headers.length) {
    throw new Error('NCAA statistics table has missing or duplicate headers.');
  }
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(match => [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(cell => textContent(cell[1])))
    .filter(cells => cells.length)
    .map(cells => {
      if (cells.length !== headers.length) {
        throw new Error('NCAA statistics row does not match its table headers.');
      }
      return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    });
  if (!rows.length) throw new Error('NCAA statistics table contains no rows.');
  return { headers, rows };
};

export const parseSchoolSlugs = (document: string) => {
  const table = document.match(
    /<table[^>]*class="[^"]*stats-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) throw new Error('NCAA statistics response is missing the statistics table.');
  return [...table.matchAll(/href="\/schools\/([^"]+)"/gi)].map(match => match[1]);
};

const numeric = (row: Record<string, string>, key: string) => {
  const value = Number(row[key]?.split(',').join('').split('%').join(''));
  if (!Number.isFinite(value)) throw new Error(`NCAA statistic ${key} is not finite.`);
  return value;
};

const sum = (rows: Record<string, string>[], key: string) =>
  rows.reduce((total, row) => total + numeric(row, key), 0);

const round = (value: number, digits: number) => Number(value.toFixed(digits));

export const percentile = (values: readonly number[], probability: number) => {
  if (!values.length) return 0;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Percentile probability must be from zero through one.');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, sorted.length - 1);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

export const populationStandardDeviation = (values: readonly number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0)
    / values.length;
  return Math.sqrt(variance);
};

const relative = (value: number): CalibrationTolerance => ({ kind: 'relative', value });
const absolute = (value: number): CalibrationTolerance => ({ kind: 'absolute', value });
const target = (value: number, tolerance: CalibrationTolerance): CalibrationTarget => ({
  value,
  tolerance,
});

const STATISTIC_COLUMNS: Record<string, string[]> = {
  totalOffense: ['Team', 'G', 'Plays', 'YDS', 'Yds/Play', 'Off TDs', 'YPG'],
  scoringOffense: ['Team', 'G', 'TDs', 'PAT', '2PT', 'Def Pts', 'FG', 'Saf', 'Pts', 'PPG'],
  passingOffense: ['Team', 'G', 'Pass Att', 'Pass Com', 'Int', 'Pass Yds', 'Yds/Att', 'Yds/Comp', 'Pass TD', 'YPG'],
  rushingOffense: ['Team', 'G', 'Rush', 'Rush Yds', 'Yds/Rush', 'Rush TD', 'YPG'],
  sacksAllowed: ['Team', 'G', 'Opp Sacks', 'Opp Sack Yds', 'Avg'],
  turnoversLost: ['Team', 'G', 'Fum Lost', 'Int', 'Turn Lost'],
  netPunting: ['Team', 'G', 'Punt Yds', 'Opp Punt Ret Yds', 'Punts', 'TB', 'Net Yds'],
  thirdDown: ['Team', 'G', '3rd Att', '3rd Conv', 'Pct'],
  fourthDown: ['Team', 'G', '4th Conv', '4th Att', 'Pct'],
  redZone: ['Team', 'G', 'RZAtt', 'RZ Rush TD', 'RZ Pass TD', 'RZ FG Made', 'RZScores', 'Pct'],
};

const QUALIFIED_KICKER_COLUMNS = [
  'Name',
  'Team',
  'G',
  'FG',
  'FGA',
  'Pct',
  'FG PG',
] as const;

const validateColumns = (
  statistic: string,
  rows: Record<string, string>[],
) => {
  const expected = STATISTIC_COLUMNS[statistic];
  if (!expected) throw new Error(`Unknown benchmark statistic: ${statistic}.`);
  if (!rows.length) throw new Error(`Benchmark statistic ${statistic} has no rows.`);
  const keys = Object.keys(rows[0]);
  for (const column of expected) {
    if (!keys.includes(column)) {
      throw new Error(`Benchmark statistic ${statistic} is missing ${column}.`);
    }
  }
};

const finishedFbsContests = (input: BenchmarkSeasonInput) => {
  const unique = new Map<number, BenchmarkContest>();
  for (const contest of input.contests) {
    if (contest.season !== input.season || contest.gameState !== 'F') continue;
    if (contest.teams.length !== 2) continue;
    if (!contest.teams.every(team => (
      input.fbsTeamSlugs.has(team.seoname) && Number.isFinite(team.score) && team.score >= 0
    ))) continue;
    unique.set(contest.contestId, contest);
  }
  return [...unique.values()].sort((left, right) => left.contestId - right.contestId);
};

export const buildCalibrationBenchmark = (
  inputs: BenchmarkSeasonInput[],
): CalibrationBenchmark => {
  const ordered = [...inputs].sort((left, right) => left.season - right.season);
  if (ordered.map(input => input.season).join(',') !== CALIBRATION_BENCHMARK_SEASONS.join(',')) {
    throw new Error('Calibration benchmark must contain exactly the 2023, 2024, and 2025 seasons.');
  }
  const sourceRows: unknown[] = [];
  const allContests: BenchmarkContest[] = [];
  const bySeason: CalibrationBenchmark['sampleCounts']['bySeason'] = {};
  const pooled: Record<string, Record<string, string>[]> = Object.fromEntries(
    Object.keys(STATISTIC_COLUMNS).map(key => [key, []]),
  );

  for (const input of ordered) {
    for (const statistic of Object.keys(STATISTIC_COLUMNS)) {
      const rows = input.teamRows[statistic];
      validateColumns(statistic, rows ?? []);
      pooled[statistic].push(...rows);
      rows.forEach(row => sourceRows.push({ season: input.season, statistic, row }));
    }
    if (!input.qualifiedKickerRows.length) {
      throw new Error(`Season ${input.season} has no qualified kicker rows.`);
    }
    for (const column of QUALIFIED_KICKER_COLUMNS) {
      if (!(column in input.qualifiedKickerRows[0])) {
        throw new Error(`Season ${input.season} qualified kickers are missing ${column}.`);
      }
    }
    const qualifiedFieldGoalsMade = sum(input.qualifiedKickerRows, 'FG');
    const qualifiedFieldGoalsAttempted = sum(input.qualifiedKickerRows, 'FGA');
    if (qualifiedFieldGoalsAttempted <= 0
      || qualifiedFieldGoalsMade < 0
      || qualifiedFieldGoalsMade > qualifiedFieldGoalsAttempted) {
      throw new Error(`Season ${input.season} qualified kicker totals are malformed.`);
    }
    input.qualifiedKickerRows.forEach(row => sourceRows.push({
      season: input.season,
      statistic: 'qualifiedFieldGoals',
      row,
    }));
    const contests = finishedFbsContests(input);
    const teams = input.teamRows.totalOffense.length;
    const teamGames = sum(input.teamRows.totalOffense, 'G');
    const teamFieldGoalsMade = sum(input.teamRows.scoringOffense, 'FG');
    const thirdDownAttempts = sum(input.teamRows.thirdDown, '3rd Att');
    const fourthDownAttempts = sum(input.teamRows.fourthDown, '4th Att');
    if (teams < 130 || contests.length < 700) {
      throw new Error(`Season ${input.season} does not meet benchmark sample minimums.`);
    }
    bySeason[String(input.season)] = {
      teams,
      teamGames,
      fbsVsFbsGames: contests.length,
      qualifiedKickerRows: input.qualifiedKickerRows.length,
      qualifiedFieldGoalsMade,
      qualifiedFieldGoalsAttempted,
      qualifiedFieldGoalMakeRate: round(
        qualifiedFieldGoalsMade / qualifiedFieldGoalsAttempted,
        4,
      ),
      qualifiedFieldGoalCoverage: round(qualifiedFieldGoalsMade / teamFieldGoalsMade, 4),
      thirdDownAttemptsPerGame: round(2 * thirdDownAttempts / teamGames, 3),
      fourthDownAttemptsPerGame: round(2 * fourthDownAttempts / teamGames, 3),
    };
    allContests.push(...contests);
    contests.forEach(contest => sourceRows.push({
      season: input.season,
      contestId: contest.contestId,
      teams: contest.teams.map(team => ({ seoname: team.seoname, score: team.score })),
    }));
  }

  const teamGames = sum(pooled.totalOffense, 'G');
  const plays = sum(pooled.totalOffense, 'Plays');
  const yards = sum(pooled.totalOffense, 'YDS');
  const touchdowns = sum(pooled.totalOffense, 'Off TDs');
  const passAttempts = sum(pooled.passingOffense, 'Pass Att');
  const completions = sum(pooled.passingOffense, 'Pass Com');
  const passingYards = sum(pooled.passingOffense, 'Pass Yds');
  const interceptions = sum(pooled.passingOffense, 'Int');
  const rushes = sum(pooled.rushingOffense, 'Rush');
  const rushingYards = sum(pooled.rushingOffense, 'Rush Yds');
  const sacks = sum(pooled.sacksAllowed, 'Opp Sacks');
  const fumblesLost = sum(pooled.turnoversLost, 'Fum Lost');
  const turnovers = sum(pooled.turnoversLost, 'Turn Lost');
  const punts = sum(pooled.netPunting, 'Punts');
  const madeFieldGoals = sum(pooled.scoringOffense, 'FG');
  const qualifiedKickerRows = ordered.flatMap(input => input.qualifiedKickerRows);
  const qualifiedFieldGoalsMade = sum(qualifiedKickerRows, 'FG');
  const qualifiedFieldGoalsAttempted = sum(qualifiedKickerRows, 'FGA');
  const thirdAttempts = sum(pooled.thirdDown, '3rd Att');
  const thirdConversions = sum(pooled.thirdDown, '3rd Conv');
  const fourthAttempts = sum(pooled.fourthDown, '4th Att');
  const fourthConversions = sum(pooled.fourthDown, '4th Conv');
  const redZoneAttempts = sum(pooled.redZone, 'RZAtt');
  const redZoneScores = sum(pooled.redZone, 'RZScores');
  const redZoneTouchdowns = sum(pooled.redZone, 'RZ Rush TD')
    + sum(pooled.redZone, 'RZ Pass TD');
  const combinedScores = allContests.map(contest => (
    contest.teams[0].score + contest.teams[1].score
  ));
  const margins = allContests.map(contest => (
    Math.abs(contest.teams[0].score - contest.teams[1].score)
  ));
  const share = (values: readonly number[], predicate: (value: number) => boolean) =>
    values.filter(predicate).length / values.length;
  const shutoutShare = allContests.filter(contest => (
    Math.min(contest.teams[0].score, contest.teams[1].score) === 0
  )).length / allContests.length;

  return {
    schemaVersion: 3,
    seasons: [...CALIBRATION_BENCHMARK_SEASONS],
    sources: {
      teamStatistics: 'https://www.ncaa.com/stats/football/fbs/{season}/team/{statistic}',
      individualFieldGoals: 'https://www.ncaa.com/stats/football/fbs/{season}/individual/18',
      scoreboard: 'https://www.ncaa.com/scoreboard/football/fbs/{season}',
    },
    sampleCounts: {
      teamGames,
      fbsVsFbsGames: allContests.length,
      qualifiedKickerRows: qualifiedKickerRows.length,
      qualifiedFieldGoalsMade,
      qualifiedFieldGoalsAttempted,
      qualifiedFieldGoalCoverage: round(qualifiedFieldGoalsMade / madeFieldGoals, 4),
      bySeason,
    },
    sourceChecksum: checksumValues(sourceRows),
    targets: {
      production: {
        scrimmagePlaysPerGame: target(round(2 * plays / teamGames, 3), relative(0.05)),
        offensiveYardsPerGame: target(round(2 * yards / teamGames, 3), relative(0.05)),
        yardsPerPlay: target(round(yards / plays, 3), relative(0.05)),
        touchdownsPerGame: target(round(2 * touchdowns / teamGames, 3), relative(0.05)),
        puntsPerGame: target(round(2 * punts / teamGames, 3), relative(0.10)),
        madeFieldGoalsPerGame: target(round(2 * madeFieldGoals / teamGames, 3), relative(0.10)),
        fieldGoalMakeRate: target(
          round(qualifiedFieldGoalsMade / qualifiedFieldGoalsAttempted, 4),
          absolute(0.03),
        ),
        turnoversPerGame: target(round(2 * turnovers / teamGames, 3), relative(0.10)),
        fumblesLostPerGame: target(round(2 * fumblesLost / teamGames, 3), relative(0.10)),
        passPlayShare: target(round((passAttempts + sacks) / plays, 4), absolute(0.02)),
        completionRate: target(round(completions / passAttempts, 4), absolute(0.02)),
        sackRate: target(round(sacks / (passAttempts + sacks), 4), absolute(0.01)),
        interceptionRate: target(round(interceptions / passAttempts, 4), absolute(0.005)),
        rushingYardsPerAttempt: target(round(rushingYards / rushes, 3), relative(0.05)),
        passingYardsPerAttempt: target(round(passingYards / passAttempts, 3), relative(0.05)),
        passingYardsPerCompletion: target(round(passingYards / completions, 3), relative(0.05)),
        thirdDownAttemptsPerGame: target(round(2 * thirdAttempts / teamGames, 3), relative(0.05)),
        thirdDownConversionRate: target(round(thirdConversions / thirdAttempts, 4), absolute(0.02)),
        fourthDownAttemptsPerGame: target(round(2 * fourthAttempts / teamGames, 3), relative(0.10)),
        fourthDownConversionRate: target(round(fourthConversions / fourthAttempts, 4), absolute(0.03)),
        redZoneScoringRate: target(round(redZoneScores / redZoneAttempts, 4), absolute(0.03)),
        redZoneTouchdownRate: target(round(redZoneTouchdowns / redZoneAttempts, 4), absolute(0.03)),
      },
      scoreDistribution: {
        combinedPointsMean: target(round(
          combinedScores.reduce((total, value) => total + value, 0) / combinedScores.length,
          3,
        ), relative(0.05)),
        combinedPointsStandardDeviation: target(
          round(populationStandardDeviation(combinedScores), 3),
          relative(0.05),
        ),
        combinedPointsP10: target(round(percentile(combinedScores, 0.10), 3), absolute(4)),
        combinedPointsP25: target(round(percentile(combinedScores, 0.25), 3), absolute(4)),
        combinedPointsP50: target(round(percentile(combinedScores, 0.50), 3), absolute(4)),
        combinedPointsP75: target(round(percentile(combinedScores, 0.75), 3), absolute(4)),
        combinedPointsP90: target(round(percentile(combinedScores, 0.90), 3), absolute(4)),
        combinedPointsP95: target(round(percentile(combinedScores, 0.95), 3), absolute(4)),
        marginMean: target(round(
          margins.reduce((total, value) => total + value, 0) / margins.length,
          3,
        ), relative(0.05)),
        marginStandardDeviation: target(
          round(populationStandardDeviation(margins), 3),
          relative(0.05),
        ),
        marginP25: target(round(percentile(margins, 0.25), 3), absolute(4)),
        marginP50: target(round(percentile(margins, 0.50), 3), absolute(4)),
        marginP75: target(round(percentile(margins, 0.75), 3), absolute(4)),
        marginP90: target(round(percentile(margins, 0.90), 3), absolute(4)),
        marginP95: target(round(percentile(margins, 0.95), 3), absolute(4)),
        marginAtMostThreeShare: target(round(share(margins, value => value <= 3), 4), absolute(0.03)),
        marginAtMostEightShare: target(round(share(margins, value => value <= 8), 4), absolute(0.03)),
        marginAtLeastTwentyShare: target(round(share(margins, value => value >= 20), 4), absolute(0.03)),
        marginAtLeastThirtyShare: target(round(share(margins, value => value >= 30), 4), absolute(0.03)),
        shutoutShare: target(round(shutoutShare, 4), absolute(0.03)),
        combinedAtLeastSeventyShare: target(
          round(share(combinedScores, value => value >= 70), 4),
          absolute(0.03),
        ),
        combinedAtMostThirtyShare: target(
          round(share(combinedScores, value => value <= 30), 4),
          absolute(0.03),
        ),
      },
    },
  };
};

export const SIM_CALIBRATION_BENCHMARK = rawBenchmark as CalibrationBenchmark;
