import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';
import type { LeagueState } from '../types/league';
import { getDb } from './db';
import {
  loadLeague,
  loadLeaguePlayersSnapshot,
  requireCurrentRoster,
} from './leagueRepo';

const resetDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction(['league', 'players'], 'readwrite');
  await Promise.all([
    tx.objectStore('league').clear(),
    tx.objectStore('players').clear(),
  ]);
  await tx.done;
};

const snapshot = async () => {
  const db = await getDb();
  return {
    league: await db.getAll('league'),
    players: await db.getAll('players'),
  };
};

describe('current league persistence boundary', () => {
  beforeEach(resetDatabase);

  it('returns null only when the league record is absent', async () => {
    await expect(loadLeague()).resolves.toBeNull();
  });

  it.each([
    {
      name: 'missing settings',
      mutate: (league: LeagueState) => {
        delete (league as Partial<LeagueState>).settings;
      },
    },
    {
      name: 'unknown settings field',
      mutate: (league: LeagueState) => {
        (
          league.settings as unknown as Record<string, unknown>
        ).unknownSetting = true;
      },
    },
    {
      name: 'invalid stage',
      mutate: (league: LeagueState) => {
        league.info.stage = 'invalid' as LeagueState['info']['stage'];
      },
    },
    {
      name: 'incomplete counters',
      mutate: (league: LeagueState) => {
        delete (league.idCounters as Partial<LeagueState['idCounters']>)
          .player;
      },
    },
    {
      name: 'invalid playoff state',
      mutate: (league: LeagueState) => {
        (
          league.playoff as unknown as { seeds: unknown }
        ).seeds = 'invalid';
      },
    },
  ])(
    'rejects $name without changing the stored record',
    async ({ mutate }) => {
      const db = await getDb();
      const malformed = buildTestLeague('season');
      mutate(malformed);
      await db.put('league', { key: 'current', value: malformed });
      const before = await snapshot();

      await expect(loadLeague()).rejects.toMatchObject({
        code: 'INVALID_LEAGUE_STATE',
      });
      expect(await snapshot()).toEqual(before);
    },
  );

  it.each([
    {
      name: 'missing',
      players: [],
    },
    {
      name: 'malformed',
      players: [buildTestPlayer({ first: '' })].map(player => ({
        ...player,
        rating: Number.NaN,
      })),
    },
    {
      name: 'assigned to an unknown team',
      players: [buildTestPlayer({ teamId: 999 })],
    },
  ])('rejects a $name roster without repairing it', async ({ players }) => {
    const league = buildTestLeague('season');
    const db = await getDb();
    await db.put('league', { key: 'current', value: league });
    for (const player of players) {
      await db.put('players', player);
    }
    const before = await snapshot();

    await expect(requireCurrentRoster(league)).rejects.toMatchObject({
      code: 'INVALID_ROSTER_STATE',
    });
    await expect(loadLeaguePlayersSnapshot()).rejects.toMatchObject({
      code: 'INVALID_ROSTER_STATE',
    });
    expect(await snapshot()).toEqual(before);
  });
});
