/// <reference types="node" />
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIRST_GAME_HISTORY_YEAR,
  validateHistoricalGamesIndex,
  validateHistoricalGamesSeason,
} from '../src/domain/historicalGames';
import { canonicalCfbdTeamName } from './cfbd_team_names';
import { getLastWeekByPlayoffTeams } from '../src/domain/league/postseason';
import { buildConferenceGameLabel } from '../src/domain/utils/gameLabels';
import { validateSeasonData } from '../src/domain/seasonDataValidation';
import type {
  HistoricalGame,
  HistoricalGamesSeason,
  HistoricalGameSeasonType,
  TeamsData,
  SeasonData,
} from '../src/types/baseData';
import type { PlayoffTeamCount } from '../src/types/domain';
import {
  validateRawGameHistoryManifest,
} from './game_history_pipeline';
import {
  buildHistoricalGameProjectionData,
} from './data_build';
import { compactJson, prettyJson } from './data_files';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const TEAMS_PATH = join(ROOT, 'public', 'data', 'teams.json');
const SEASONS_DIRECTORY = join(ROOT, 'public', 'data', 'seasons');
export const OUTPUT_DIRECTORY = join(
  ROOT,
  'public',
  'data',
  'historical-games',
);
export const RAW_GAME_HISTORY_DIRECTORY = join(
  ROOT,
  '.artifacts',
  'game-history',
  'raw',
);
const STAGING_PARENT_DIRECTORY = join(
  ROOT,
  '.artifacts',
  'game-history-builds',
);

type RawGame = {
  id?: unknown;
  season?: unknown;
  week?: unknown;
  seasonType?: unknown;
  startDate?: unknown;
  completed?: unknown;
  neutralSite?: unknown;
  notes?: unknown;
  playoff?: unknown;
  venue?: unknown;
  homeTeam?: unknown;
  homeId?: unknown;
  homeClassification?: unknown;
  homeConference?: unknown;
  homePoints?: unknown;
  awayTeam?: unknown;
  awayId?: unknown;
  awayClassification?: unknown;
  awayConference?: unknown;
  awayPoints?: unknown;
};

type RawRanking = {
  rank?: unknown;
  teamId?: unknown;
};

type RawPoll = {
  poll?: unknown;
  ranks?: unknown;
};

type RawRankingWeek = {
  season?: unknown;
  seasonType?: unknown;
  week?: unknown;
  polls?: unknown;
};

export type TransformGameHistoryOptions = {
  year: number | null;
};

const readJson = async <T,>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf8')) as T;

export const parseTransformGameHistoryArgs = (
  args: string[],
): TransformGameHistoryOptions => {
  let year: number | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--year') {
      const rawYear = args[index + 1];
      if (rawYear === undefined || !/^\d{4}$/.test(rawYear)) {
        throw new Error('--year requires a four-digit year.');
      }
      year = Number(rawYear);
      index += 1;
      continue;
    }
    throw new Error(`Unknown transform:game-history argument: ${argument}`);
  }
  if (year !== null && year < FIRST_GAME_HISTORY_YEAR) {
    throw new Error(
      `Game-history years must be ${FIRST_GAME_HISTORY_YEAR} or later.`,
    );
  }
  return { year };
};

const getCompletedYears = async () => {
  const years = (await readdir(SEASONS_DIRECTORY))
    .filter(name => /^\d{4}\.json$/.test(name))
    .map(name => Number(name.slice(0, 4)));
  const seasons = await Promise.all(years.map(async year =>
    validateSeasonData(
      await readJson<unknown>(join(SEASONS_DIRECTORY, `${year}.json`)),
      `seasons/${year}.json`,
      year,
    ),
  ));
  return seasons
    .filter(season =>
      season.year >= FIRST_GAME_HISTORY_YEAR && season.results !== null)
    .map(season => season.year);
};

const getOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const getPlayoffField = (value: unknown, field: string) =>
  typeof value === 'object' && value !== null
    ? getOptionalString((value as Record<string, unknown>)[field])
    : null;

const CONFERENCE_ALIASES: Readonly<Record<string, string | null>> = {
  'American Athletic': 'American',
  'Conference USA': 'CUSA',
  'FBS Independents': null,
  'Mid-American': 'MAC',
  'Mountain West': 'MWC',
};

const normalizeProviderConference = (value: unknown) => {
  const conference = getOptionalString(value);
  if (conference === null) return null;
  return Object.prototype.hasOwnProperty.call(CONFERENCE_ALIASES, conference)
    ? CONFERENCE_ALIASES[conference] ?? null
    : conference;
};

