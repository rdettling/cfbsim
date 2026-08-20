import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../db/db';
import { buildTestLeague } from '../../../test/fixtures';
import type { LeagueState } from '../../../types/league';
import {
  normalizeNextSeasonConfiguration,
  updateNextSeasonConfiguration,
} from './nextSeasonConfiguration';

const resetDatabase = async () => {
  const db = await getDb();
  await db.clear('league');
};

const seedLeague = async (league: LeagueState) => {
  const db = await getDb();
  await db.put('league', { key: 'current', value: league });
};

describe('next-season configuration', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedLeague(buildTestLeague('realignment'));
  });

  it.each([2, 4] as const)(
    'normalizes the %s-team playoff format',
    playoffTeams => {
      expect(
        normalizeNextSeasonConfiguration({
          conferencePolicy: 'current',
          postseasonPolicy: 'custom',
          playoffTeams,
          playoffAutobids: 8,
          conferenceChampionsReceiveTopSeeds: true,
        }),
      ).toMatchObject({
        playoffTeams,
        playoffAutobids: 0,
        conferenceChampionsReceiveTopSeeds: false,
      });
    },
  );

  it('persists a partial update and returns the authoritative configuration', async () => {
    await expect(
      updateNextSeasonConfiguration({
        conferencePolicy: 'current',
        postseasonPolicy: 'custom',
        playoffTeams: 4,
      }),
    ).resolves.toMatchObject({
      conferencePolicy: 'current',
      postseasonPolicy: 'custom',
      playoffTeams: 4,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    });

    const db = await getDb();
    const persisted = await db.get('league', 'current');
    expect((persisted?.value as LeagueState).settings).toMatchObject({
      conferencePolicy: 'current',
      postseasonPolicy: 'custom',
      playoffTeams: 4,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    });
  });

  it('serializes simultaneous partial updates without losing unrelated fields', async () => {
    await Promise.all([
      updateNextSeasonConfiguration({ conferencePolicy: 'current' }),
      updateNextSeasonConfiguration({ postseasonPolicy: 'custom' }),
    ]);

    const db = await getDb();
    const persisted = await db.get('league', 'current');
    expect((persisted?.value as LeagueState).settings).toMatchObject({
      conferencePolicy: 'current',
      postseasonPolicy: 'custom',
    });
  });

  it('rejects invalid input and off-stage updates without persistence', async () => {
    const db = await getDb();
    const before = await db.get('league', 'current');

    await expect(
      updateNextSeasonConfiguration({
        playoffTeams: 12,
        playoffAutobids: 11,
      }),
    ).rejects.toThrow('between 0 and 10');
    expect(await db.get('league', 'current')).toEqual(before);

    await seedLeague(buildTestLeague('summary'));
    await expect(
      updateNextSeasonConfiguration({ conferencePolicy: 'current' }),
    ).rejects.toMatchObject({
      expectedStage: 'realignment',
      actualStage: 'summary',
    });
    expect(
      ((await db.get('league', 'current'))?.value as LeagueState).info.stage,
    ).toBe('summary');
  });
});
