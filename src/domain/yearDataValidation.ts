import type { YearData } from '../types/baseData';

export class YearDataValidationError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
    this.name = 'YearDataValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertRecord = (
  value: unknown,
  source: string,
  field: string,
): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new YearDataValidationError(source, `${field} must be an object.`);
  }
  return value;
};

const assertExactKeys = (
  value: Record<string, unknown>,
  keys: string[],
  source: string,
  field: string,
) => {
  const expected = new Set(keys);
  const missing = keys.filter(key => !(key in value));
  const extra = Object.keys(value).filter(key => !expected.has(key));
  if (missing.length || extra.length) {
    const details = [
      missing.length ? `missing ${missing.join(', ')}` : '',
      extra.length ? `unexpected ${extra.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    throw new YearDataValidationError(
      source,
      `${field} has invalid fields (${details}).`,
    );
  }
};

const assertNonemptyName = (name: string, source: string, field: string) => {
  if (!name.trim()) {
    throw new YearDataValidationError(source, `${field} must not be empty.`);
  }
};

const assertPrestige = (
  value: unknown,
  source: string,
  teamName: string,
) => {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 7) {
    throw new YearDataValidationError(
      source,
      `prestige for ${teamName} must be an integer from 1 to 7.`,
    );
  }
};

export const validateYearData = (
  value: unknown,
  source: string,
): YearData => {
  const data = assertRecord(value, source, 'year data');
  assertExactKeys(
    data,
    ['playoff', 'conferences', 'independents'],
    source,
    'year data',
  );

  const playoff = assertRecord(data.playoff, source, 'playoff');
  assertExactKeys(
    playoff,
    ['teams', 'conf_champ_top_4', 'conf_champ_autobids'],
    source,
    'playoff',
  );
  const playoffTeams = playoff.teams;
  const autobids = playoff.conf_champ_autobids;
  const topFour = playoff.conf_champ_top_4;
  if (
    typeof playoffTeams !== 'number' ||
    ![2, 4, 12].includes(playoffTeams)
  ) {
    throw new YearDataValidationError(
      source,
      'playoff.teams must be 2, 4, or 12.',
    );
  }
  if (
    !Number.isInteger(autobids) ||
    (autobids as number) < 0 ||
    (autobids as number) > 10
  ) {
    throw new YearDataValidationError(
      source,
      'playoff.conf_champ_autobids must be an integer from 0 to 10.',
    );
  }
  if (typeof topFour !== 'boolean') {
    throw new YearDataValidationError(
      source,
      'playoff.conf_champ_top_4 must be a boolean.',
    );
  }
  if (
    (playoffTeams === 2 || playoffTeams === 4) &&
    (autobids !== 0 || topFour)
  ) {
    throw new YearDataValidationError(
      source,
      '2- and 4-team playoffs must use 0 autobids and false top-four seeding.',
    );
  }
  if (playoffTeams === 12 && topFour && (autobids as number) < 4) {
    throw new YearDataValidationError(
      source,
      'top-four conference champion seeding requires at least 4 autobids.',
    );
  }

  const conferences = assertRecord(
    data.conferences,
    source,
    'conferences',
  );
  const independents = assertRecord(
    data.independents,
    source,
    'independents',
  );
  const assignedTeams = new Map<string, string>();

  for (const [conferenceName, rawConference] of Object.entries(conferences)) {
    assertNonemptyName(conferenceName, source, 'conference name');
    const conference = assertRecord(
      rawConference,
      source,
      `conference ${conferenceName}`,
    );
    assertExactKeys(
      conference,
      ['games', 'teams'],
      source,
      `conference ${conferenceName}`,
    );
    const teams = assertRecord(
      conference.teams,
      source,
      `conference ${conferenceName}.teams`,
    );
    const games = conference.games;
    const maximumGames = Math.max(0, Object.keys(teams).length - 1);
    if (
      !Number.isInteger(games) ||
      (games as number) < 0 ||
      (games as number) > 12 ||
      (games as number) > maximumGames
    ) {
      throw new YearDataValidationError(
        source,
        `conference ${conferenceName}.games must be an integer from 0 to ${Math.min(12, maximumGames)}.`,
      );
    }

    for (const [teamName, prestige] of Object.entries(teams)) {
      assertNonemptyName(teamName, source, 'team name');
      assertPrestige(prestige, source, teamName);
      const existing = assignedTeams.get(teamName);
      if (existing) {
        throw new YearDataValidationError(
          source,
          `${teamName} belongs to both ${existing} and ${conferenceName}.`,
        );
      }
      assignedTeams.set(teamName, conferenceName);
    }
  }

  for (const [teamName, prestige] of Object.entries(independents)) {
    assertNonemptyName(teamName, source, 'independent team name');
    assertPrestige(prestige, source, teamName);
    const existing = assignedTeams.get(teamName);
    if (existing) {
      throw new YearDataValidationError(
        source,
        `${teamName} belongs to both ${existing} and independents.`,
      );
    }
    assignedTeams.set(teamName, 'Independent');
  }

  return data as unknown as YearData;
};
