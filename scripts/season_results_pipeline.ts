import type { SeasonData } from '../src/types/baseData';
import { canonicalCfbdTeamName } from './cfbd_team_names';

export const CFBD_RANKINGS_ENDPOINT =
  'https://api.collegefootballdata.com/rankings' as const;
export const CFBD_SRS_ENDPOINT =
  'https://api.collegefootballdata.com/ratings/srs' as const;
export const CFBD_SP_ENDPOINT =
  'https://api.collegefootballdata.com/ratings/sp' as const;
export const CFBD_RECORDS_ENDPOINT =
  'https://api.collegefootballdata.com/records' as const;

const AP_POLL_NAME = 'AP Top 25';
const AP_TEAM_COUNT = 25;

const correctKnownFinalApTeam = ({
  rank,
  team,
  year,
}: {
  rank: number;
  team: string;
  year: number;
}) => year === 2023 && rank === 9 && team === 'Mississippi State'
  ? 'Ole Miss'
  : team;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireInteger = (value: unknown, field: string) => {
  if (!Number.isInteger(value)) throw new Error(`${field} must be an integer.`);
  return Number(value);
};

const requireNonnegativeInteger = (value: unknown, field: string) => {
  const integer = requireInteger(value, field);
  if (integer < 0) throw new Error(`${field} must not be negative.`);
  return integer;
};

