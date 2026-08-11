import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  buildCalibrationBenchmark,
  CALIBRATION_BENCHMARK_SEASONS,
  parseCalibrationBenchmarkArguments,
  parseSchoolSlugs,
  parseStatisticsTable,
  type BenchmarkContest,
  type BenchmarkSeasonInput,
} from '../src/domain/sim/calibrationBenchmark';

const BENCHMARK_PATH = new URL(
  '../src/domain/sim/calibration_benchmark.json',
  import.meta.url,
);

const STATISTICS = {
  totalOffense: 21,
  scoringOffense: 27,
  passingOffense: 25,
  rushingOffense: 23,
  sacksAllowed: 468,
  turnoversLost: 461,
  netPunting: 98,
  thirdDown: 699,
  fourthDown: 700,
  redZone: 703,
} as const;

const SCOREBOARD_QUERY_HASH =
  '4bcb5e6432fa9da365c0c19af01b1f9015cc7eb5c21e7af2dba308784a166df7';

const fetchText = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'user-agent': 'cfbsim-calibration-benchmark/1.0' },
  });
  if (!response.ok) throw new Error(`NCAA request failed (${response.status}): ${url}`);
  return response.text();
};

const fetchStatistic = async (season: number, statistic: number) => {
  const rows: Record<string, string>[] = [];
  const slugs = new Set<string>();
  for (let page = 1; page <= 4; page += 1) {
    const suffix = page === 1 ? '' : `/p${page}`;
    const document = await fetchText(
      `https://www.ncaa.com/stats/football/fbs/${season}/team/${statistic}${suffix}`,
    );
    const parsed = parseStatisticsTable(document);
    rows.push(...parsed.rows);
    parseSchoolSlugs(document).forEach(slug => slugs.add(slug));
    if (parsed.rows.length < 50) break;
  }
  return { rows, slugs };
};

const fetchIndividualStatistic = async (season: number, statistic: number) => {
  const rows: Record<string, string>[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const suffix = page === 1 ? '' : `/p${page}`;
    const document = await fetchText(
      `https://www.ncaa.com/stats/football/fbs/${season}/individual/${statistic}${suffix}`,
    );
    const parsed = parseStatisticsTable(document);
    rows.push(...parsed.rows);
    if (parsed.rows.length < 50) break;
  }
  return rows;
};

const scoreboardUrl = (season: number, week: number) => {
  const parameters = new URLSearchParams({
    meta: 'GetContests_web',
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: SCOREBOARD_QUERY_HASH },
    }),
    variables: JSON.stringify({
      sportCode: 'MFB',
      division: 11,
      seasonYear: season,
      week,
    }),
  });
  return `https://sdataprod.ncaa.com?${parameters}`;
};

const parseContest = (season: number, value: unknown): BenchmarkContest => {
  if (!value || typeof value !== 'object') throw new Error('NCAA contest is not an object.');
  const raw = value as Record<string, unknown>;
  if (!Number.isInteger(raw.contestId) || typeof raw.gameState !== 'string') {
    throw new Error('NCAA contest is missing its ID or state.');
  }
  if (!Array.isArray(raw.teams)) throw new Error('NCAA contest is missing teams.');
  const teams = raw.teams.map(team => {
    if (!team || typeof team !== 'object') throw new Error('NCAA contest team is malformed.');
    const record = team as Record<string, unknown>;
    if (typeof record.seoname !== 'string' || !Number.isFinite(record.score)) {
      throw new Error('NCAA contest team is missing its slug or score.');
    }
    return { seoname: record.seoname, score: Number(record.score) };
  });
  return {
    contestId: Number(raw.contestId),
    season,
    gameState: raw.gameState,
    teams,
  };
};

const fetchScoreboardWeek = async (season: number, week: number) => {
  const document = JSON.parse(await fetchText(scoreboardUrl(season, week))) as unknown;
  if (!document || typeof document !== 'object') {
    throw new Error('NCAA scoreboard response is not an object.');
  }
  const data = (document as Record<string, unknown>).data;
  if (!data || typeof data !== 'object' || !Array.isArray(
    (data as Record<string, unknown>).contests,
  )) throw new Error('NCAA scoreboard response is missing contests.');
  return ((data as Record<string, unknown>).contests as unknown[])
    .map(contest => parseContest(season, contest));
};

export const fetchBenchmarkSeason = async (season: number): Promise<BenchmarkSeasonInput> => {
  const [statisticEntries, qualifiedKickerRows] = await Promise.all([
    Promise.all(Object.entries(STATISTICS).map(
      async ([name, id]) => [name, await fetchStatistic(season, id)] as const,
    )),
    fetchIndividualStatistic(season, 18),
  ]);
  const totalOffense = statisticEntries.find(([name]) => name === 'totalOffense')?.[1];
  if (!totalOffense) throw new Error(`Season ${season} is missing total offense.`);
  const scoreboardWeeks = await Promise.all(
    Array.from({ length: 22 }, (_, index) => fetchScoreboardWeek(season, index + 1)),
  );
  return {
    season,
    teamRows: Object.fromEntries(
      statisticEntries.map(([name, statistic]) => [name, statistic.rows]),
    ),
    qualifiedKickerRows,
    fbsTeamSlugs: totalOffense.slugs,
    contests: scoreboardWeeks.flat(),
  };
};

const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export const runSimulationBenchmarkGenerator = async (arguments_: string[]) => {
  const { check } = parseCalibrationBenchmarkArguments(arguments_);
  const inputs = await Promise.all(
    CALIBRATION_BENCHMARK_SEASONS.map(season => fetchBenchmarkSeason(season)),
  );
  const benchmark = buildCalibrationBenchmark(inputs);
  const generated = serialize(benchmark);
  if (check) {
    const committed = readFileSync(BENCHMARK_PATH, 'utf8');
    if (generated !== committed) {
      throw new Error('Committed simulation benchmark does not match NCAA source data.');
    }
    console.log(`Simulation benchmark ${benchmark.sourceChecksum} is current.`);
    return benchmark;
  }
  writeFileSync(BENCHMARK_PATH, generated);
  console.log(`Wrote simulation benchmark ${benchmark.sourceChecksum}.`);
  return benchmark;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runSimulationBenchmarkGenerator(process.argv.slice(2));
}