const buildTeamConferences = (yearData: SeasonData) => {
  const conferences = new Map<string, string | null>();
  for (const [conference, data] of Object.entries(yearData.conferences)) {
    for (const team of data.teams) {
      conferences.set(canonicalCfbdTeamName(team), conference);
    }
  }
  for (const team of yearData.independents) {
    conferences.set(canonicalCfbdTeamName(team), null);
  }
  return conferences;
};

const requireInteger = (value: unknown, field: string, gameId: unknown) => {
  if (!Number.isInteger(value)) {
    throw new Error(`CFBD game ${String(gameId)} has an invalid ${field}.`);
  }
  return Number(value);
};

const requireString = (value: unknown, field: string, gameId: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`CFBD game ${String(gameId)} has an invalid ${field}.`);
  }
  return value.trim();
};

type RankingSnapshots = {
  regular: Map<number, Map<number, number>>;
  postseason: Map<number, number>;
};

const getRegularRankingSnapshot = (
  rankings: RankingSnapshots,
  year: number,
  week: number,
) => {
  const exact = rankings.regular.get(week);
  if (exact) return exact;
  const priorWeek = [...rankings.regular.keys()]
    .filter(candidate => candidate < week)
    .sort((left, right) => right - left)[0];
  if (priorWeek === undefined) {
    throw new Error(
      `AP Top 25 ${year} week ${week} has no current or prior snapshot.`,
    );
  }
  return rankings.regular.get(priorWeek)!;
};

const buildRankingSnapshot = (
  ranks: unknown,
  year: number,
  week: number,
) => {
  if (!Array.isArray(ranks) || ranks.length === 0) {
    throw new Error(`AP Top 25 ${year} week ${week} has no ranks.`);
  }
  const snapshot = new Map<number, number>();
  for (const rawRank of ranks as RawRanking[]) {
    const teamId = requireInteger(rawRank.teamId, 'teamId', `${year}/${week}`);
    const rank = requireInteger(rawRank.rank, 'rank', `${year}/${week}`);
    if (teamId <= 0 || rank < 1 || rank > 25 || snapshot.has(teamId)) {
      throw new Error(`AP Top 25 ${year} week ${week} contains an invalid rank.`);
    }
    snapshot.set(teamId, rank);
  }
  return snapshot;
};

export const buildApRankingSnapshots = (
  rawRankings: RawRankingWeek[],
  year: number,
): RankingSnapshots => {
  const regular = new Map<number, Map<number, number>>();
  for (const entry of rawRankings) {
    const rankingYear = requireInteger(entry.season, 'season', 'ranking');
    if (rankingYear !== year) {
      throw new Error(`Rankings snapshot contains unexpected season ${rankingYear}.`);
    }
    const week = requireInteger(entry.week, 'week', `${year} ranking`);
    if (week < 1) {
      throw new Error(`Rankings snapshot ${year} has an invalid week.`);
    }
    if (entry.seasonType !== 'regular' && entry.seasonType !== 'postseason') {
      throw new Error(`Rankings snapshot ${year} week ${week} has an invalid seasonType.`);
    }
    if (!Array.isArray(entry.polls)) {
      throw new Error(`Rankings snapshot ${year} week ${week} has invalid polls.`);
    }
    const apPolls = (entry.polls as RawPoll[])
      .filter(poll => poll.poll === 'AP Top 25');
    if (apPolls.length > 1) {
      throw new Error(`Rankings snapshot ${year} week ${week} has duplicate AP polls.`);
    }
    if (entry.seasonType !== 'regular' || apPolls.length === 0) continue;
    if (regular.has(week)) {
      throw new Error(`Rankings snapshot ${year} has duplicate regular week ${week}.`);
    }
    regular.set(week, buildRankingSnapshot(apPolls[0].ranks, year, week));
  }
  const lastRegularWeek = [...regular.keys()].sort((left, right) => left - right).at(-1);
  if (lastRegularWeek === undefined) {
    throw new Error(`Rankings snapshot ${year} has no regular-season AP Top 25 poll.`);
  }
  return { regular, postseason: regular.get(lastRegularWeek)! };
};

