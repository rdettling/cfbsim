import type { RivalryDefinition } from '../types/domain';

type RawRivalrySite = {
  type: 'neutral';
  venue?: string;
};

type RawRivalryDefinition = {
  teams: [string, string];
  name?: string;
  week?: number;
  site?: RawRivalrySite;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, allowed: string[]) => {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every(key => allowedKeys.has(key));
};

const nonemptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const rivalryPairKey = (teamA: string, teamB: string) =>
  [teamA, teamB].sort((left, right) => left.localeCompare(right)).join('::');

export const normalizeRivalriesData = (
  value: unknown,
  knownTeams: ReadonlySet<string>,
): { rivalries: RivalryDefinition[] } => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['rivalries']) ||
    !Array.isArray(value.rivalries)
  ) {
    throw new Error(
      'Rivalry data must be an object containing only a rivalries array.',
    );
  }

  const seenPairs = new Set<string>();
  const rivalries = value.rivalries.map((entry, index): RivalryDefinition => {
    const source = `Rivalry ${index + 1}`;
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ['teams', 'name', 'week', 'site'])
    ) {
      throw new Error(
        `${source} contains an invalid definition or unexpected field.`,
      );
    }
    if (
      !Array.isArray(entry.teams) ||
      entry.teams.length !== 2 ||
      !entry.teams.every(nonemptyString)
    ) {
      throw new Error(
        `${source}.teams must contain exactly two nonempty team names.`,
      );
    }

    const [teamA, teamB] = entry.teams as [string, string];
    if (teamA === teamB) {
      throw new Error(`${source} must contain two distinct teams.`);
    }
    if (!knownTeams.has(teamA) || !knownTeams.has(teamB)) {
      throw new Error(`${source} references an unknown team.`);
    }

    const pairKey = rivalryPairKey(teamA, teamB);
    if (seenPairs.has(pairKey)) {
      throw new Error(`${source} duplicates rivalry ${pairKey}.`);
    }
    seenPairs.add(pairKey);

    if ('name' in entry && !nonemptyString(entry.name)) {
      throw new Error(`${source}.name must be a nonempty string when provided.`);
    }
    if (
      'week' in entry &&
      (
        !Number.isInteger(entry.week) ||
        (entry.week as number) < 1 ||
        (entry.week as number) > 14
      )
    ) {
      throw new Error(`${source}.week must be an integer from 1 to 14 when provided.`);
    }

    let neutralSite = false;
    let venue: string | null = null;
    if ('site' in entry) {
      if (
        !isRecord(entry.site) ||
        !hasExactKeys(entry.site, ['type', 'venue']) ||
        entry.site.type !== 'neutral'
      ) {
        throw new Error(`${source}.site must be a neutral-site definition.`);
      }
      if ('venue' in entry.site && !nonemptyString(entry.site.venue)) {
        throw new Error(
          `${source}.site.venue must be a nonempty string when provided.`,
        );
      }
      neutralSite = true;
      venue = (entry.site as RawRivalrySite).venue ?? null;
    }

    const raw = entry as RawRivalryDefinition;
    return {
      teamA,
      teamB,
      week: raw.week ?? null,
      name: raw.name ?? null,
      neutralSite,
      venue,
    };
  });

  return { rivalries };
};
