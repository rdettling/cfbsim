/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validateBettingOddsData,
  validateHistoryData,
  validateNamesData,
  validatePrestigeConfig,
  validateSeasonIndexData,
  validateStatesData,
  validateTeamsData,
} from './baseDataValidation';

const readData = (name: string) => JSON.parse(readFileSync(
  join(process.cwd(), 'public', 'data', name),
  'utf8',
));

describe('base data validation', () => {
  it('accepts the committed singleton contracts', () => {
    expect(validateTeamsData(readData('teams.json'))).toBeTruthy();
    expect(validateNamesData(readData('names.json'))).toBeTruthy();
    expect(validateStatesData(readData('states.json'))).toBeTruthy();
    expect(validatePrestigeConfig(readData('prestige_config.json'))).toBeTruthy();
    expect(validateBettingOddsData(readData('betting_odds.json'))).toBeTruthy();
    expect(validateHistoryData(readData('history.json'))).toBeTruthy();
    expect(validateSeasonIndexData(readData('seasons/index.json'))).toBeTruthy();
  });

  it('reports exact paths for malformed names and states', () => {
    const names = readData('names.json');
    names.black.first[0].weight = 0;
    expect(() => validateNamesData(names)).toThrow(
      'names.json: black.first[0].weight',
    );

    const states = readData('states.json');
    states.XX = 1;
    expect(() => validateStatesData(states)).toThrow('unexpected XX');
  });

  it('rejects incomplete odds, invalid probabilities, and legacy timestamps', () => {
    const missingOdds = readData('betting_odds.json');
    delete missingOdds.odds['100'];
    expect(() => validateBettingOddsData(missingOdds)).toThrow('missing 100');

    const invalidProbability = readData('betting_odds.json');
    invalidProbability.odds['0'].favWinProb = 0.8;
    expect(() => validateBettingOddsData(invalidProbability)).toThrow(
      'win probabilities must total 1',
    );

    const history = readData('history.json');
    history.generated_at = 'legacy';
    expect(() => validateHistoryData(history)).toThrow('unexpected generated_at');
  });

  it('rejects duplicate or unordered indexes and invalid prestige totals', () => {
    expect(() => validateSeasonIndexData({ years: ['2025', '2025'] }))
      .toThrow('duplicates');
    expect(() => validateSeasonIndexData({ years: ['2024', '2025'] }))
      .toThrow('strictly descending');
    expect(() => validatePrestigeConfig({
      1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10,
    })).toThrow('must total 100');
  });
});
