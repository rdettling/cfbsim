import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';
import type { LeagueState } from '../types/league';
import { getDb } from './db';
import {
  loadLeague,
  loadLeaguePlayersSnapshot,
  requireCurrentRoster,
  saveLeague,
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
      name: 'unknown league field',
      mutate: (league: LeagueState) => {
        Object.assign(league, { obsoleteLeagueField: true });
      },
    },
    {
      name: 'unknown info field',
      mutate: (league: LeagueState) => {
        Object.assign(league.info, { obsoleteInfoField: true });
      },
    },
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
      name: 'non-record rivalry host seeds',
      mutate: (league: LeagueState) => {
        league.rivalryHostSeeds = [] as unknown as Record<string, string>;
      },
    },
    {
      name: 'team missing rating',
      mutate: (league: LeagueState) => {
        delete (league.teams[0] as Partial<LeagueState['teams'][number]>).rating;
      },
    },
    {
      name: 'team missing ranking',
      mutate: (league: LeagueState) => {
        delete (league.teams[0] as Partial<LeagueState['teams'][number]>).ranking;
      },
    },
    {
      name: 'team missing current last rank',
      mutate: (league: LeagueState) => {
        delete (league.teams[0] as Partial<LeagueState['teams'][number]>).last_rank;
      },
    },
    {
      name: 'team with an unknown field',
      mutate: (league: LeagueState) => {
        Object.assign(league.teams[0], { obsoleteTeamField: true });
      },
    },
    {
      name: 'team with a non-finite rating',
      mutate: (league: LeagueState) => {
        league.teams[0].rating = Number.NaN;
      },
    },
    {
      name: 'conference with an unknown field',
      mutate: (league: LeagueState) => {
        Object.assign(league.conferences[0], { obsoleteConferenceField: true });
      },
    },
    {
      name: 'conference with an invalid championship ID',
      mutate: (league: LeagueState) => {
        league.conferences[0].championship = 0;
      },
    },
    {
      name: 'malformed pending rivalry',
      mutate: (league: LeagueState) => {
        league.pending_rivalries = [{
          id: 1,
          teamA: 'Test State',
          teamB: 'Other State',
          name: null,
          homeTeam: null,
          awayTeam: null,
          neutralSite: false,
          venue: null,
        }];
        Object.assign(league.pending_rivalries[0], { obsoleteRivalryField: true });
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
    {
      name: 'unknown playoff field',
      mutate: (league: LeagueState) => {
        Object.assign(league.playoff, { obsoletePlayoffField: 1 });
      },
    },
    {
      name: 'missing resume snapshot field',
      mutate: (league: LeagueState) => {
        delete (league as Partial<LeagueState>).resumeSnapshot;
      },
    },
    {
      name: 'malformed resume snapshot',
      mutate: (league: LeagueState) => {
        league.resumeSnapshot = {} as LeagueState['resumeSnapshot'];
      },
    },
    {
      name: 'resume snapshot with an unknown field',
      mutate: (league: LeagueState) => {
        league.resumeSnapshot = buildTestLeague('summary').resumeSnapshot;
        Object.assign(league.resumeSnapshot!, { obsoleteSnapshotField: true });
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

  it('accepts explicit null current-state values', async () => {
    const league = buildTestLeague('season');
    league.teams[0].last_rank = null;
    league.conferences[0].championship = null;
    const db = await getDb();
    await db.put('league', { key: 'current', value: league });

    await expect(loadLeague()).resolves.toEqual(league);
  });

  it('rejects an invalid league before save without replacing the stored league', async () => {
    const original = buildTestLeague('season');
    const db = await getDb();
    await db.put('league', { key: 'current', value: original });
    const invalid = structuredClone(original);
    Object.assign(invalid.info, { obsoleteInfoField: true });

    await expect(saveLeague(invalid)).rejects.toMatchObject({
      code: 'INVALID_LEAGUE_STATE',
    });
    expect((await db.get('league', 'current'))?.value).toEqual(original);
  });

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
