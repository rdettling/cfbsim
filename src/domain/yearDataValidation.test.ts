import { describe, expect, it } from 'vitest';
import {
  validateYearData,
  YearDataValidationError,
} from './yearDataValidation';

const validYearData = () => ({
  playoff: {
    teams: 12,
    conf_champ_top_4: true,
    conf_champ_autobids: 5,
  },
  conferences: {
    Test: {
      games: 1,
      teams: {
        Alpha: 7,
        Beta: 1,
      },
    },
  },
  independents: {
    Gamma: 3,
  },
});

const expectInvalid = (value: unknown, message: string) => {
  expect(() => validateYearData(value, 'Test year')).toThrowError(
    YearDataValidationError,
  );
  expect(() => validateYearData(value, 'Test year')).toThrow(message);
};

describe('validateYearData', () => {
  it('returns a valid current year record', () => {
    expect(validateYearData(validYearData(), 'Test year')).toEqual(
      validYearData(),
    );
  });

  it('rejects legacy and unknown top-level fields', () => {
    const value = validYearData() as Record<string, unknown>;
    value.Independent = value.independents;
    delete value.independents;
    expectInvalid(value, 'invalid fields');
  });

  it('rejects duplicate team membership', () => {
    const value = validYearData();
    (value.independents as Record<string, number>).Alpha = 4;
    expectInvalid(value, 'Alpha belongs to both Test and independents');
  });

  it.each([0, 8, 2.5])('rejects invalid prestige %s', prestige => {
    const value = validYearData();
    value.conferences.Test.teams.Alpha = prestige;
    expectInvalid(value, 'prestige for Alpha');
  });

  it.each([-1, 2, 13, 0.5])(
    'rejects impossible conference-game value %s',
    games => {
      const value = validYearData();
      value.conferences.Test.games = games;
      expectInvalid(value, 'conference Test.games');
    },
  );

  it.each([2, 4])(
    'accepts the current %s-team playoff configuration',
    teams => {
      const value = validYearData();
      value.playoff = {
        teams,
        conf_champ_autobids: 0,
        conf_champ_top_4: false,
      };
      expect(validateYearData(value, 'Test year').playoff.teams).toBe(teams);
    },
  );

  it.each([1, 3, 8, 16])('rejects unsupported playoff size %s', teams => {
    const value = validYearData();
    value.playoff.teams = teams;
    expectInvalid(value, 'playoff.teams must be 2, 4, or 12');
  });

  it('rejects autobids and top-four seeding for a 4-team playoff', () => {
    const value = validYearData();
    value.playoff = {
      teams: 4,
      conf_champ_autobids: 1,
      conf_champ_top_4: true,
    };
    expectInvalid(value, 'must use 0 autobids and false top-four seeding');
  });

  it.each([-1, 11, 1.5])('rejects invalid autobid count %s', autobids => {
    const value = validYearData();
    value.playoff.conf_champ_autobids = autobids;
    expectInvalid(value, 'must be an integer from 0 to 10');
  });

  it('rejects top-four seeding with fewer than four autobids', () => {
    const value = validYearData();
    value.playoff.conf_champ_autobids = 3;
    expectInvalid(value, 'requires at least 4 autobids');
  });

  it('rejects non-boolean top-four seeding', () => {
    const value = validYearData();
    (value.playoff as Record<string, unknown>).conf_champ_top_4 = null;
    expectInvalid(value, 'must be a boolean');
  });
});
