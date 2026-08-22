import { describe, expect, it } from 'vitest';
import type { SeasonData } from '../src/types/baseData';
import { buildSeasonResults } from './season_results_pipeline';

const teamNames = Array.from(
  { length: 28 },
  (_, index) => `Team ${String(index + 1).padStart(2, '0')}`,
);

const yearData = (): SeasonData => ({
  year: 2025,
  playoff: {
    teams: 12,
    conf_champ_autobids: 5,
    conf_champ_top_4: true,
  },
  conferences: {
    Test: {
      games: 12,
      teams: teamNames,
    },
  },
  independents: [],
  results: null,
});

const powerRatings = () => teamNames.map((team, index) => ({
  year: 2025,
  team,
  ranking: index + 1,
  rating: 100 - index,
}));

const records = () => teamNames.map(team => ({
  year: 2025,
  team,
  classification: 'fbs',
  total: { games: 12, wins: 8, losses: 4, ties: 0 },
}));

const rankings = (ranks = teamNames.slice(0, 25).map((school, index) => ({
  rank: index + 1,
  school,
}))) => [{
  season: 2025,
  seasonType: 'postseason',
  week: 1,
  polls: [{ poll: 'AP Top 25', ranks }],
}];

const build = (overrides: Partial<Parameters<typeof buildSeasonResults>[0]> = {}) =>
  buildSeasonResults({
    powerRatings: powerRatings(),
    rankings: rankings(),
    ratingSource: 'SRS',
    records: records(),
    year: 2025,
    yearData: yearData(),
    ...overrides,
  });

describe('season results transformation', () => {
  it('keeps AP teams first and orders the remainder by SRS', () => {
    const result = build();
    const entries = Object.entries(result.results);
    expect(result.apAvailable).toBe(25);
    expect(entries).toHaveLength(28);
    expect(entries.map(([, team]) => team.rank)).toEqual(
      Array.from({ length: 28 }, (_, index) => index + 1),
    );
    expect(entries.slice(24).map(([team]) => team)).toEqual([
      'Team 25', 'Team 26', 'Team 27', 'Team 28',
    ]);
    expect(result.results['Team 01']).toEqual({
      rank: 1,
      wins: 8,
      losses: 4,
    });
  });

  it('normalizes provider aliases against the canonical season universe', () => {
    const canonicalTeams = ['Texas Christian', ...teamNames.slice(1)];
    const aliased = (team: string) => team === 'Team 01' ? 'TCU' : team;
    const season = yearData();
    season.conferences.Test.teams = canonicalTeams;
    const aliasedRankings = rankings().map(entry => ({
      ...entry,
      polls: entry.polls.map(poll => ({
        ...poll,
        ranks: poll.ranks.map(rank => ({
          ...rank,
          school: aliased(rank.school),
        })),
      })),
    }));

    const result = buildSeasonResults({
      powerRatings: powerRatings().map(entry => ({
        ...entry,
        team: aliased(entry.team),
      })),
      rankings: aliasedRankings,
      ratingSource: 'SRS',
      records: records().map(entry => ({
        ...entry,
        team: aliased(entry.team),
      })),
      year: 2025,
      yearData: season,
    });

    expect(result.results['Texas Christian']).toEqual({
      rank: 1,
      wins: 8,
      losses: 4,
    });
    expect(result.results).not.toHaveProperty('TCU');
  });

  it('uses SRS for AP ties and enforces an exact 25-team cutoff', () => {
    const poll = teamNames.slice(0, 26).map((school, index) => ({
      rank: index < 24 ? index + 1 : 25,
      school,
    }));
    const ratings = powerRatings().map(entry =>
      entry.team === 'Team 26' ? { ...entry, rating: 200 } : entry);
    const result = build({ rankings: rankings(poll), powerRatings: ratings });
    expect(result.apAvailable).toBe(26);
    expect(Object.keys(result.results)[24]).toBe('Team 26');
    expect(Object.keys(result.results)[25]).toBe('Team 25');
  });

  it('uses canonical name as the final SRS tie-break', () => {
    const ratings = powerRatings().map(entry => {
      if (['Team 26', 'Team 27'].includes(entry.team)) {
        return { ...entry, rating: -10 };
      }
      return entry.team === 'Team 28' ? { ...entry, rating: -20 } : entry;
    });
    const result = build({ powerRatings: ratings });
    expect(Object.keys(result.results).slice(25, 27)).toEqual([
      'Team 26', 'Team 27',
    ]);
  });

  it('selects the greatest postseason AP week', () => {
    const later = rankings().map(entry => ({ ...entry, week: 2 }));
    const earlier = rankings(
      teamNames.slice(0, 25).toReversed().map((school, index) => ({
        rank: index + 1,
        school,
      })),
    );
    expect(Object.keys(build({ rankings: [...earlier, ...later] }).results)[0])
      .toBe('Team 01');
  });

  it('collapses equivalent SRS and record duplicates', () => {
    const duplicateSrs = {
      ...powerRatings()[0],
      conference: 'Different provider metadata',
    };
    const duplicateRecord = {
      ...records()[0],
      conference: 'Different provider metadata',
    };
    expect(build({
      powerRatings: [...powerRatings(), duplicateSrs],
      records: [...records(), duplicateRecord],
    }).results).toHaveProperty('Team 28');
  });

  it('accepts provider classification for a locally authoritative team', () => {
    const providerRecords = records().map(entry =>
      entry.team === 'Team 28' ? { ...entry, classification: 'fcs' } : entry);
    expect(Object.keys(build({ records: providerRecords }).results)).toHaveLength(28);
  });

  it.each([
    ['missing final poll', { rankings: [] }, 'no postseason AP Top 25'],
    [
      'ambiguous final poll',
      { rankings: [...rankings(), ...rankings()] },
      '2 AP Top 25 polls',
    ],
    [
      'short final poll',
      { rankings: rankings(teamNames.slice(0, 24).map((school, index) => ({ rank: index + 1, school }))) },
      'only 24 teams',
    ],
    [
      'missing SRS',
      { powerRatings: powerRatings().slice(1) },
      'SRS is missing',
    ],
    ['missing record', { records: records().slice(1) }, 'records are missing'],
  ])('rejects %s', (_label, overrides, message) => {
    expect(() => build(overrides)).toThrow(message);
  });

  it('rejects conflicting duplicates and tied records', () => {
    expect(() => build({
      powerRatings: [
        ...powerRatings(),
        { ...powerRatings()[0], rating: 999 },
      ],
    })).toThrow('conflicting SRS rows');
    expect(() => build({
      records: records().map((entry, index) => index === 0 ? {
        ...entry,
        total: { games: 12, wins: 8, losses: 3, ties: 1 },
      } : entry),
    })).toThrow('contains a tie');
  });
});
