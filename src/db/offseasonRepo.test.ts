import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { commitOffseasonTransition } from './offseasonRepo';
import {
  OffseasonConfigurationConflictError,
  OffseasonStageMismatchError,
  type LeagueState,
} from '../types/league';
import { buildTestLeague } from '../test/fixtures';

const resetDatabase = async () => {
  const db = await getDb();
  const stores = ['baseData', 'league'] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const seedLeague = async (league: LeagueState) => {
  const db = await getDb();
  await db.put('league', { key: 'current', value: league });
};

describe('commitOffseasonTransition', () => {
  beforeEach(resetDatabase);

  it('allows only one concurrent command to commit', async () => {
    await seedLeague(buildTestLeague('summary'));

    const firstLeague = buildTestLeague('realignment');
    const secondLeague = buildTestLeague('realignment');
    const results = await Promise.allSettled([
      commitOffseasonTransition({
        expectedStage: 'summary',
        league: firstLeague,
      }),
      commitOffseasonTransition({
        expectedStage: 'summary',
        league: secondLeague,
      }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find(result => result.status === 'rejected');
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: expect.any(OffseasonStageMismatchError),
    });

    const db = await getDb();
    const persisted = await db.get('league', 'current');
    expect((persisted?.value as LeagueState).info.stage).toBe('realignment');
  });

  it('rolls back earlier writes when a later store write fails', async () => {
    const sourceLeague = buildTestLeague('summary');
    await seedLeague(sourceLeague);
    const db = await getDb();
    const originalHistory = {
      generated_at: 'test',
      years: [2024],
      conf_index: { 'Test Conference': 1 },
      teams: {},
    };
    await db.put('baseData', { key: 'history', value: originalHistory });

    const invalidLeague = buildTestLeague('realignment') as LeagueState & {
      invalidValue?: () => void;
    };
    invalidLeague.invalidValue = () => undefined;
    await expect(
      commitOffseasonTransition({
        expectedStage: 'summary',
        league: invalidLeague,
        history: {
          ...originalHistory,
          years: [2025, 2024],
        },
      }),
    ).rejects.toBeDefined();

    const persistedLeague = await db.get('league', 'current');
    const persistedHistory = await db.get('baseData', 'history');
    expect((persistedLeague?.value as LeagueState).info.stage).toBe('summary');
    expect(persistedHistory?.value).toEqual(originalHistory);
  });

  it('rejects a realignment commit prepared from stale settings', async () => {
    const source = buildTestLeague('realignment');
    await seedLeague(source);
    const db = await getDb();
    const changed = structuredClone(source);
    changed.settings.conferencePolicy = 'current';
    await db.put('league', { key: 'current', value: changed });

    const destination = structuredClone(source);
    destination.info.stage = 'progression';
    destination.info.currentYear += 1;

    await expect(
      commitOffseasonTransition({
        expectedStage: 'realignment',
        expectedSettings: source.settings,
        league: destination,
      }),
    ).rejects.toBeInstanceOf(OffseasonConfigurationConflictError);

    const persisted = await db.get('league', 'current');
    expect((persisted?.value as LeagueState).info).toMatchObject({
      stage: 'realignment',
      currentYear: 2025,
    });
    expect(
      (persisted?.value as LeagueState).settings.conferencePolicy,
    ).toBe('current');
  });

});
