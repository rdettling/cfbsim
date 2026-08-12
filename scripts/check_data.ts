/// <reference types="node" />
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateYearData } from '../src/domain/yearDataValidation';
import { normalizeRivalriesData } from '../src/domain/rivalryData';
import {
  buildHistoricalGamesByTeam,
  getHistoricalTeamGamesFileName,
  validateHistoricalGamesForTeam,
  validateHistoricalGamesIndex,
  validateHistoricalGamesSeason,
} from '../src/domain/historicalGames';
import type {
  ConferencesData,
  HistoricalGamesSeason,
  HistoryData,
  SeasonResultsData,
  TeamsData,
  YearData,
} from '../src/types/baseData';
import {
  buildHistoryData,
  comparableHistory,
  DATA_ROOT,
  readJson,
} from './generate_history';

const PRESTIGE_TIERS = [1, 2, 3, 4, 5, 6, 7] as const;
const PRESTIGE_DISTRIBUTION_TOLERANCE = 3;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeyError = (
  value: Record<string, unknown>,
  expectedKeys: string[],
) => {
  const expected = new Set(expectedKeys);
  const missing = expectedKeys.filter(key => !(key in value));
  const extra = Object.keys(value).filter(key => !expected.has(key));
  if (!missing.length && !extra.length) return null;
  return [
    missing.length ? `missing ${missing.join(', ')}` : '',
    extra.length ? `unexpected ${extra.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
};

const readJsonError = (path: string, error: unknown) =>
  `${path}: ${error instanceof Error ? error.message : String(error)}`;

const getAssignments = (yearData: YearData) => {
  const assignments = new Map<string, string>();
  for (const [conferenceName, conference] of Object.entries(
    yearData.conferences,
  )) {
    for (const teamName of Object.keys(conference.teams)) {
      assignments.set(teamName, conferenceName);
    }
  }
  for (const teamName of Object.keys(yearData.independents)) {
    assignments.set(teamName, 'Independent');
  }
  return assignments;
};

const getPrestiges = (yearData: YearData) =>
  new Map<string, number>([
    ...Object.values(yearData.conferences).flatMap(conference =>
      Object.entries(conference.teams),
    ),
    ...Object.entries(yearData.independents),
  ]);

const validateTeamMetadata = (
  value: unknown,
  errors: string[],
): TeamsData | null => {
  if (!isRecord(value) || !isRecord(value.teams)) {
    errors.push('teams.json: expected an object containing a teams object.');
    return null;
  }
  const rootKeyError = exactKeyError(value, ['teams']);
  if (rootKeyError) errors.push(`teams.json: ${rootKeyError}.`);
  const expectedKeys = [
    'mascot',
    'abbreviation',
    'ceiling',
    'floor',
    'colorPrimary',
    'colorSecondary',
    'city',
    'state',
    'stadium',
  ];

  for (const [teamName, rawMetadata] of Object.entries(value.teams)) {
    if (!teamName.trim() || !isRecord(rawMetadata)) {
      errors.push(`teams.json: ${teamName || '<empty>'} metadata is invalid.`);
      continue;
    }
    const keyError = exactKeyError(rawMetadata, expectedKeys);
    if (keyError) errors.push(`teams.json: ${teamName}: ${keyError}.`);
    for (const key of [
      'mascot',
      'abbreviation',
      'city',
      'state',
      'stadium',
    ]) {
      if (
        typeof rawMetadata[key] !== 'string' ||
        !(rawMetadata[key] as string).trim()
      ) {
        errors.push(`teams.json: ${teamName}.${key} must be nonempty.`);
      }
    }
    for (const key of ['colorPrimary', 'colorSecondary']) {
      if (
        typeof rawMetadata[key] !== 'string' ||
        !/^#[0-9A-F]{6}$/i.test(rawMetadata[key] as string)
      ) {
        errors.push(
          `teams.json: ${teamName}.${key} must be a six-digit hex color.`,
        );
      }
    }
    const floor = rawMetadata.floor;
    const ceiling = rawMetadata.ceiling;
    if (
      !Number.isInteger(floor) ||
      !Number.isInteger(ceiling) ||
      (floor as number) < 1 ||
      (ceiling as number) > 7 ||
      (floor as number) > (ceiling as number)
    ) {
      errors.push(
        `teams.json: ${teamName} must have integer prestige bounds from 1 to 7 with floor <= ceiling.`,
      );
    }
  }
  return value as unknown as TeamsData;
};

const validateConferenceMetadata = (
  value: unknown,
  errors: string[],
): ConferencesData | null => {
  if (!isRecord(value)) {
    errors.push('conferences.json: expected an object.');
    return null;
  }
  for (const [conferenceName, fullName] of Object.entries(value)) {
    if (
      !conferenceName.trim() ||
      typeof fullName !== 'string' ||
      !fullName.trim()
    ) {
      errors.push(
        `conferences.json: ${conferenceName || '<empty>'} must have a nonempty full name.`,
      );
    }
  }
  return value as ConferencesData;
};

const validatePrestigeConfig = (
  value: unknown,
  errors: string[],
): Record<number, number> | null => {
  if (!isRecord(value)) {
    errors.push('prestige_config.json: expected an object.');
    return null;
  }
  const keyError = exactKeyError(
    value,
    PRESTIGE_TIERS.map(String),
  );
  if (keyError) errors.push(`prestige_config.json: ${keyError}.`);
  const percentages = PRESTIGE_TIERS.map(tier => value[String(tier)]);
  if (
    percentages.some(
      percentage =>
        typeof percentage !== 'number' ||
        !Number.isFinite(percentage) ||
        percentage < 0 ||
        percentage > 100,
    )
  ) {
    errors.push(
      'prestige_config.json: tier percentages must be finite numbers from 0 to 100.',
    );
    return null;
  }
  const total = (percentages as number[]).reduce(
    (sum, percentage) => sum + percentage,
    0,
  );
  if (Math.abs(total - 100) > 1e-9) {
    errors.push(
      `prestige_config.json: tier percentages must total 100, received ${total}.`,
    );
    return null;
  }
  if (keyError) return null;
  return Object.fromEntries(
    PRESTIGE_TIERS.map(tier => [tier, value[String(tier)] as number]),
  );
};

const validateYearPrestiges = (
  year: string,
  yearData: YearData,
  teamsData: TeamsData | null,
  prestigeConfig: Record<number, number> | null,
  errors: string[],
) => {
  const prestiges = getPrestiges(yearData);
  if (teamsData) {
    for (const [teamName, prestige] of prestiges) {
      const metadata = teamsData.teams[teamName];
      if (
        metadata &&
        (prestige < metadata.floor || prestige > metadata.ceiling)
      ) {
        errors.push(
          `years/${year}.json: ${teamName} prestige ${prestige} is outside metadata bounds ${metadata.floor}-${metadata.ceiling}.`,
        );
      }
    }
  }
  if (!prestigeConfig || !prestiges.size) return;

  for (const tier of PRESTIGE_TIERS) {
    const count = [...prestiges.values()].filter(
      prestige => prestige === tier,
    ).length;
    const actualPercentage = (count / prestiges.size) * 100;
    const targetPercentage = prestigeConfig[tier];
    if (
      Math.abs(actualPercentage - targetPercentage) >
      PRESTIGE_DISTRIBUTION_TOLERANCE
    ) {
      errors.push(
        `years/${year}.json: prestige ${tier} represents ${actualPercentage.toFixed(2)}% of teams; target is ${targetPercentage}% with a ${PRESTIGE_DISTRIBUTION_TOLERANCE}-point tolerance.`,
      );
    }
  }
};

const validateSeasonResults = (
  value: unknown,
  year: string,
  assignments: Map<string, string>,
  errors: string[],
): SeasonResultsData | null => {
  const source = `season-results/${year}.json`;
  if (!isRecord(value) || !Array.isArray(value.teams)) {
    errors.push(`${source}: expected year, total_teams, and a teams array.`);
    return null;
  }
  const rootKeyError = exactKeyError(value, ['year', 'total_teams', 'teams']);
  if (rootKeyError) errors.push(`${source}: ${rootKeyError}.`);
  if (value.year !== Number(year)) {
    errors.push(`${source}: year must equal ${year}.`);
  }
  if (value.total_teams !== value.teams.length) {
    errors.push(`${source}: total_teams must equal the teams array length.`);
  }
  if (value.teams.length !== assignments.size) {
    errors.push(
      `${source}: team count ${value.teams.length} does not match year membership ${assignments.size}.`,
    );
  }

  const seen = new Set<string>();
  for (const [index, rawResult] of value.teams.entries()) {
    if (!isRecord(rawResult)) {
      errors.push(`${source}: teams[${index}] must be an object.`);
      continue;
    }
    const keyError = exactKeyError(rawResult, [
      'team',
      'conference',
      'rank',
      'wins',
      'losses',
    ]);
    if (keyError) errors.push(`${source}: teams[${index}]: ${keyError}.`);
    const teamName = rawResult.team;
    if (typeof teamName !== 'string' || !teamName.trim()) {
      errors.push(`${source}: teams[${index}].team must be nonempty.`);
      continue;
    }
    if (seen.has(teamName)) {
      errors.push(`${source}: duplicate team ${teamName}.`);
    }
    seen.add(teamName);
    const expectedConference = assignments.get(teamName);
    if (!expectedConference) {
      errors.push(`${source}: ${teamName} is not present in year data.`);
    } else if (rawResult.conference !== expectedConference) {
      errors.push(
        `${source}: ${teamName} conference ${String(rawResult.conference)} does not match ${expectedConference}.`,
      );
    }
    if (
      !Number.isInteger(rawResult.rank) ||
      (rawResult.rank as number) < 1 ||
      (rawResult.rank as number) > value.teams.length
    ) {
      errors.push(`${source}: ${teamName}.rank is out of range.`);
    }
    for (const field of ['wins', 'losses'] as const) {
      if (
        !Number.isInteger(rawResult[field]) ||
        (rawResult[field] as number) < 0
      ) {
        errors.push(
          `${source}: ${teamName}.${field} must be a nonnegative integer.`,
        );
      }
    }
  }
  for (const teamName of assignments.keys()) {
    if (!seen.has(teamName)) {
      errors.push(`${source}: missing team ${teamName}.`);
    }
  }
  return value as unknown as SeasonResultsData;
};

const validateHistoryShape = (value: unknown, errors: string[]) => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.years) ||
    !isRecord(value.conf_index) ||
    !isRecord(value.teams)
  ) {
    errors.push(
      'history.json: expected generated_at, years, conf_index, and teams.',
    );
    return false;
  }
  const keyError = exactKeyError(value, [
    'generated_at',
    'years',
    'conf_index',
    'teams',
  ]);
  if (keyError) errors.push(`history.json: ${keyError}.`);
  if (
    typeof value.generated_at !== 'string' ||
    Number.isNaN(Date.parse(value.generated_at))
  ) {
    errors.push('history.json: generated_at must be a valid timestamp.');
  }
  if (value.years.some(year => !Number.isInteger(year))) {
    errors.push('history.json: years must contain only integers.');
  }
  if (
    Object.values(value.conf_index).some(
      id => !Number.isInteger(id) || (id as number) < 0,
    )
  ) {
    errors.push('history.json: conference IDs must be nonnegative integers.');
  }
  for (const [teamName, rows] of Object.entries(value.teams)) {
    if (
      !teamName.trim() ||
      !Array.isArray(rows) ||
      rows.some(
        row =>
          !Array.isArray(row) ||
          row.length !== 6 ||
          row.some(entry => !Number.isInteger(entry)),
      )
    ) {
      errors.push(
        `history.json: ${teamName || '<empty>'} must contain six-integer rows.`,
      );
    }
  }
  return true;
};

export const checkData = async (dataRoot = DATA_ROOT): Promise<string[]> => {
  const errors: string[] = [];
  const yearsDirectory = join(dataRoot, 'years');
  const resultsDirectory = join(dataRoot, 'season-results');
  const historicalGamesDirectory = join(dataRoot, 'historical-games');

  let index: { years: string[] } = { years: [] };
  try {
    const rawIndex = await readJson<unknown>(join(yearsDirectory, 'index.json'));
    if (
      !isRecord(rawIndex) ||
      exactKeyError(rawIndex, ['years']) ||
      !Array.isArray(rawIndex.years) ||
      rawIndex.years.some(
        year => typeof year !== 'string' || !/^\d{4}$/.test(year),
      )
    ) {
      errors.push(
        'years/index.json: expected exactly one years array of four-digit strings.',
      );
    } else {
      index = rawIndex as unknown as { years: string[] };
    }
  } catch (error) {
    errors.push(readJsonError('years/index.json', error));
  }

  const duplicateYears = index.years.filter(
    (year, position) => index.years.indexOf(year) !== position,
  );
  if (duplicateYears.length) {
    errors.push(
      `years/index.json: duplicate years ${[...new Set(duplicateYears)].join(', ')}.`,
    );
  }
  const descendingYears = [...index.years].sort(
    (left, right) => Number(right) - Number(left),
  );
  if (index.years.join(',') !== descendingYears.join(',')) {
    errors.push('years/index.json: years must be in descending order.');
  }

  let yearFiles: string[] = [];
  let resultFiles: string[] = [];
  try {
    yearFiles = (await readdir(yearsDirectory))
      .filter(name => /^\d{4}\.json$/.test(name))
      .map(name => name.slice(0, 4))
      .sort((left, right) => Number(right) - Number(left));
  } catch (error) {
    errors.push(readJsonError('years directory', error));
  }
  try {
    resultFiles = (await readdir(resultsDirectory))
      .filter(name => /^\d{4}\.json$/.test(name))
      .map(name => name.slice(0, 4))
      .sort((left, right) => Number(right) - Number(left));
  } catch (error) {
    errors.push(readJsonError('season-results directory', error));
  }
  const missingYearFiles = index.years.filter(year => !yearFiles.includes(year));
  const extraYearFiles = yearFiles.filter(year => !index.years.includes(year));
  if (missingYearFiles.length || extraYearFiles.length) {
    errors.push(
      `year files: missing [${missingYearFiles.join(', ')}]; unexpected [${extraYearFiles.join(', ')}].`,
    );
  }

  const missingCompletedResults = index.years
    .slice(1)
    .filter(year => !resultFiles.includes(year));
  const extraResultFiles = resultFiles.filter(
    year => !index.years.includes(year),
  );
  if (missingCompletedResults.length || extraResultFiles.length) {
    errors.push(
      `season-results files: missing completed [${missingCompletedResults.join(', ')}]; unexpected [${extraResultFiles.join(', ')}].`,
    );
  }

  let teamsData: TeamsData | null = null;
  let conferencesData: ConferencesData | null = null;
  let prestigeConfig: Record<number, number> | null = null;
  try {
    teamsData = validateTeamMetadata(
      await readJson<unknown>(join(dataRoot, 'teams.json')),
      errors,
    );
  } catch (error) {
    errors.push(readJsonError('teams.json', error));
  }
  try {
    conferencesData = validateConferenceMetadata(
      await readJson<unknown>(join(dataRoot, 'conferences.json')),
      errors,
    );
  } catch (error) {
    errors.push(readJsonError('conferences.json', error));
  }
  try {
    prestigeConfig = validatePrestigeConfig(
      await readJson<unknown>(join(dataRoot, 'prestige_config.json')),
      errors,
    );
  } catch (error) {
    errors.push(readJsonError('prestige_config.json', error));
  }
  try {
    const rawRivalries = await readJson<unknown>(join(dataRoot, 'rivalries.json'));
    if (!teamsData) {
      errors.push('rivalries.json: team metadata is unavailable for validation.');
    } else {
      normalizeRivalriesData(rawRivalries, new Set(Object.keys(teamsData.teams)));
    }
  } catch (error) {
    errors.push(readJsonError('rivalries.json', error));
  }

  const referencedTeams = new Set<string>();
  const referencedConferences = new Set<string>();
  const activeTeamsByYear = new Map<number, Set<string>>();
  for (const year of index.years) {
    let yearData: YearData | null = null;
    try {
      yearData = validateYearData(
        await readJson<unknown>(join(yearsDirectory, `${year}.json`)),
        `years/${year}.json`,
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    if (!yearData) continue;

    validateYearPrestiges(
      year,
      yearData,
      teamsData,
      prestigeConfig,
      errors,
    );
    const assignments = getAssignments(yearData);
    activeTeamsByYear.set(Number(year), new Set(assignments.keys()));
    for (const teamName of assignments.keys()) referencedTeams.add(teamName);
    for (const conferenceName of Object.keys(yearData.conferences)) {
      referencedConferences.add(conferenceName);
    }
    if (resultFiles.includes(year)) {
      try {
        validateSeasonResults(
          await readJson<unknown>(join(resultsDirectory, `${year}.json`)),
          year,
          assignments,
          errors,
        );
      } catch (error) {
        errors.push(readJsonError(`season-results/${year}.json`, error));
      }
    }
  }

  for (const teamName of referencedTeams) {
    if (!teamsData?.teams[teamName]) {
      errors.push(`teams.json: missing metadata for ${teamName}.`);
    }
    try {
      await access(
        join(dataRoot, '..', 'logos', 'teams', `${teamName}.png`),
      );
    } catch {
      errors.push(`team logos: missing ${teamName}.png.`);
    }
  }
  for (const conferenceName of referencedConferences) {
    if (!conferencesData?.[conferenceName]) {
      errors.push(
        `conferences.json: missing metadata for ${conferenceName}.`,
      );
    }
  }

  try {
    const currentHistory = await readJson<unknown>(
      join(dataRoot, 'history.json'),
    );
    if (validateHistoryShape(currentHistory, errors)) {
      try {
        const expectedHistory = await buildHistoryData(dataRoot);
        if (
          JSON.stringify(
            comparableHistory(currentHistory as unknown as HistoryData),
          ) !== JSON.stringify(comparableHistory(expectedHistory))
        ) {
          errors.push(
            'history.json: generated content is stale; run npm run generate:history.',
          );
        }
      } catch (error) {
        errors.push(
          `history generation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    errors.push(readJsonError('history.json', error));
  }

  try {
    const historicalIndex = validateHistoricalGamesIndex(
      await readJson<unknown>(join(historicalGamesDirectory, 'index.json')),
    );
    let seasonFiles: number[] = [];
    try {
      seasonFiles = (await readdir(historicalGamesDirectory))
        .filter(name => /^\d{4}\.json$/.test(name))
        .map(name => Number(name.slice(0, 4)))
        .sort((left, right) => left - right);
    } catch (error) {
      errors.push(readJsonError('historical-games directory', error));
    }
    const missingFiles = historicalIndex.years.filter(
      year => !seasonFiles.includes(year),
    );
    const orphanFiles = seasonFiles.filter(
      year => !historicalIndex.years.includes(year),
    );
    if (missingFiles.length || orphanFiles.length) {
      errors.push(
        `historical-games files: missing [${missingFiles.join(', ')}]; ` +
        `unexpected [${orphanFiles.join(', ')}].`,
      );
    }
    const incompleteYears = historicalIndex.years.filter(
      year => !resultFiles.includes(String(year)),
    );
    if (incompleteYears.length) {
      errors.push(
        `historical-games/index.json: unavailable completed seasons ` +
        `[${incompleteYears.join(', ')}].`,
      );
    }
    const supportedTeams = teamsData
      ? new Set(Object.keys(teamsData.teams))
      : null;
    const historicalSeasons: HistoricalGamesSeason[] = [];
    for (const year of historicalIndex.years) {
      if (!seasonFiles.includes(year)) continue;
      try {
        const season = validateHistoricalGamesSeason(
          await readJson<unknown>(
            join(historicalGamesDirectory, `${year}.json`),
          ),
          year,
        );
        historicalSeasons.push(season);
        if (!supportedTeams) continue;
        for (const game of season.games) {
          if (
            !supportedTeams.has(game.homeTeam) &&
            !supportedTeams.has(game.awayTeam)
          ) {
            errors.push(
              `historical-games/${year}.json: game ${game.sourceId} ` +
              'does not involve a supported program.',
            );
          }
        }
        const participants = new Set(
          season.games.flatMap(game => [game.homeTeam, game.awayTeam]),
        );
        const missingTeams = [...(activeTeamsByYear.get(year) ?? [])]
          .filter(teamName => !participants.has(teamName))
          .sort((left, right) => left.localeCompare(right));
        if (missingTeams.length) {
          errors.push(
            `historical-games/${year}.json: active programs without games ` +
            `[${missingTeams.join(', ')}].`,
          );
        }
      } catch (error) {
        errors.push(readJsonError(`historical-games/${year}.json`, error));
      }
    }

    if (supportedTeams) {
      const byTeamDirectory = join(historicalGamesDirectory, 'by-team');
      let teamFiles: string[] = [];
      try {
        teamFiles = (await readdir(byTeamDirectory))
          .sort((left, right) => left.localeCompare(right));
      } catch (error) {
        errors.push(readJsonError('historical-games/by-team directory', error));
      }
      const expectedLookups = buildHistoricalGamesByTeam(
        historicalSeasons,
        supportedTeams,
      );
      const expectedFiles = expectedLookups.map(entry =>
        getHistoricalTeamGamesFileName(entry.team)
      );
      const missingTeamFiles = expectedFiles.filter(name => !teamFiles.includes(name));
      const orphanTeamFiles = teamFiles.filter(name => !expectedFiles.includes(name));
      if (missingTeamFiles.length || orphanTeamFiles.length) {
        errors.push(
          `historical-games/by-team files: missing ` +
          `[${missingTeamFiles.join(', ')}]; unexpected ` +
          `[${orphanTeamFiles.join(', ')}].`,
        );
      }
      const availableYears = new Set(historicalIndex.years);
      if (historicalSeasons.length === historicalIndex.years.length) {
        for (const expected of expectedLookups) {
          const fileName = getHistoricalTeamGamesFileName(expected.team);
          if (!teamFiles.includes(fileName)) continue;
          try {
            const actual = validateHistoricalGamesForTeam(
              await readJson<unknown>(join(byTeamDirectory, fileName)),
              expected.team,
              availableYears,
            );
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              errors.push(
                `historical-games/by-team/${fileName}: generated content is stale.`,
              );
            }
          } catch (error) {
            errors.push(readJsonError(`historical-games/by-team/${fileName}`, error));
          }
        }
      }
    }
  } catch (error) {
    errors.push(readJsonError('historical-games/index.json', error));
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main();
}
