/// <reference types="node" />
import { access, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateBettingOddsData,
  validateConferencesData,
  validateHistoryData,
  validateNamesData,
  validatePrestigeConfig,
  validateSeasonIndexData,
  validateStatesData,
  validateTeamsData,
} from '../src/domain/baseDataValidation';
import {
  validateHistoricalGamesForTeam,
  validateHistoricalGamesIndex,
  validateHistoricalGamesSeason,
} from '../src/domain/historicalGames';
import { normalizeRivalriesData } from '../src/domain/rivalryData';
import { validateSeasonData } from '../src/domain/seasonDataValidation';
import type {
  SeasonData,
  TeamsData,
} from '../src/types/baseData';
import {
  buildDataOutputs,
  type DataBuildOutputs,
} from './data_build';
import {
  compactJson,
  DATA_ROOT,
  prettyJson,
  readJson,
} from './data_files';
import { buildStartingPrestigeCandidates } from './generate_starting_prestige';

const HISTORICAL_GAME_COVERAGE_EXCEPTIONS = new Map([
  [2020, new Set(['New Mexico State'])],
]);

const describeError = (source: string, error: unknown) =>
  `${source}: ${error instanceof Error ? error.message : String(error)}`;

const assignmentsFor = (season: SeasonData) => new Map<string, string>([
  ...Object.entries(season.conferences).flatMap(([conference, definition]) =>
    Object.keys(definition.teams).map(team => [team, conference] as const)),
  ...Object.keys(season.independents).map(team => [team, 'Independent'] as const),
]);

const prestigesFor = (season: SeasonData) => new Map<string, number>([
  ...Object.values(season.conferences).flatMap(conference =>
    Object.entries(conference.teams)),
  ...Object.entries(season.independents),
]);

const validatePrestigeBounds = (
  season: SeasonData,
  teams: TeamsData,
  errors: string[],
) => {
  const prestiges = prestigesFor(season);
  for (const [team, prestige] of prestiges) {
    const metadata = teams.teams[team];
    if (metadata && (prestige < metadata.floor || prestige > metadata.ceiling)) {
      errors.push(
        `seasons/${season.year}.json: ${team} prestige ${prestige} is outside ` +
        `metadata bounds ${metadata.floor}-${metadata.ceiling}.`,
      );
    }
  }
};

const readValidated = async <T,>(
  path: string,
  source: string,
  validate: (value: unknown, source: string) => T,
  errors: string[],
): Promise<T | null> => {
  try {
    return validate(await readJson<unknown>(path), source);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : describeError(source, error));
    return null;
  }
};

const compareFile = async (
  path: string,
  source: string,
  expected: string,
  errors: string[],
) => {
  try {
    if (await readFile(path, 'utf8') !== expected) {
      errors.push(`${source}: generated content is stale; run npm run data:build.`);
    }
  } catch (error) {
    errors.push(describeError(source, error));
  }
};

