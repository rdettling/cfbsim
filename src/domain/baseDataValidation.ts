import type {
  BettingOddsData,
  ConferencesData,
  HistoryData,
  HistoryRow,
  NamesData,
  PrestigeConfig,
  SeasonIndexData,
  StatesData,
  TeamsData,
} from '../types/baseData';

export const BETTING_ODDS_SEED = 20260812;
export const BETTING_ODDS_SIMULATIONS = 1000;
export const BETTING_ODDS_MAX_DIFF = 100;

const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
] as const;

const PRESTIGE_TIERS = ['1', '2', '3', '4', '5', '6', '7'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (source: string, field: string, message: string): never => {
  throw new Error(`${source}: ${field} ${message}`);
};

const assertRecord = (
  value: unknown,
  source: string,
  field: string,
): Record<string, unknown> => {
  if (!isRecord(value)) {
    fail(source, field, 'must be an object.');
  }
  return value as Record<string, unknown>;
};

const assertExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  source: string,
  field: string,
) => {
  const expected = new Set(expectedKeys);
  const missing = expectedKeys.filter(key => !(key in value));
  const extra = Object.keys(value).filter(key => !expected.has(key));
  if (!missing.length && !extra.length) return;
  const details = [
    missing.length ? `missing ${missing.join(', ')}` : '',
    extra.length ? `unexpected ${extra.join(', ')}` : '',
  ].filter(Boolean).join('; ');
  fail(source, field, `has invalid fields (${details}).`);
};

const assertNonemptyString = (
  value: unknown,
  source: string,
  field: string,
) => {
  if (typeof value !== 'string' || !value.trim()) {
    fail(source, field, 'must be a nonempty string.');
  }
};

export const validateSeasonIndexData = (
  value: unknown,
  source = 'seasons/index.json',
): SeasonIndexData => {
  const data = assertRecord(value, source, 'index');
  assertExactKeys(data, ['years'], source, 'index');
  if (
    !Array.isArray(data.years) ||
    data.years.some(year => typeof year !== 'string' || !/^\d{4}$/.test(year))
  ) {
    fail(source, 'years', 'must contain four-digit strings.');
  }
  const years = data.years as string[];
  if (new Set(years).size !== years.length) {
    fail(source, 'years', 'must not contain duplicates.');
  }
  if (years.some((year, index) => index > 0 && Number(year) >= Number(years[index - 1]))) {
    fail(source, 'years', 'must be strictly descending.');
  }
  return data as unknown as SeasonIndexData;
};

