import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCurrentDatabase, getDb } from '../../../../db/db';
import { buildTestLeague, buildTestPlayer } from '../../../../test/fixtures';
import type { PlayerSeasonStats } from '../../../../types/db';
import { PLAYER_SEASON_STAT_KEYS } from '../../gameDetails';
import { loadPlayer } from './loadPlayer';

describe('player origin loading', () => {
  beforeEach(async () => {
    await deleteCurrentDatabase();
    await getDb();
  });

  it('joins origins for current players and departed alumni', async () => {
    const db = await getDb();
    const league = buildTestLeague('season');
    const walkOn = buildTestPlayer({ id: 1 });
    const initial = buildTestPlayer({ id: 2, year: 'so' });
    const historical = buildTestPlayer({ id: 3, year: 'sr' });
    const programEntry = buildTestPlayer({ id: 4, year: 'jr' });
    await db.put('league', { key: 'current', value: league });
    await db.put('players', walkOn);
    await db.put('players', initial);
    await db.put('players', programEntry);
    await db.put('historicalPlayers', {
      id: historical.id,
      first: historical.first,
      last: historical.last,
      pos: historical.pos,
      stars: historical.stars,
      development_trait: historical.development_trait,
    });
    const zeroStats = Object.fromEntries(
      PLAYER_SEASON_STAT_KEYS.map(key => [key, 0]),
    ) as Pick<PlayerSeasonStats, (typeof PLAYER_SEASON_STAT_KEYS)[number]>;
    await db.put('playerSeasons', {
      ...zeroStats,
      year: 2025,
      playerId: historical.id,
      teamId: historical.teamId,
      position: historical.pos,
      classYear: 'sr',
      rating: historical.rating,
      games: 1,
    });
    await db.put('playerOrigins', {
      playerId: walkOn.id,
      kind: 'walk_on',
      acquisitionYear: 2025,
      originalTeamId: 1,
    });
    await db.put('playerOrigins', {
      playerId: initial.id,
      kind: 'initial_roster',
      acquisitionYear: 2025,
      originalTeamId: 1,
      classAtStart: 'so',
    });
    await db.put('playerOrigins', {
      playerId: historical.id,
      kind: 'recruit',
      acquisitionYear: 2025,
      originalTeamId: 1,
      homeState: 'CA',
      nationalRank: 18,
      positionRank: 3,
      commitmentRound: 2,
      publicRatingMin: 70,
      publicRatingMax: 74,
    });
    await db.put('playerOrigins', {
      playerId: programEntry.id,
      kind: 'program_entry',
      acquisitionYear: 2025,
      originalTeamId: 1,
      classAtEntry: 'so',
    });

    await expect(loadPlayer('1')).resolves.toMatchObject({
      origin: { kind: 'walk_on', originalTeam: 'Test State' },
    });
    await expect(loadPlayer('2')).resolves.toMatchObject({
      origin: {
        kind: 'initial_roster',
        classAtStart: 'so',
        originalTeam: 'Test State',
      },
    });
    await expect(loadPlayer('3')).resolves.toMatchObject({
      origin: {
        kind: 'recruit',
        nationalRank: 18,
        originalTeam: 'Test State',
      },
    });
    await expect(loadPlayer('4')).resolves.toMatchObject({
      origin: {
        kind: 'program_entry',
        acquisitionYear: 2025,
        classAtEntry: 'so',
        originalTeam: 'Test State',
      },
    });
  });
});
