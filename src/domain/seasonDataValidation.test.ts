import { describe, expect, it } from 'vitest';
import {
  validateSeasonData,
  SeasonDataValidationError,
} from './seasonDataValidation';

const validSeasonData = () => ({
  year: 2025,
  playoff: {
    teams: 12,
    conf_champ_top_4: true,
    conf_champ_autobids: 5,
  },
  conferences: {
    Test: {
      games: 1,
      teams: ['Alpha', 'Beta'],
    },
  },
  independents: ['Gamma'],
  results: {
    Alpha: { rank: 1, wins: 12, losses: 1 },
    Beta: { rank: 2, wins: 8, losses: 4 },
    Gamma: { rank: 3, wins: 5, losses: 7 },
  },
});

const expectInvalid = (value: unknown, message: string) => {
  expect(() => validateSeasonData(value, 'Test year')).toThrowError(
    SeasonDataValidationError,
  );
  expect(() => validateSeasonData(value, 'Test year')).toThrow(message);
};

describe('validateSeasonData', () => {
  it('returns a valid current year record', () => {
    expect(validateSeasonData(validSeasonData(), 'Test season', 2025)).toEqual(
      validSeasonData(),
    );
  });

  it('accepts a scheduled season with null results', () => {
    const value = validSeasonData();
    value.results = null as unknown as typeof value.results;
    expect(validateSeasonData(value, 'Test season', 2025).results).toBeNull();
  });

  it('rejects a requested-year mismatch', () => {
    expect(() => validateSeasonData(validSeasonData(), 'Test season', 2026))
      .toThrow('year must equal requested year 2026');
  });

  it('rejects legacy and unknown top-level fields', () => {
    const value = validSeasonData() as Record<string, unknown>;
    value.Independent = value.independents;
    delete value.independents;
    expectInvalid(value, 'invalid fields');
  });

  it('rejects duplicate team membership', () => {
    const value = validSeasonData();
    value.independents.push('Alpha');
    expectInvalid(value, 'Alpha belongs to both Test and independents');
  });

  it('rejects duplicate teams and the removed prestige map', () => {
    const value = validSeasonData();
    value.conferences.Test.teams.push('Alpha');
    expectInvalid(value, 'contains a duplicate team');

    const legacy = validSeasonData();
    legacy.conferences.Test.teams = { Alpha: 7, Beta: 1 } as unknown as string[];
    expectInvalid(legacy, 'conference Test.teams must be an array');
  });

  it.each([-1, 2, 13, 0.5])(
    'rejects impossible conference-game value %s',
    games => {
      const value = validSeasonData();
      value.conferences.Test.games = games;
      expectInvalid(value, 'conference Test.games');
    },
  );

  it.each([2, 4])(
    'accepts the current %s-team playoff configuration',
    teams => {
      const value = validSeasonData();
      value.playoff = {
        teams,
        conf_champ_autobids: 0,
        conf_champ_top_4: false,
      };
      expect(validateSeasonData(value, 'Test year').playoff.teams).toBe(teams);
    },
  );

  it.each([1, 3, 8, 16])('rejects unsupported playoff size %s', teams => {
    const value = validSeasonData();
    value.playoff.teams = teams;
    expectInvalid(value, 'playoff.teams must be 2, 4, or 12');
  });

  it('rejects autobids and top-four seeding for a 4-team playoff', () => {
    const value = validSeasonData();
    value.playoff = {
      teams: 4,
      conf_champ_autobids: 1,
      conf_champ_top_4: true,
    };
    expectInvalid(value, 'must use 0 autobids and false top-four seeding');
  });

  it.each([-1, 11, 1.5])('rejects invalid autobid count %s', autobids => {
    const value = validSeasonData();
    value.playoff.conf_champ_autobids = autobids;
    expectInvalid(value, 'must be an integer from 0 to 10');
  });

  it('rejects top-four seeding with fewer than four autobids', () => {
    const value = validSeasonData();
    value.playoff.conf_champ_autobids = 3;
    expectInvalid(value, 'requires at least 4 autobids');
  });

  it('rejects non-boolean top-four seeding', () => {
    const value = validSeasonData();
    (value.playoff as Record<string, unknown>).conf_champ_top_4 = null;
    expectInvalid(value, 'must be a boolean');
  });

  it('rejects incomplete, extra, and noncontiguous results', () => {
    const missing = validSeasonData();
    delete (missing.results as Record<string, unknown>).Gamma;
    expectInvalid(missing, 'results must contain exactly 3 teams');

    const extra = validSeasonData();
    (extra.results as Record<string, unknown>).Delta = {
      rank: 4, wins: 1, losses: 11,
    };
    expectInvalid(extra, 'results must contain exactly 3 teams');

    const ranks = validSeasonData();
    ranks.results.Beta.rank = 1;
    expectInvalid(ranks, 'rank must equal ordinal position 2');
  });

  it('rejects invalid result fields and records', () => {
    const extraField = validSeasonData();
    (extraField.results.Alpha as Record<string, unknown>).team = 'Alpha';
    expectInvalid(extraField, 'unexpected team');

    const invalidRecord = validSeasonData();
    invalidRecord.results.Alpha.wins = -1;
    expectInvalid(invalidRecord, 'wins must be a nonnegative integer');
  });
});
