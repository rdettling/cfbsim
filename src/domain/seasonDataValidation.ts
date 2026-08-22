import type { SeasonData } from '../types/baseData';

export class SeasonDataValidationError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(`${source}: ${message}`);
    this.name = 'SeasonDataValidationError';
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
    throw new SeasonDataValidationError(source, `${field} must be an object.`);
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
    throw new SeasonDataValidationError(
      source,
      `${field} has invalid fields (${details}).`,
    );
  }
};

const assertNonemptyName = (name: string, source: string, field: string) => {
  if (!name.trim()) {
    throw new SeasonDataValidationError(source, `${field} must not be empty.`);
  }
};

const assertTeamNames = (
  value: unknown,
  source: string,
  field: string,
): string[] => {
  if (!Array.isArray(value)) {
    throw new SeasonDataValidationError(source, `${field} must be an array.`);
  }
  const names = value.map((teamName, index) => {
    if (typeof teamName !== 'string') {
      throw new SeasonDataValidationError(
        source,
        `${field}[${index}] must be a string.`,
      );
    }
    assertNonemptyName(teamName, source, `${field}[${index}]`);
    return teamName;
  });
  if (new Set(names).size !== names.length) {
    throw new SeasonDataValidationError(source, `${field} contains a duplicate team.`);
  }
  return names;
};

export const validateSeasonData = (
  value: unknown,
  source: string,
  requestedYear?: number,
): SeasonData => {
  const data = assertRecord(value, source, 'season data');
  assertExactKeys(
    data,
    ['year', 'playoff', 'conferences', 'independents', 'results'],
    source,
    'season data',
  );
  if (!Number.isInteger(data.year)) {
    throw new SeasonDataValidationError(source, 'year must be an integer.');
  }
  if (requestedYear !== undefined && data.year !== requestedYear) {
    throw new SeasonDataValidationError(
      source,
      `year must equal requested year ${requestedYear}.`,
    );
  }

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
    throw new SeasonDataValidationError(
      source,
      'playoff.teams must be 2, 4, or 12.',
    );
  }
  if (
    !Number.isInteger(autobids) ||
    (autobids as number) < 0 ||
    (autobids as number) > 10
  ) {
    throw new SeasonDataValidationError(
      source,
      'playoff.conf_champ_autobids must be an integer from 0 to 10.',
    );
  }
  if (typeof topFour !== 'boolean') {
    throw new SeasonDataValidationError(
      source,
      'playoff.conf_champ_top_4 must be a boolean.',
    );
  }
  if (
    (playoffTeams === 2 || playoffTeams === 4) &&
    (autobids !== 0 || topFour)
  ) {
    throw new SeasonDataValidationError(
      source,
      '2- and 4-team playoffs must use 0 autobids and false top-four seeding.',
    );
  }
  if (playoffTeams === 12 && topFour && (autobids as number) < 4) {
    throw new SeasonDataValidationError(
      source,
      'top-four conference champion seeding requires at least 4 autobids.',
    );
  }

  const conferences = assertRecord(
    data.conferences,
    source,
    'conferences',
  );
  const independents = assertTeamNames(
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
    const teams = assertTeamNames(
      conference.teams,
      source,
      `conference ${conferenceName}.teams`,
    );
    const games = conference.games;
    const maximumGames = Math.max(0, teams.length - 1);
    if (
      !Number.isInteger(games) ||
      (games as number) < 0 ||
      (games as number) > 12 ||
      (games as number) > maximumGames
    ) {
      throw new SeasonDataValidationError(
        source,
        `conference ${conferenceName}.games must be an integer from 0 to ${Math.min(12, maximumGames)}.`,
      );
    }

    for (const teamName of teams) {
      const existing = assignedTeams.get(teamName);
      if (existing) {
        throw new SeasonDataValidationError(
          source,
          `${teamName} belongs to both ${existing} and ${conferenceName}.`,
        );
      }
      assignedTeams.set(teamName, conferenceName);
    }
  }

  for (const teamName of independents) {
    const existing = assignedTeams.get(teamName);
    if (existing) {
      throw new SeasonDataValidationError(
        source,
        `${teamName} belongs to both ${existing} and independents.`,
      );
    }
    assignedTeams.set(teamName, 'Independent');
  }

  if (data.results !== null) {
    const results = assertRecord(data.results, source, 'results');
    const resultTeams = Object.keys(results);
    if (resultTeams.length !== assignedTeams.size) {
      throw new SeasonDataValidationError(
        source,
        `results must contain exactly ${assignedTeams.size} teams.`,
      );
    }
    for (const [index, [teamName, rawResult]] of Object.entries(results).entries()) {
      if (!assignedTeams.has(teamName)) {
        throw new SeasonDataValidationError(
          source,
          `result team ${teamName} is not active in the season.`,
        );
      }
      const result = assertRecord(rawResult, source, `result ${teamName}`);
      assertExactKeys(
        result,
        ['rank', 'wins', 'losses'],
        source,
        `result ${teamName}`,
      );
      if (result.rank !== index + 1) {
        throw new SeasonDataValidationError(
          source,
          `result ${teamName}.rank must equal ordinal position ${index + 1}.`,
        );
      }
      for (const field of ['wins', 'losses'] as const) {
        if (!Number.isInteger(result[field]) || (result[field] as number) < 0) {
          throw new SeasonDataValidationError(
            source,
            `result ${teamName}.${field} must be a nonnegative integer.`,
          );
        }
      }
    }
    for (const teamName of assignedTeams.keys()) {
      if (!(teamName in results)) {
        throw new SeasonDataValidationError(
          source,
          `results are missing ${teamName}.`,
        );
      }
    }
  }

  return data as unknown as SeasonData;
};
