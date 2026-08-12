import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STATIC_DATA_VERSION,
  clearBaseDataCache,
  getHistoricalGamesForTeam,
  getHistoricalGamesIndex,
  getHistoricalGamesSeason,
  initializeBaseDataCache,
} from './baseData';
import { deleteCurrentDatabase, getDb } from './db';

const historicalIndex = {
  generated_at: '2026-08-11T00:00:00.000Z',
  source: 'CollegeFootballData.com' as const,
  years: [2025],
};

const historicalSeason = {
  year: 2025,
  games: [{
    sourceId: 1,
    year: 2025,
    weekPlayed: 1,
    seasonType: 'regular' as const,
    homeTeam: 'Alpha',
    awayTeam: 'Beta',
    homeScore: 24,
    awayScore: 17,
    homeRank: 0,
    awayRank: 0,
    neutralSite: false,
    venue: null,
    name: null,
    label: 'Non-Conference: Test vs Independent',
  }],
};

const historicalTeamGames = {
  team: 'Alpha State',
  games: [{
    sourceId: 1,
    year: 2025,
    weekPlayed: 1,
    opponent: 'Beta',
    teamScore: 24,
    opponentScore: 17,
    label: 'Non-Conference: Test vs Independent',
  }],
};

describe('base data cache lifecycle', () => {
  beforeEach(async () => {
    await deleteCurrentDatabase();
    await getDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('loads and caches the historical index and seasons independently', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const value = url.endsWith('/index.json')
        ? historicalIndex
        : historicalSeason;
      return new Response(JSON.stringify(value), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchImpl);

    await expect(getHistoricalGamesSeason(2025)).resolves.toEqual(
      historicalSeason,
    );
    await expect(getHistoricalGamesIndex()).resolves.toEqual(historicalIndex);
    await expect(getHistoricalGamesSeason(2025)).resolves.toEqual(
      historicalSeason,
    );

    expect(fetchImpl.mock.calls.map(([input]) => String(input))).toEqual([
      '/data/historical-games/index.json',
      '/data/historical-games/2025.json',
    ]);
    const db = await getDb();
    expect(await db.getAllKeys('baseData')).toEqual([
      'historical-games:2025',
      'historical-games:index',
    ]);
  });

  it('rejects unavailable years before requesting a season file', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(historicalIndex), { status: 200 }));
    vi.stubGlobal('fetch', fetchImpl);

    await expect(getHistoricalGamesSeason(2024)).rejects.toThrow(
      'season 2024 is not available',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('loads, validates, and independently caches team history lookups', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(JSON.stringify(
        url.endsWith('/index.json') ? historicalIndex : historicalTeamGames,
      ), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchImpl);

    await expect(getHistoricalGamesForTeam('Alpha State')).resolves.toEqual(
      historicalTeamGames,
    );
    await expect(getHistoricalGamesForTeam('Alpha State')).resolves.toEqual(
      historicalTeamGames,
    );

    expect(fetchImpl.mock.calls.map(([input]) => String(input))).toEqual([
      '/data/historical-games/index.json',
      '/data/historical-games/by-team/Alpha%20State.json',
    ]);
    const db = await getDb();
    expect(await db.get('baseData', 'historical-games:team:Alpha State'))
      .toEqual({
        key: 'historical-games:team:Alpha State',
        value: historicalTeamGames,
      });
  });

  it('does not cache an invalid team history response', async () => {
    const db = await getDb();
    await db.put('baseData', {
      key: 'historical-games:index',
      value: historicalIndex,
    });
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        ...historicalTeamGames,
        team: 'Wrong Team',
      }), { status: 200 })));

    await expect(getHistoricalGamesForTeam('Alpha State')).rejects.toThrow(
      'do not match requested team Alpha State',
    );
    expect(await db.get('baseData', 'historical-games:team:Alpha State'))
      .toBeUndefined();
  });

  it('validates cached values and never caches an invalid response', async () => {
    const db = await getDb();
    await db.put('baseData', {
      key: 'historical-games:index',
      value: historicalIndex,
    });
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ year: 2024, games: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchImpl);

    await expect(getHistoricalGamesSeason(2025)).rejects.toThrow(
      'does not match the current schema',
    );
    expect(await db.get('baseData', 'historical-games:2025')).toBeUndefined();

    await db.put('baseData', {
      key: 'historical-games:2025',
      value: { ...historicalSeason, year: 2024 },
    });
    await expect(getHistoricalGamesSeason(2025)).rejects.toThrow(
      'does not match requested year',
    );
  });
});