export const getHistoricalWeek = (
  raw: Pick<RawGame, 'seasonType' | 'week' | 'playoff' | 'id'>,
  playoffTeams: PlayoffTeamCount,
) => {
  const sourceId = raw.id;
  if (raw.seasonType === 'regular') {
    const week = requireInteger(raw.week, 'week', sourceId);
    if (week < 1 || week > 16) {
      throw new Error(`CFBD game ${String(sourceId)} has an unsupported regular week.`);
    }
    return week;
  }
  if (raw.seasonType !== 'postseason') {
    throw new Error(`CFBD game ${String(sourceId)} has an invalid seasonType.`);
  }
  const round = getPlayoffField(raw.playoff, 'round');
  let weekPlayed = 16;
  if (playoffTeams === 4) {
    if (round === 'championship') weekPlayed = 17;
    else if (round !== null && round !== 'semifinal') {
      throw new Error(`CFBD game ${String(sourceId)} has an unsupported playoff round.`);
    }
  } else if (playoffTeams === 12) {
    const weeks: Record<string, number> = {
      first_round: 16,
      quarterfinal: 17,
      semifinal: 18,
      championship: 19,
    };
    if (round !== null) {
      const mappedWeek = weeks[round];
      if (mappedWeek === undefined) {
        throw new Error(`CFBD game ${String(sourceId)} has an unsupported playoff round.`);
      }
      weekPlayed = mappedWeek;
    }
  }
  if (weekPlayed > getLastWeekByPlayoffTeams(playoffTeams)) {
    throw new Error(`CFBD game ${String(sourceId)} exceeds the configured season.`);
  }
  return weekPlayed;
};

const toHistoricalGame = (
  raw: RawGame,
  supportedTeams: Set<string>,
  teamConferences: Map<string, string | null>,
  playoffTeams: PlayoffTeamCount,
  rankings: RankingSnapshots,
): HistoricalGame | null => {
  if (raw.completed !== true) return null;

  const sourceId = requireInteger(raw.id, 'id', raw.id);
  const year = requireInteger(raw.season, 'season', sourceId);
  const seasonType = raw.seasonType;
  if (seasonType !== 'regular' && seasonType !== 'postseason') {
    throw new Error(`CFBD game ${sourceId} has an invalid seasonType.`);
  }
  if (typeof raw.neutralSite !== 'boolean') {
    throw new Error(`CFBD game ${sourceId} has an invalid neutralSite.`);
  }

  const providerHomeTeam = requireString(raw.homeTeam, 'homeTeam', sourceId);
  const providerAwayTeam = requireString(raw.awayTeam, 'awayTeam', sourceId);
  const homeTeam = canonicalCfbdTeamName(providerHomeTeam);
  const awayTeam = canonicalCfbdTeamName(providerAwayTeam);
  const homeIsFbs = raw.homeClassification === 'fbs';
  const awayIsFbs = raw.awayClassification === 'fbs';
  if (!supportedTeams.has(homeTeam) && !supportedTeams.has(awayTeam)) return null;

  for (const [providerName, canonicalName, isFbs] of [
    [providerHomeTeam, homeTeam, homeIsFbs],
    [providerAwayTeam, awayTeam, awayIsFbs],
  ] as const) {
    if (isFbs && !supportedTeams.has(canonicalName)) {
      throw new Error(
        `CFBD FBS team ${providerName} is not mapped to teams.json.`,
      );
    }
  }

  const homeId = requireInteger(raw.homeId, 'homeId', sourceId);
  const awayId = requireInteger(raw.awayId, 'awayId', sourceId);
  const rankSnapshot = seasonType === 'regular'
    ? getRegularRankingSnapshot(
      rankings,
      year,
      requireInteger(raw.week, 'week', sourceId),
    )
    : rankings.postseason;
  const name = getPlayoffField(raw.playoff, 'bowlName') ??
    getOptionalString(raw.notes);
  const venue = raw.venue === null
    ? null
    : requireString(raw.venue, 'venue', sourceId);
  const homeConference = teamConferences.has(homeTeam)
    ? teamConferences.get(homeTeam) ?? null
    : normalizeProviderConference(raw.homeConference);
  const awayConference = teamConferences.has(awayTeam)
    ? teamConferences.get(awayTeam) ?? null
    : normalizeProviderConference(raw.awayConference);

  return {
    sourceId,
    year,
    weekPlayed: getHistoricalWeek(raw, playoffTeams),
    seasonType: seasonType as HistoricalGameSeasonType,
    homeTeam,
    awayTeam,
    homeScore: requireInteger(raw.homePoints, 'homePoints', sourceId),
    awayScore: requireInteger(raw.awayPoints, 'awayPoints', sourceId),
    homeRank: rankSnapshot.get(homeId) ?? 0,
    awayRank: rankSnapshot.get(awayId) ?? 0,
    neutralSite: raw.neutralSite,
    venue,
    name,
    label: buildConferenceGameLabel(homeConference, awayConference, name),
  };
};