export const checkData = async (
  dataRoot = DATA_ROOT,
  buildOutputs: () => Promise<DataBuildOutputs> = () => buildDataOutputs(dataRoot),
): Promise<string[]> => {
  const errors: string[] = [];
  const seasonsDirectory = join(dataRoot, 'seasons');
  const historicalDirectory = join(dataRoot, 'historical-games');

  const [teams, conferences, prestigeConfig] = await Promise.all([
    readValidated(join(dataRoot, 'teams.json'), 'teams.json', validateTeamsData, errors),
    readValidated(join(dataRoot, 'conferences.json'), 'conferences.json', validateConferencesData, errors),
    readValidated(join(dataRoot, 'prestige_config.json'), 'prestige_config.json', validatePrestigeConfig, errors),
    readValidated(join(dataRoot, 'names.json'), 'names.json', validateNamesData, errors),
    readValidated(join(dataRoot, 'states.json'), 'states.json', validateStatesData, errors),
    readValidated(join(dataRoot, 'betting_odds.json'), 'betting_odds.json', validateBettingOddsData, errors),
    readValidated(join(dataRoot, 'history.json'), 'history.json', validateHistoryData, errors),
  ] as const);

  if (teams) {
    try {
      normalizeRivalriesData(
        await readJson<unknown>(join(dataRoot, 'rivalries.json')),
        new Set(Object.keys(teams.teams)),
      );
    } catch (error) {
      errors.push(describeError('rivalries.json', error));
    }
  } else {
    errors.push('rivalries.json: teams.json is unavailable for reference validation.');
  }

  let seasonYears: string[] = [];
  try {
    seasonYears = (await readdir(seasonsDirectory))
      .filter(name => /^\d{4}\.json$/.test(name))
      .map(name => name.slice(0, 4))
      .sort((left, right) => Number(right) - Number(left));
  } catch (error) {
    errors.push(describeError('seasons', error));
  }

  const seasonIndex = await readValidated(
    join(seasonsDirectory, 'index.json'),
    'seasons/index.json',
    validateSeasonIndexData,
    errors,
  );
  if (seasonIndex && JSON.stringify(seasonIndex.years) !== JSON.stringify(seasonYears)) {
    errors.push(
      `seasons/index.json: years do not match season files; expected ` +
      `[${seasonYears.join(', ')}].`,
    );
  }

  const seasons: SeasonData[] = [];
  const teamsWithGamesByYear = new Map<number, Set<string>>();
  const referencedTeams = new Set<string>();
  const referencedConferences = new Set<string>();
  for (const year of seasonYears) {
    try {
      const season = validateSeasonData(
        await readJson<unknown>(join(seasonsDirectory, `${year}.json`)),
        `seasons/${year}.json`,
        Number(year),
      );
      seasons.push(season);
      const assignments = assignmentsFor(season);
      teamsWithGamesByYear.set(
        season.year,
        new Set(Object.entries(season.results ?? {})
          .filter(([, result]) => result.wins + result.losses > 0)
          .map(([team]) => team)),
      );
      assignments.forEach((_conference, team) => referencedTeams.add(team));
      Object.keys(season.conferences).forEach(conference =>
        referencedConferences.add(conference));
      if (teams) {
        validatePrestigeBounds(season, teams, errors);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : describeError(`seasons/${year}.json`, error));
    }
  }

  const scheduled = seasons.filter(season => season.results === null);
  if (scheduled.some(season => String(season.year) !== seasonYears[0])) {
    errors.push(
      `seasons: only the newest season may have null results; found ` +
      `${scheduled.filter(season => String(season.year) !== seasonYears[0]).map(season => season.year).join(', ')}.`,
    );
  }
  const completedYears = new Set(
    seasons.filter(season => season.results !== null).map(season => season.year),
  );

  if (teams && prestigeConfig && seasons.length === seasonYears.length) {
    try {
      const generated = buildStartingPrestigeCandidates({
        seasons,
        teams,
        prestigeConfig,
      });
      for (const audit of generated.audits.filter(entry => entry.changed)) {
        const examples = audit.teamAudits
          .filter(team => team.before !== team.after)
          .slice(0, 5)
          .map(team => `${team.team} ${team.before}->${team.after}`);
        errors.push(
          `seasons/${audit.year}.json: ${audit.changed} generated starting ` +
          `prestige value(s) are stale (${examples.join(', ')}); run ` +
          '`npm run generate:starting-prestige -- --write`.',
        );
      }
    } catch (error) {
      errors.push(describeError('generated starting prestige', error));
    }
  }

  for (const team of referencedTeams) {
    if (!teams?.teams[team]) errors.push(`teams.json: missing metadata for ${team}.`);
    try {
      await access(join(dataRoot, '..', 'logos', 'teams', `${team}.png`));
    } catch {
      errors.push(`team logos: missing ${team}.png.`);
    }
  }
  for (const conference of referencedConferences) {
    if (!conferences?.[conference]) {
      errors.push(`conferences.json: missing metadata for ${conference}.`);
    }
  }

  let historicalYears: number[] = [];
  try {
    historicalYears = (await readdir(historicalDirectory))
      .filter(name => /^\d{4}\.json$/.test(name))
      .map(name => Number(name.slice(0, 4)))
      .sort((left, right) => left - right);
  } catch (error) {
    errors.push(describeError('historical-games', error));
  }
  const historicalIndex = await readValidated(
    join(historicalDirectory, 'index.json'),
    'historical-games/index.json',
    (value, _source) => validateHistoricalGamesIndex(value),
    errors,
  );
  if (historicalIndex) {
    const missing = historicalIndex.years.filter(year => !historicalYears.includes(year));
    const unexpected = historicalYears.filter(year => !historicalIndex.years.includes(year));
    if (missing.length || unexpected.length) {
      errors.push(
        `historical-games files: missing [${missing.join(', ')}]; ` +
        `unexpected [${unexpected.join(', ')}].`,
      );
    }
  }
  const historicalSeasons = [];
  for (const year of historicalYears) {
    try {
      const season = validateHistoricalGamesSeason(
        await readJson<unknown>(join(historicalDirectory, `${year}.json`)),
        year,
      );
      historicalSeasons.push(season);
      if (!completedYears.has(year)) {
        errors.push(`historical-games/${year}.json: season results are not complete.`);
      }
      const participants = new Set(season.games.flatMap(game => [game.homeTeam, game.awayTeam]));
      const coverageExceptions = HISTORICAL_GAME_COVERAGE_EXCEPTIONS.get(year);
      const missingActiveTeams = [...(teamsWithGamesByYear.get(year) ?? [])]
        .filter(team =>
          !participants.has(team) && !coverageExceptions?.has(team));
      if (missingActiveTeams.length) {
        errors.push(
          `historical-games/${year}.json: active programs without games ` +
          `[${missingActiveTeams.sort().join(', ')}].`,
        );
      }
      if (teams) {
        for (const game of season.games) {
          if (!teams.teams[game.homeTeam] && !teams.teams[game.awayTeam]) {
            errors.push(
              `historical-games/${year}.json: game ${game.sourceId} does not involve a supported program.`,
            );
          }
        }
      }
    } catch (error) {
      errors.push(describeError(`historical-games/${year}.json`, error));
    }
  }

  try {
    const outputs = await buildOutputs();
    await Promise.all([
      compareFile(join(seasonsDirectory, 'index.json'), 'seasons/index.json', prettyJson(outputs.seasonIndex), errors),
      compareFile(join(dataRoot, 'history.json'), 'history.json', prettyJson(outputs.history), errors),
      compareFile(join(dataRoot, 'betting_odds.json'), 'betting_odds.json', prettyJson(outputs.bettingOdds), errors),
      compareFile(join(historicalDirectory, 'index.json'), 'historical-games/index.json', prettyJson(outputs.historicalIndex), errors),
    ]);

    const byTeamDirectory = join(historicalDirectory, 'by-team');
    let actualFiles: string[] = [];
    try {
      actualFiles = (await readdir(byTeamDirectory)).sort();
    } catch (error) {
      errors.push(describeError('historical-games/by-team', error));
    }
    const expectedFiles = [...outputs.historicalByTeam.keys()].sort();
    const missing = expectedFiles.filter(file => !actualFiles.includes(file));
    const extra = actualFiles.filter(file => !expectedFiles.includes(file));
    if (missing.length || extra.length) {
      errors.push(
        `historical-games/by-team: missing [${missing.join(', ')}]; ` +
        `unexpected [${extra.join(', ')}].`,
      );
    }
    const availableYears = new Set(outputs.historicalIndex.years);
    await Promise.all([...outputs.historicalByTeam].map(async ([fileName, expected]) => {
      if (!actualFiles.includes(fileName)) return;
      try {
        validateHistoricalGamesForTeam(
          await readJson<unknown>(join(byTeamDirectory, fileName)),
          expected.team,
          availableYears,
        );
      } catch (error) {
        errors.push(describeError(`historical-games/by-team/${fileName}`, error));
        return;
      }
      await compareFile(
        join(byTeamDirectory, fileName),
        `historical-games/by-team/${fileName}`,
        compactJson(expected),
        errors,
      );
    }));
  } catch (error) {
    errors.push(describeError('generated data', error));
  }

  return errors;
};

const main = async () => {
  const errors = await checkData();
  if (errors.length) {
    console.error(`Data validation failed with ${errors.length} error(s):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log('Data validation passed.');
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  await main();
}
