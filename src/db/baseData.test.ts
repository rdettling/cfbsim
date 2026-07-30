import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STATIC_DATA_VERSION,
  clearBaseDataCache,
  initializeBaseDataCache,
} from './baseData';
import { deleteCurrentDatabase, getDb } from './db';

describe('base data cache lifecycle', () => {
  beforeEach(async () => {
    await deleteCurrentDatabase();
    await getDb();
  });

  it('clears stale public data while preserving mutable history', async () => {
    const db = await getDb();
    await db.put('baseData', {
      key: 'static_data_version',
      value: STATIC_DATA_VERSION - 1,
    });
    await db.put('baseData', {
      key: 'years:index',
      value: { years: ['2025'] },
    });
    await db.put('baseData', {
      key: 'teams',
      value: { teams: {} },
    });
    await db.put('baseData', {
      key: 'history',
      value: { years: [2025] },
    });

    await initializeBaseDataCache();

    expect(await db.get('baseData', 'years:index')).toBeUndefined();
    expect(await db.get('baseData', 'teams')).toBeUndefined();
    expect(await db.get('baseData', 'history')).toEqual({
      key: 'history',
      value: { years: [2025] },
    });
    expect(await db.get('baseData', 'static_data_version')).toEqual({
      key: 'static_data_version',
      value: STATIC_DATA_VERSION,
    });
  });

  it('preserves current-version public data', async () => {
    const db = await getDb();
    await db.put('baseData', {
      key: 'static_data_version',
      value: STATIC_DATA_VERSION,
    });
    await db.put('baseData', {
      key: 'years:index',
      value: { years: ['2026', '2025'] },
    });

    await initializeBaseDataCache();

    expect(await db.get('baseData', 'years:index')).toEqual({
      key: 'years:index',
      value: { years: ['2026', '2025'] },
    });
  });

  it('records the current version after an intentional full cache clear', async () => {
    const db = await getDb();
    await db.put('baseData', {
      key: 'history',
      value: { years: [2025] },
    });

    await clearBaseDataCache();

    expect(await db.getAllKeys('baseData')).toEqual([
      'static_data_version',
    ]);
    expect(await db.get('baseData', 'static_data_version')).toEqual({
      key: 'static_data_version',
      value: STATIC_DATA_VERSION,
    });
  });
});
