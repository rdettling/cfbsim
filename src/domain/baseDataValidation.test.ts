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
import { ROSTER } from './rosterConfig';
import type { NamesData } from '../types/baseData';

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
    names.profiles.black.first[0].weight = 0;
    expect(() => validateNamesData(names)).toThrow(
      'names.json: profiles.black.first[0].weight',
    );

    const states = readData('states.json');
    states.XX = 1;
    expect(() => validateStatesData(states)).toThrow('unexpected XX');
  });

  it('rejects malformed name profiles and position weights', () => {
    const missingPosition = readData('names.json');
    delete missingPosition.positionWeights.qb;
    expect(() => validateNamesData(missingPosition)).toThrow('missing qb');

    const missingProfile = readData('names.json');
    delete missingProfile.positionWeights.qb.black;
    expect(() => validateNamesData(missingProfile)).toThrow('missing black');

    const unknownProfile = readData('names.json');
    unknownProfile.positionWeights.qb.unknown = 0;
    expect(() => validateNamesData(unknownProfile)).toThrow('unexpected unknown');

    const invalidTotal = readData('names.json');
    invalidTotal.positionWeights.qb.white = 84;
    expect(() => validateNamesData(invalidTotal)).toThrow('must total 100');

    const negativeWeight = readData('names.json');
    negativeWeight.positionWeights.qb.black = -1;
    expect(() => validateNamesData(negativeWeight)).toThrow(
      'positionWeights.qb.black',
    );

    const duplicateName = readData('names.json');
    duplicateName.profiles.black.first.push({ name: 'james', weight: 1 });
    expect(() => validateNamesData(duplicateName)).toThrow(
      'must not duplicate another name',
    );

    const emptyPool = readData('names.json');
    emptyPool.profiles.white.last = [];
    expect(() => validateNamesData(emptyPool)).toThrow(
      'profiles.white.last must be a nonempty array',
    );
  });

  it('keeps the committed name catalog broad, weighted, and position-aware', () => {
    const names = validateNamesData(readData('names.json')) as NamesData;
    expect(Object.keys(names.profiles).sort()).toEqual([
      'asianPacific',
      'black',
      'hispanic',
      'other',
      'white',
    ]);

    for (const profile of Object.values(names.profiles)) {
      expect(profile.first).toHaveLength(1000);
      expect(profile.last).toHaveLength(1000);
      for (const pool of [profile.first, profile.last]) {
        expect(new Set(pool.map(entry => entry.weight)).size).toBeGreaterThan(1);
        expect(pool.every(entry => entry.weight >= 1 && entry.weight <= 10)).toBe(true);
      }
    }

    const firstWeight = (profile: string, name: string) => (
      names.profiles[profile].first.find(entry => entry.name === name)?.weight ?? 0
    );
    expect(firstWeight('black', 'Jalen')).toBeGreaterThan(
      firstWeight('black', 'Ronald'),
    );
    expect(firstWeight('white', 'Jacob')).toBeGreaterThan(
      firstWeight('white', 'Gary'),
    );

    expect(names.positionWeights.cb.black).toBeGreaterThan(
      names.positionWeights.qb.black,
    );
    expect(names.positionWeights.k.white).toBeGreaterThan(
      names.positionWeights.k.black,
    );

    const rosterSize = Object.values(ROSTER).reduce(
      (total, position) => total + position.total,
      0,
    );
    const rosterShare = (profile: string) => Object.entries(ROSTER).reduce(
      (total, [position, config]) => (
        total + config.total * names.positionWeights[position][profile]
      ),
      0,
    ) / rosterSize;
    expect(rosterShare('black') + rosterShare('white')).toBeGreaterThan(85);
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

    const invalidPrestige = readData('history.json');
    invalidPrestige.teams.Georgia[0][5] = 8;
    expect(() => validateHistoryData(invalidPrestige)).toThrow(
      'teams.Georgia[0] contains an out-of-range value',
    );
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
