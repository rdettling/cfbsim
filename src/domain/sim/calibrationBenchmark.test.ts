import { describe, expect, it } from 'vitest';
import {
  buildCalibrationBenchmark,
  parseSchoolSlugs,
  parseStatisticsTable,
  parseCalibrationBenchmarkArguments,
  percentile,
  populationStandardDeviation,
  SIM_CALIBRATION_BENCHMARK,
  type BenchmarkSeasonInput,
} from './calibrationBenchmark';

const table = (headers: string[], cells: string[][], teamSlugs: string[] = []) => `
  <table class="block-stats__stats-table sticky">
    <thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
    <tbody>${cells.map((row, rowIndex) => `<tr>${row.map((cell, cellIndex) => (
      `<td>${cellIndex === 1 && teamSlugs[rowIndex]
        ? `<a href="/schools/${teamSlugs[rowIndex]}">${cell}</a>`
        : cell}</td>`
    )).join('')}</tr>`).join('')}</tbody>
  </table>
`;

const statisticRows = (teams: number) => {
  const row = (values: Record<string, string>) => Array.from({ length: teams }, (_, index) => ({
    Rank: String(index + 1),
    Team: `Team ${index + 1}`,
    ...values,
  }));
  return {
    totalOffense: row({ G: '12', Plays: '800', YDS: '4800', 'Yds/Play': '6', 'Off TDs': '48', YPG: '400' }),
    scoringOffense: row({ G: '12', TDs: '48', PAT: '45', '2PT': '0', 'Def Pts': '0', FG: '12', Saf: '0', Pts: '369', PPG: '30.8' }),
    passingOffense: row({ G: '12', 'Pass Att': '360', 'Pass Com': '216', Int: '9', 'Pass Yds': '2700', 'Yds/Att': '7.5', 'Yds/Comp': '12.5', 'Pass TD': '24', YPG: '225' }),
    rushingOffense: row({ G: '12', Rush: '440', 'Rush Yds': '2100', 'Yds/Rush': '4.77', 'Rush TD': '24', YPG: '175' }),
    sacksAllowed: row({ G: '12', 'Opp Sacks': '24', 'Opp Sack Yds': '144', Avg: '2' }),
    turnoversLost: row({ G: '12', 'Fum Lost': '6', Int: '9', 'Turn Lost': '15' }),
    netPunting: row({ G: '12', 'Punt Yds': '1800', 'Opp Punt Ret Yds': '100', Punts: '45', TB: '3', 'Net Yds': '1660' }),
    thirdDown: row({ G: '12', '3rd Att': '160', '3rd Conv': '64', Pct: '0.400' }),
    fourthDown: row({ G: '12', '4th Conv': '8', '4th Att': '15', Pct: '0.533' }),
    redZone: row({ G: '12', RZAtt: '48', 'RZ Rush TD': '12', 'RZ Pass TD': '16', 'RZ FG Made': '10', RZScores: '38', Pct: '0.792' }),
  };
};

const seasonInput = (season: number): BenchmarkSeasonInput => {
  const fbsTeamSlugs = new Set(Array.from({ length: 130 }, (_, index) => `team-${index + 1}`));
  const contests = Array.from({ length: 703 }, (_, index) => ({
    contestId: season * 10_000 + index,
    season,
    gameState: index === 700 ? 'P' : 'F',
    teams: index === 701
      ? [{ seoname: 'team-1', score: 20 }, { seoname: 'non-fbs', score: 10 }]
      : [{ seoname: 'team-1', score: 20 }, { seoname: 'team-2', score: 10 }],
  }));
  contests[702] = { ...contests[0] };
  const qualifiedKickerRows = [{
    Rank: '1',
    Name: 'Kicker',
    Team: 'Team 1',
    Cl: 'Sr.',
    Position: 'K',
    G: '12',
    FG: '9',
    FGA: '12',
    Pct: '0.750',
    'FG PG': '0.75',
  }];
  return { season, teamRows: statisticRows(130), qualifiedKickerRows, fbsTeamSlugs, contests };
};

