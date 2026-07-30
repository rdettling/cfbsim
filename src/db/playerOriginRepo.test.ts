import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';
import type { PlayerOrigin } from '../types/db';
import {
  assertPlayerOriginIntegrity,
  isPlayerOrigin,
} from './playerOriginRepo';

const recruit: PlayerOrigin = {
  playerId: 1,
  kind: 'recruit',
  acquisitionYear: 2025,
  originalTeamId: 1,
  homeState: 'TX',
  nationalRank: 25,
  positionRank: 4,
  commitmentRound: 'signing_day',
  publicRatingMin: 70,
  publicRatingMax: 75,
};

describe('player origin validation', () => {
  it('accepts each exact origin variant and rejects extra or malformed fields', () => {
    expect(isPlayerOrigin(recruit)).toBe(true);
    expect(isPlayerOrigin({
      playerId: 2,
      kind: 'walk_on',
      acquisitionYear: 2025,
      originalTeamId: 1,
    })).toBe(true);
    expect(isPlayerOrigin({
      playerId: 3,
      kind: 'initial_roster',
      acquisitionYear: 2025,
      originalTeamId: 1,
      classAtStart: 'so',
    })).toBe(true);
    expect(isPlayerOrigin({ ...recruit, prospectId: 9 })).toBe(false);
    expect(isPlayerOrigin({ ...recruit, positionRank: 26 })).toBe(false);
    expect(isPlayerOrigin({ ...recruit, publicRatingMax: 101 })).toBe(false);
  });

  it('requires a one-to-one identity union with valid team and year facts', () => {
    const league = buildTestLeague('season');
    const player = buildTestPlayer({ id: 1 });
    expect(() => assertPlayerOriginIntegrity({
      league,
      currentPlayers: [player],
      historicalPlayers: [],
      origins: [recruit],
    })).not.toThrow();
    expect(() => assertPlayerOriginIntegrity({
      league,
      currentPlayers: [player],
      historicalPlayers: [],
      origins: [],
    })).toThrow(/exactly one origin/);
    expect(() => assertPlayerOriginIntegrity({
      league,
      currentPlayers: [player],
      historicalPlayers: [],
      origins: [{ ...recruit, originalTeamId: 999 }],
    })).toThrow(/current data model/);
  });
});