export const validateTeamsData = (
  value: unknown,
  source = 'teams.json',
): TeamsData => {
  const data = assertRecord(value, source, 'data');
  assertExactKeys(data, ['teams'], source, 'data');
  const teams = assertRecord(data.teams, source, 'teams');
  if (!Object.keys(teams).length) fail(source, 'teams', 'must not be empty.');
  const metadataKeys = [
    'mascot', 'abbreviation', 'ceiling', 'floor', 'colorPrimary',
    'colorSecondary', 'city', 'state', 'stadium',
  ] as const;
  for (const [teamName, rawMetadata] of Object.entries(teams)) {
    assertNonemptyString(teamName, source, 'team name');
    const metadata = assertRecord(rawMetadata, source, `teams.${teamName}`);
    assertExactKeys(metadata, metadataKeys, source, `teams.${teamName}`);
    for (const key of ['mascot', 'abbreviation', 'city', 'state', 'stadium'] as const) {
      assertNonemptyString(metadata[key], source, `teams.${teamName}.${key}`);
    }
    for (const key of ['colorPrimary', 'colorSecondary'] as const) {
      if (typeof metadata[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(metadata[key])) {
        fail(source, `teams.${teamName}.${key}`, 'must be a six-digit hex color.');
      }
    }
    if (
      !Number.isInteger(metadata.floor) || !Number.isInteger(metadata.ceiling) ||
      Number(metadata.floor) < 1 || Number(metadata.ceiling) > 7 ||
      Number(metadata.floor) > Number(metadata.ceiling)
    ) {
      fail(source, `teams.${teamName}`, 'must have integer prestige bounds from 1 to 7 with floor <= ceiling.');
    }
  }
  return data as unknown as TeamsData;
};

export const validateConferencesData = (
  value: unknown,
  source = 'conferences.json',
): ConferencesData => {
  const data = assertRecord(value, source, 'data');
  if (!Object.keys(data).length) fail(source, 'data', 'must not be empty.');
  for (const [conference, fullName] of Object.entries(data)) {
    assertNonemptyString(conference, source, 'conference name');
    assertNonemptyString(fullName, source, conference);
  }
  return data as ConferencesData;
};

export const validatePrestigeConfig = (
  value: unknown,
  source = 'prestige_config.json',
): PrestigeConfig => {
  const data = assertRecord(value, source, 'data');
  assertExactKeys(data, PRESTIGE_TIERS, source, 'data');
  let total = 0;
  for (const tier of PRESTIGE_TIERS) {
    const percentage = data[tier];
    if (typeof percentage !== 'number' || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      fail(source, tier, 'must be a finite number from 0 to 100.');
    }
    total += percentage as number;
  }
  if (Math.abs(total - 100) > 1e-9) fail(source, 'data', `must total 100; received ${total}.`);
  return data as PrestigeConfig;
};

export const validateNamesData = (
  value: unknown,
  source = 'names.json',
): NamesData => {
  const data = assertRecord(value, source, 'data');
  assertExactKeys(data, ['black', 'white'], source, 'data');
  for (const category of ['black', 'white'] as const) {
    const group = assertRecord(data[category], source, category);
    assertExactKeys(group, ['first', 'last'], source, category);
    for (const kind of ['first', 'last'] as const) {
      const entries = group[kind];
      if (!Array.isArray(entries) || !entries.length) fail(source, `${category}.${kind}`, 'must be a nonempty array.');
      const nameEntries = entries as unknown[];
      for (let index = 0; index < nameEntries.length; index += 1) {
        const entry = assertRecord(nameEntries[index], source, `${category}.${kind}[${index}]`);
        assertExactKeys(entry, ['name', 'weight'], source, `${category}.${kind}[${index}]`);
        assertNonemptyString(entry.name, source, `${category}.${kind}[${index}].name`);
        if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight <= 0) {
          fail(source, `${category}.${kind}[${index}].weight`, 'must be a positive finite number.');
        }
      }
    }
  }
  return data as unknown as NamesData;
};

export const validateStatesData = (
  value: unknown,
  source = 'states.json',
): StatesData => {
  const data = assertRecord(value, source, 'data');
  assertExactKeys(data, STATE_CODES, source, 'data');
  let total = 0;
  for (const state of STATE_CODES) {
    const weight = data[state];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
      fail(source, state, 'must be a finite nonnegative number.');
    }
    total += weight as number;
  }
  if (total <= 0) fail(source, 'data', 'must have a positive total weight.');
  return data as StatesData;
};

const isSpread = (value: unknown) =>
  value === 'Even' || (typeof value === 'string' && /^[+-]\d+(?:\.5)?$/.test(value));
const isMoneyline = (value: unknown) =>
  typeof value === 'string' && /^[+-]\d+$/.test(value);