const compareGames = (left: HistoricalGame, right: HistoricalGame) =>
  left.year - right.year ||
  left.weekPlayed - right.weekPlayed ||
  (left.seasonType === right.seasonType
    ? 0
    : left.seasonType === 'regular' ? -1 : 1) ||
  left.sourceId - right.sourceId;

const gameFingerprint = (game: HistoricalGame) => [
  game.year,
  game.homeTeam,
  game.awayTeam,
  game.homeScore,
  game.awayScore,
].join('|');

const gameRichness = (game: HistoricalGame) =>
  Number(game.venue !== null) + Number(game.name !== null);

const deduplicateGames = (games: HistoricalGame[]) => {
  const byFingerprint = new Map<string, HistoricalGame>();
  for (const game of games) {
    const fingerprint = gameFingerprint(game);
    const current = byFingerprint.get(fingerprint);
    if (
      !current ||
      gameRichness(game) > gameRichness(current) ||
      (gameRichness(game) === gameRichness(current) &&
        game.sourceId > current.sourceId)
    ) {
      byFingerprint.set(fingerprint, game);
    }
  }
  return [...byFingerprint.values()];
};

export const buildHistoricalGamesSeason = ({
  rawGames,
  rawRankings,
  year,
  supportedTeams,
  yearData,
}: {
  rawGames: RawGame[];
  rawRankings: RawRankingWeek[];
  year: number;
  supportedTeams: Set<string>;
  yearData: SeasonData;
}): HistoricalGamesSeason => {
  const playoffTeams = yearData.playoff.teams as PlayoffTeamCount;
  const rankings = buildApRankingSnapshots(rawRankings, year);
  const teamConferences = buildTeamConferences(yearData);
  const unmappedFbsTeams = new Set<string>();
  for (const raw of rawGames) {
    for (const [name, classification] of [
      [raw.homeTeam, raw.homeClassification],
      [raw.awayTeam, raw.awayClassification],
    ]) {
      if (
        classification === 'fbs' &&
        typeof name === 'string' &&
        !supportedTeams.has(canonicalCfbdTeamName(name))
      ) {
        unmappedFbsTeams.add(name);
      }
    }
  }
  if (unmappedFbsTeams.size) {
    throw new Error(
      `CFBD FBS teams are not mapped to teams.json: ${[
        ...unmappedFbsTeams,
      ].sort().join(', ')}.`,
    );
  }
  const games = deduplicateGames(
    rawGames
      .map(game => toHistoricalGame(
        game,
        supportedTeams,
        teamConferences,
        playoffTeams,
        rankings,
      ))
      .filter((game): game is HistoricalGame => game !== null),
  ).sort(compareGames);
  return validateHistoricalGamesSeason({
    year,
    games,
  }, year);
};

const readRawArray = async <T,>(
  rawDirectory: string,
  file: string,
  expectedRecords: number,
) => {
  const value = await readJson<unknown>(join(rawDirectory, file));
  if (!Array.isArray(value)) {
    throw new Error(`Raw game-history file ${file} is not an array.`);
  }
  if (value.length !== expectedRecords) {
    throw new Error(
      `Raw game-history file ${file} contains ${value.length} records; ` +
      `manifest declares ${expectedRecords}.`,
    );
  }
  return value as T[];
};