const requireName = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} must be a nonempty string.`);
  }
  return canonicalCfbdTeamName(value.trim());
};

const buildAssignments = (yearData: SeasonData) => {
  const assignments = new Map<string, string>();
  for (const [conference, data] of Object.entries(yearData.conferences)) {
    for (const team of data.teams) assignments.set(team, conference);
  }
  for (const team of yearData.independents) {
    assignments.set(team, 'Independent');
  }
  return assignments;
};

type RatingEntry = { year: number; ranking: number; rating: number };

const buildRatingsByTeam = (
  value: unknown[],
  year: number,
  teams: ReadonlySet<string>,
  source: string,
) => {
  const byTeam = new Map<string, RatingEntry>();
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.team !== 'string') continue;
    const team = canonicalCfbdTeamName(raw.team.trim());
    if (!teams.has(team)) continue;
    const entry = {
      year: requireInteger(raw.year, `${source} ${team}.year`),
      ranking: requireInteger(raw.ranking, `${source} ${team}.ranking`),
      rating: Number(raw.rating),
    };
    if (entry.year !== year) {
      throw new Error(`${source} ${team} belongs to ${entry.year}.`);
    }
    if (entry.ranking < 1 || !Number.isFinite(entry.rating)) {
      throw new Error(`${source} ${team} has an invalid ranking or rating.`);
    }
    const existing = byTeam.get(team);
    if (
      existing &&
      (existing.year !== entry.year ||
        existing.ranking !== entry.ranking ||
        existing.rating !== entry.rating)
    ) {
      throw new Error(`CFBD returned conflicting ${source} rows for ${team}.`);
    }
    byTeam.set(team, entry);
  }
  const missing = [...teams].filter(team => !byTeam.has(team));
  if (missing.length) {
    throw new Error(`CFBD ${source} is missing: ${missing.join(', ')}.`);
  }
  return byTeam;
};

type RecordEntry = {
  classification: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
};

const buildRecordsByTeam = (
  value: unknown[],
  year: number,
  teams: ReadonlySet<string>,
) => {
  const byTeam = new Map<string, RecordEntry>();
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.team !== 'string') continue;
    const team = canonicalCfbdTeamName(raw.team.trim());
    if (!teams.has(team)) continue;
    if (requireInteger(raw.year, `record ${team}.year`) !== year) {
      throw new Error(`Record ${team} does not belong to ${year}.`);
    }
    if (
      typeof raw.classification !== 'string' ||
      !raw.classification ||
      !isRecord(raw.total)
    ) {
      throw new Error(`Record ${team} does not contain a complete total.`);
    }
    const entry = {
      classification: raw.classification,
      games: requireNonnegativeInteger(raw.total.games, `record ${team}.games`),
      wins: requireNonnegativeInteger(raw.total.wins, `record ${team}.wins`),
      losses: requireNonnegativeInteger(raw.total.losses, `record ${team}.losses`),
      ties: requireNonnegativeInteger(raw.total.ties, `record ${team}.ties`),
    };
    if (entry.games !== entry.wins + entry.losses + entry.ties) {
      throw new Error(`Record ${team} total does not add up.`);
    }
    if (entry.ties !== 0) throw new Error(`Record ${team} contains a tie.`);
    const existing = byTeam.get(team);
    if (existing && JSON.stringify(existing) !== JSON.stringify(entry)) {
      throw new Error(`CFBD returned conflicting record rows for ${team}.`);
    }
    byTeam.set(team, entry);
  }
  const missing = [...teams].filter(team => !byTeam.has(team));
  if (missing.length) throw new Error(`CFBD records are missing: ${missing.join(', ')}.`);
  return byTeam;
};

const selectFinalApRanks = (value: unknown[]) => {
  const candidates: Array<{ week: number; ranks: unknown[] }> = [];
  for (const rawWeek of value) {
    if (
      !isRecord(rawWeek) ||
      rawWeek.seasonType !== 'postseason' ||
      !Number.isInteger(rawWeek.week) ||
      !Array.isArray(rawWeek.polls)
    ) continue;
    for (const rawPoll of rawWeek.polls) {
      if (!isRecord(rawPoll) || rawPoll.poll !== AP_POLL_NAME) continue;
      if (!Array.isArray(rawPoll.ranks)) {
        throw new Error('Final AP Top 25 ranks must be an array.');
      }
      candidates.push({ week: Number(rawWeek.week), ranks: rawPoll.ranks });
    }
  }
  if (!candidates.length) throw new Error('CFBD has no postseason AP Top 25 poll.');
  const finalWeek = Math.max(...candidates.map(candidate => candidate.week));
  const finals = candidates.filter(candidate => candidate.week === finalWeek);
  if (finals.length !== 1) {
    throw new Error(`CFBD has ${finals.length} AP Top 25 polls for postseason week ${finalWeek}.`);
  }
  return finals[0].ranks;
};

export const buildSeasonResults = ({
  powerRatings,
  rankings,
  ratingSource,
  records,
  year,
  yearData,
}: {
  powerRatings: unknown[];
  rankings: unknown[];
  ratingSource: 'SRS' | 'SP+';
  records: unknown[];
  year: number;
  yearData: SeasonData;
}): {
  results: NonNullable<SeasonData['results']>;
  apAvailable: number;
} => {
  const assignments = buildAssignments(yearData);
  const teams = new Set(assignments.keys());
  const ratingsByTeam = buildRatingsByTeam(
    powerRatings,
    year,
    teams,
    ratingSource,
  );
  const recordsByTeam = buildRecordsByTeam(records, year, teams);
  const rawApRanks = selectFinalApRanks(rankings);
  const apRanks = rawApRanks.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`AP rank ${index} must be an object.`);
    const providerTeam = requireName(raw.school, `AP rank ${index}.school`);
    const rank = requireInteger(raw.rank, `AP rank ${providerTeam}.rank`);
    const team = correctKnownFinalApTeam({ rank, team: providerTeam, year });
    if (rank < 1) throw new Error(`AP rank ${team}.rank must be positive.`);
    if (!teams.has(team)) {
      throw new Error(`AP-ranked team ${team} is not in the ${year} season.`);
    }
    return { team, rank };
  });
  if (new Set(apRanks.map(entry => entry.team)).size !== apRanks.length) {
    throw new Error('The final AP Top 25 contains a duplicate team.');
  }
  if (apRanks.length < AP_TEAM_COUNT) {
    throw new Error(`The final AP Top 25 contains only ${apRanks.length} teams.`);
  }

  const compareByRating = (left: string, right: string) =>
    ratingsByTeam.get(right)!.rating - ratingsByTeam.get(left)!.rating ||
    left.localeCompare(right);
  const selectedAp = apRanks
    .sort((left, right) =>
      left.rank - right.rank || compareByRating(left.team, right.team))
    .slice(0, AP_TEAM_COUNT)
    .map(entry => entry.team);
  const selected = new Set(selectedAp);
  const unranked = [...teams]
    .filter(team => !selected.has(team))
    .sort(compareByRating);
  const ordered = [...selectedAp, ...unranked];

  return {
    results: Object.fromEntries(
      ordered.map((team, index) => {
        const record = recordsByTeam.get(team)!;
        return [team, {
          rank: index + 1,
          wins: record.wins,
          losses: record.losses,
        }];
      }),
    ),
    apAvailable: apRanks.length,
  };
};