describe('simulation calibration benchmark', () => {
  it('accepts only write and check command modes', () => {
    expect(parseCalibrationBenchmarkArguments([])).toEqual({ check: false });
    expect(parseCalibrationBenchmarkArguments(['--check'])).toEqual({ check: true });
    expect(() => parseCalibrationBenchmarkArguments(['--write'])).toThrow('Unknown');
    expect(() => parseCalibrationBenchmarkArguments(['--check', 'extra'])).toThrow('Unknown');
  });

  it('parses exact NCAA table rows and school slugs', () => {
    const document = table(
      ['Rank', 'Team', 'G', 'YDS'],
      [['1', 'A &amp; M', '12', '4,800']],
      ['a-m'],
    );
    expect(parseStatisticsTable(document)).toEqual({
      headers: ['Rank', 'Team', 'G', 'YDS'],
      rows: [{ Rank: '1', Team: 'A & M', G: '12', YDS: '4,800' }],
    });
    expect(parseSchoolSlugs(document)).toEqual(['a-m']);
  });

  it('rejects missing tables and malformed row widths', () => {
    expect(() => parseStatisticsTable('<html />')).toThrow('statistics table');
    expect(() => parseStatisticsTable(table(['Rank', 'Team'], [['1']]))).toThrow(
      'does not match',
    );
  });

  it('summarizes distributions with deterministic interpolation', () => {
    expect(percentile([0, 10, 20, 30], 0.25)).toBe(7.5);
    expect(percentile([], 0.5)).toBe(0);
    expect(populationStandardDeviation([0, 2])).toBe(1);
    expect(populationStandardDeviation([])).toBe(0);
    expect(() => percentile([1], 2)).toThrow('zero through one');
  });

  it('deduplicates contests and excludes non-final and non-FBS games', () => {
    const benchmark = buildCalibrationBenchmark([
      seasonInput(2023),
      seasonInput(2024),
      seasonInput(2025),
    ]);
    expect(benchmark.sampleCounts.fbsVsFbsGames).toBe(2100);
    expect(benchmark.sampleCounts.bySeason['2023'].fbsVsFbsGames).toBe(700);
    expect(benchmark.targets.production.completionRate.value).toBe(0.6);
    expect(benchmark.targets.production.passPlayShare.value).toBe(0.48);
    expect(benchmark.targets.production.fieldGoalMakeRate.value).toBe(0.75);
    expect(benchmark.targets.production.thirdDownAttemptsPerGame.value).toBe(26.667);
    expect(benchmark.targets.production.fourthDownAttemptsPerGame.value).toBe(2.5);
  });

  it('rejects incomplete seasons and changed NCAA columns', () => {
    const missingSeason = [seasonInput(2023), seasonInput(2025)];
    expect(() => buildCalibrationBenchmark(missingSeason)).toThrow('exactly');
    const malformed = seasonInput(2024);
    malformed.teamRows.totalOffense = malformed.teamRows.totalOffense.map(({ YDS: _, ...row }) => row);
    expect(() => buildCalibrationBenchmark([
      seasonInput(2023),
      malformed,
      seasonInput(2025),
    ])).toThrow('missing YDS');
    const malformedKicker = seasonInput(2024);
    malformedKicker.qualifiedKickerRows = malformedKicker.qualifiedKickerRows.map(
      ({ FGA: _, ...row }) => row,
    );
    expect(() => buildCalibrationBenchmark([
      seasonInput(2023),
      malformedKicker,
      seasonInput(2025),
    ])).toThrow('missing FGA');
  });

  it('loads the frozen 2023-25 source snapshot', () => {
    expect(SIM_CALIBRATION_BENCHMARK).toMatchObject({
      schemaVersion: 3,
      seasons: [2023, 2024, 2025],
      sampleCounts: {
        teamGames: 5083,
        fbsVsFbsGames: 2329,
        qualifiedKickerRows: 429,
        qualifiedFieldGoalsMade: 5745,
        qualifiedFieldGoalsAttempted: 7483,
        qualifiedFieldGoalCoverage: 0.948,
      },
      sourceChecksum: '01fba155',
    });
    expect(SIM_CALIBRATION_BENCHMARK.targets.production.yardsPerPlay.value).toBe(5.768);
    expect(SIM_CALIBRATION_BENCHMARK.targets.production.fieldGoalMakeRate.value).toBe(0.7677);
    expect(SIM_CALIBRATION_BENCHMARK.targets.production.thirdDownAttemptsPerGame.value)
      .toBe(26.971);
    expect(SIM_CALIBRATION_BENCHMARK.targets.production.fourthDownAttemptsPerGame.value)
      .toBe(3.872);
    expect(SIM_CALIBRATION_BENCHMARK.sampleCounts.bySeason).toMatchObject({
      '2023': {
        thirdDownAttemptsPerGame: 27.002,
        fourthDownAttemptsPerGame: 3.752,
      },
      '2024': {
        thirdDownAttemptsPerGame: 26.861,
        fourthDownAttemptsPerGame: 3.79,
      },
      '2025': {
        thirdDownAttemptsPerGame: 27.05,
        fourthDownAttemptsPerGame: 4.07,
      },
    });
    expect(SIM_CALIBRATION_BENCHMARK.targets.scoreDistribution.combinedPointsP50.value)
      .toBe(52);
  });
});