export const validateBettingOddsData = (
  value: unknown,
  source = 'betting_odds.json',
): BettingOddsData => {
  const data = assertRecord(value, source, 'data');
  assertExactKeys(data, ['seed', 'test_simulations', 'max_diff', 'odds'], source, 'data');
  if (data.seed !== BETTING_ODDS_SEED) fail(source, 'seed', `must equal ${BETTING_ODDS_SEED}.`);
  if (data.test_simulations !== BETTING_ODDS_SIMULATIONS) fail(source, 'test_simulations', `must equal ${BETTING_ODDS_SIMULATIONS}.`);
  if (data.max_diff !== BETTING_ODDS_MAX_DIFF) fail(source, 'max_diff', `must equal ${BETTING_ODDS_MAX_DIFF}.`);
  const odds = assertRecord(data.odds, source, 'odds');
  const expectedKeys = Array.from({ length: BETTING_ODDS_MAX_DIFF + 1 }, (_, index) => String(index));
  assertExactKeys(odds, expectedKeys, source, 'odds');
  const entryKeys = ['favSpread', 'udSpread', 'favWinProb', 'udWinProb', 'favMoneyline', 'udMoneyline'];
  for (const key of expectedKeys) {
    const entry = assertRecord(odds[key], source, `odds.${key}`);
    assertExactKeys(entry, entryKeys, source, `odds.${key}`);
    if (!isSpread(entry.favSpread) || !isSpread(entry.udSpread)) fail(source, `odds.${key}`, 'contains an invalid spread.');
    if (!isMoneyline(entry.favMoneyline) || !isMoneyline(entry.udMoneyline)) fail(source, `odds.${key}`, 'contains an invalid moneyline.');
    for (const probability of ['favWinProb', 'udWinProb'] as const) {
      if (typeof entry[probability] !== 'number' || !Number.isFinite(entry[probability]) || entry[probability] < 0 || entry[probability] > 1) {
        fail(source, `odds.${key}.${probability}`, 'must be a finite number from 0 to 1.');
      }
    }
    if (Math.abs(Number(entry.favWinProb) + Number(entry.udWinProb) - 1) > 1e-9) {
      fail(source, `odds.${key}`, 'win probabilities must total 1.');
    }
  }
  return data as unknown as BettingOddsData;
};

export const validateHistoryData = (
  value: unknown,
  source = 'history.json',
): HistoryData => {
  const data = assertRecord(value, source, 'data');
  assertExactKeys(data, ['years', 'conf_index', 'teams'], source, 'data');
  if (!Array.isArray(data.years) || data.years.some(year => !Number.isInteger(year))) {
    fail(source, 'years', 'must contain integers.');
  }
  const years = data.years as number[];
  if (new Set(years).size !== years.length || years.some((year, index) => index > 0 && year >= years[index - 1])) {
    fail(source, 'years', 'must be unique and strictly descending.');
  }
  const confIndex = assertRecord(data.conf_index, source, 'conf_index');
  const conferenceIds = Object.values(confIndex);
  if (conferenceIds.some(id => !Number.isInteger(id) || Number(id) < 0) ||
      new Set(conferenceIds).size !== conferenceIds.length) {
    fail(source, 'conf_index', 'must contain unique nonnegative integer IDs.');
  }
  const teams = assertRecord(data.teams, source, 'teams');
  for (const [teamName, rawRows] of Object.entries(teams)) {
    assertNonemptyString(teamName, source, 'team name');
    if (!Array.isArray(rawRows)) fail(source, `teams.${teamName}`, 'must be an array.');
    const rows = rawRows as unknown[];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!Array.isArray(row) || row.length !== 6 || row.some(entry => !Number.isInteger(entry))) {
        fail(source, `teams.${teamName}[${index}]`, 'must be a six-integer history row.');
      }
      const [year, conferenceId, rank, wins, losses, prestige] = row as HistoryRow;
      if (!years.includes(year)) fail(source, `teams.${teamName}[${index}].year`, 'must occur in years.');
      if (!conferenceIds.includes(conferenceId)) fail(source, `teams.${teamName}[${index}].conferenceId`, 'must occur in conf_index.');
      if (rank < 1 || wins < 0 || losses < 0 || prestige < 1 || prestige > 7) {
        fail(source, `teams.${teamName}[${index}]`, 'contains an out-of-range value.');
      }
    }
  }
  return data as unknown as HistoryData;
};