const replaceDirectory = async (staging: string, target: string) => {
  const backup = `${target}.backup`;
  await rm(backup, { recursive: true, force: true });
  let hadTarget = false;
  try {
    await rename(target, backup);
    hadTarget = true;
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
  try {
    await rename(staging, target);
  } catch (error) {
    if (hadTarget) await rename(backup, target);
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
};

const readExistingIndex = async (outputDirectory: string) => {
  try {
    return validateHistoricalGamesIndex(
      await readJson<unknown>(join(outputDirectory, 'index.json')),
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
};

export const runTransformGameHistory = async ({
  options,
  rawDirectory = RAW_GAME_HISTORY_DIRECTORY,
  outputDirectory = OUTPUT_DIRECTORY,
  stagingParent = STAGING_PARENT_DIRECTORY,
  completedYears = getCompletedYears(),
}: {
  options: TransformGameHistoryOptions;
  rawDirectory?: string;
  outputDirectory?: string;
  stagingParent?: string;
  completedYears?: Promise<number[]>;
}) => {
  const [teamsData, availableYears, manifest, existingIndex] = await Promise.all([
    readJson<TeamsData>(TEAMS_PATH),
    completedYears,
    readJson<unknown>(join(rawDirectory, 'manifest.json')).then(
      validateRawGameHistoryManifest,
    ),
    options.year === null
      ? Promise.resolve(null)
      : readExistingIndex(outputDirectory),
  ]);
  const years = options.year === null
    ? [...availableYears].sort((left, right) => left - right)
    : [options.year];
  const unavailableYear = years.find(year => !availableYears.includes(year));
  if (unavailableYear !== undefined) {
    throw new Error(
      `Game-history year ${unavailableYear} is not a completed bundled season.`,
    );
  }
  const missingRawYear = years.find(year => !manifest.seasons[String(year)]);
  if (missingRawYear !== undefined) {
    throw new Error(
      `Raw game-history snapshot for ${missingRawYear} is missing.`,
    );
  }

  await mkdir(stagingParent, { recursive: true });
  const stagingDirectory = await mkdtemp(join(stagingParent, 'build-'));
  if (existingIndex) {
    await Promise.all(
      existingIndex.years
        .filter(year => year !== options.year)
        .map(year => copyFile(
          join(outputDirectory, `${year}.json`),
          join(stagingDirectory, `${year}.json`),
        )),
    );
  }
  const supportedTeams = new Set(Object.keys(teamsData.teams));
  const audits: Array<{
    year: number;
    sourceRecords: number;
    rankingSnapshots: number;
    retainedGames: number;
    venues: number;
    namedGames: number;
    rankedTeamAppearances: number;
  }> = [];
  for (const year of years) {
    const rawSeason = manifest.seasons[String(year)];
    const [regular, postseason, rankings, rawYearData] = await Promise.all([
      readRawArray<RawGame>(
        rawDirectory,
        rawSeason.regular.file,
        rawSeason.regular.records,
      ),
      readRawArray<RawGame>(
        rawDirectory,
        rawSeason.postseason.file,
        rawSeason.postseason.records,
      ),
      readRawArray<RawRankingWeek>(
        rawDirectory,
        rawSeason.rankings.file,
        rawSeason.rankings.records,
      ),
      readJson<unknown>(join(SEASONS_DIRECTORY, `${year}.json`)),
    ]);
    const yearData = validateSeasonData(
      rawYearData,
      `seasons/${year}.json`,
      year,
    );
    const season = buildHistoricalGamesSeason({
      rawGames: [...regular, ...postseason],
      rawRankings: rankings,
      year,
      supportedTeams,
      yearData,
    });
    await writeFile(
      join(stagingDirectory, `${year}.json`),
      `${JSON.stringify(season)}\n`,
    );
    audits.push({
      year,
      sourceRecords: regular.length + postseason.length,
      rankingSnapshots: rankings.length,
      retainedGames: season.games.length,
      venues: season.games.filter(game => game.venue !== null).length,
      namedGames: season.games.filter(game => game.name !== null).length,
      rankedTeamAppearances: season.games.reduce(
        (total, game) =>
          total + Number(game.homeRank > 0) + Number(game.awayRank > 0),
        0,
      ),
    });
  }

  const outputYears = [
    ...(existingIndex?.years ?? []),
    ...years,
  ].filter((year, index, values) => values.indexOf(year) === index)
    .sort((left, right) => left - right);
  const outputSeasons: HistoricalGamesSeason[] = [];
  for (const year of outputYears) {
    outputSeasons.push(validateHistoricalGamesSeason(
      await readJson<unknown>(join(stagingDirectory, `${year}.json`)),
      year,
    ));
  }
  const projections = buildHistoricalGameProjectionData(
    outputSeasons,
    supportedTeams,
  );
  await writeFile(
    join(stagingDirectory, 'index.json'),
    prettyJson(projections.historicalIndex),
  );
  const byTeamDirectory = join(stagingDirectory, 'by-team');
  await mkdir(byTeamDirectory);
  await Promise.all([...projections.historicalByTeam].map(([fileName, teamData]) => {
    return writeFile(
      join(byTeamDirectory, fileName),
      compactJson(teamData),
    );
  }));

  await mkdir(dirname(outputDirectory), { recursive: true });
  await replaceDirectory(stagingDirectory, outputDirectory);
  return { targetDirectory: outputDirectory, audits };
};

const main = async () => {
  const result = await runTransformGameHistory({
    options: parseTransformGameHistoryArgs(process.argv.slice(2)),
  });
  for (const audit of result.audits) {
    console.log(
      `Built ${audit.year}: ${audit.sourceRecords} source records, ` +
      `${audit.rankingSnapshots} ranking snapshots, ` +
      `${audit.retainedGames} retained games, ${audit.venues} venues, ` +
      `${audit.namedGames} named games, ` +
      `${audit.rankedTeamAppearances} ranked team appearances.`,
    );
  }
  console.log(`Wrote game-history data to ${result.targetDirectory}.`);
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
