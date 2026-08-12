/// <reference types="node" />
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRawGameHistorySeason,
  parseFetchGameHistoryArgs,
  runFetchGameHistory,
} from './fetch_game_history';
import { GAME_HISTORY_SOURCE } from '../src/domain/historicalGames';
import {
  GAME_HISTORY_API_ENDPOINT,
  validateRawGameHistoryManifest,
} from './game_history_pipeline';

const temporaryDirectories: string[] = [];

const makeDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cfbsim-game-history-'));
  temporaryDirectories.push(directory);
  return directory;
};

const responseFor = (url: string | URL | Request) => {
  const value = String(url).includes('/rankings')
    ? [{ season: 2025, week: 1, polls: [] }]
    : String(url).includes('seasonType=postseason')
    ? [{ id: 2, seasonType: 'postseason' }]
    : [{ id: 1, seasonType: 'regular' }];
  return new Response(JSON.stringify(value), { status: 200 });
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('game history fetching', () => {
  it('parses an explicit refresh year and rejects malformed arguments', () => {
    expect(parseFetchGameHistoryArgs(['--year', '2025', '--refresh'])).toEqual({
      year: 2025,
      refresh: true,
    });
    expect(() => parseFetchGameHistoryArgs(['--year', '25'])).toThrow(
      'four-digit year',
    );
    expect(() => parseFetchGameHistoryArgs(['--unknown'])).toThrow(
      'Unknown',
    );
  });

  it('rejects a year outside the completed bundled seasons', async () => {
    await expect(runFetchGameHistory({
      options: { year: 2024, refresh: true },
      apiKey: 'test-key',
      completedYears: Promise.resolve([2025]),
    })).rejects.toThrow('2024 is not a completed bundled season');
  });

  it('writes exact raw responses and a complete manifest, then skips them', async () => {
    const rawDirectory = await makeDirectory();
    const fetchImpl = vi.fn(async input => responseFor(input));
    const first = await fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: true,
      rawDirectory,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => '2026-08-11T00:00:00.000Z',
    });

    expect(first).toEqual({
      year: 2025,
      skipped: false,
      regularRecords: 1,
      postseasonRecords: 1,
      rankingsRecords: 1,
    });
    expect(await readFile(join(rawDirectory, '2025', 'regular.json'), 'utf8'))
      .toBe(JSON.stringify([{ id: 1, seasonType: 'regular' }]));
    expect(await readFile(join(rawDirectory, '2025', 'rankings.json'), 'utf8'))
      .toBe(JSON.stringify([{ season: 2025, week: 1, polls: [] }]));
    const manifest = validateRawGameHistoryManifest(
      JSON.parse(await readFile(join(rawDirectory, 'manifest.json'), 'utf8')),
    );
    expect(manifest.seasons['2025']).toEqual({
      fetched_at: '2026-08-11T00:00:00.000Z',
      regular: { file: '2025/regular.json', records: 1 },
      postseason: { file: '2025/postseason.json', records: 1 },
      rankings: { file: '2025/rankings.json', records: 1 },
    });

    fetchImpl.mockClear();
    await expect(fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: false,
      rawDirectory,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toMatchObject({ skipped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires refresh to replace a pre-rankings manifest', async () => {
    const rawDirectory = await makeDirectory();
    await writeFile(join(rawDirectory, 'manifest.json'), JSON.stringify({
      source: GAME_HISTORY_SOURCE,
      endpoint: GAME_HISTORY_API_ENDPOINT,
      seasons: {},
    }));
    const fetchImpl = vi.fn(async input => responseFor(input));

    await expect(fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: false,
      rawDirectory,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toThrow('current schema');
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: true,
      rawDirectory,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toMatchObject({ skipped: false, rankingsRecords: 1 });
  });

  it('preserves the previous snapshot when a refresh request fails', async () => {
    const rawDirectory = await makeDirectory();
    await fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: true,
      rawDirectory,
      fetchImpl: (async input => responseFor(input)) as typeof fetch,
      now: () => '2026-08-11T00:00:00.000Z',
    });
    const previousManifest = await readFile(
      join(rawDirectory, 'manifest.json'),
      'utf8',
    );
    const previousRegular = await readFile(
      join(rawDirectory, '2025', 'regular.json'),
      'utf8',
    );
    const previousRankings = await readFile(
      join(rawDirectory, '2025', 'rankings.json'),
      'utf8',
    );

    const failingFetch = vi.fn(async input =>
      String(input).includes('/rankings')
        ? new Response('failure', { status: 500 })
        : new Response('[{"id":99}]', { status: 200 }),
    );
    await expect(fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: true,
      rawDirectory,
      fetchImpl: failingFetch as unknown as typeof fetch,
    })).rejects.toThrow('rankings request failed');

    expect(await readFile(join(rawDirectory, 'manifest.json'), 'utf8'))
      .toBe(previousManifest);
    expect(await readFile(join(rawDirectory, '2025', 'regular.json'), 'utf8'))
      .toBe(previousRegular);
    expect(await readFile(join(rawDirectory, '2025', 'rankings.json'), 'utf8'))
      .toBe(previousRankings);
  });

  it('retries a rate-limited request without delaying the test', async () => {
    const rawDirectory = await makeDirectory();
    let regularAttempts = 0;
    const fetchImpl = vi.fn(async input => {
      if (
        String(input).includes('seasonType=regular') &&
        regularAttempts++ === 0
      ) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '1' },
        });
      }
      return responseFor(input);
    });
    const sleep = vi.fn(async () => undefined);

    await fetchRawGameHistorySeason({
      apiKey: 'test-key',
      year: 2025,
      refresh: true,
      rawDirectory,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });

    expect(regularAttempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });
});
