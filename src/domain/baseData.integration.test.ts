/// <reference types="node" />
import 'fake-indexeddb/auto';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCurrentDatabase } from '../db/db';
import { buildPreviewData, buildTeamsAndConferences } from './baseData';

beforeEach(async () => {
  await deleteCurrentDatabase();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      try {
        const value = await readFile(
          join(process.cwd(), 'public', url.replace(/^\//, '')),
          'utf-8',
        );
        return new Response(value, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await deleteCurrentDatabase();
});

describe('2004 starting-year data', () => {
  it('builds Florida A&M preview and league records with its logo', async () => {
    const [preview, leagueData] = await Promise.all([
      buildPreviewData('2004'),
      buildTeamsAndConferences('2004'),
    ]);

    expect(
      preview.teams.find(team => team.name === 'Florida A&M'),
    ).toMatchObject({
      mascot: 'Rattlers',
      prestige: 1,
      ceiling: 2,
      floor: 1,
      conferenceName: null,
    });
    expect(
      leagueData.teams.find(team => team.name === 'Florida A&M'),
    ).toMatchObject({
      abbreviation: 'FAMU',
      conference: 'Independent',
      city: 'Tallahassee',
      state: 'Florida',
      stadium: 'Ken Riley Field at Bragg Memorial Stadium',
      colorPrimary: '#00843D',
      colorSecondary: '#FF8200',
    });
    await expect(
      access(
        join(
          process.cwd(),
          'public',
          'logos',
          'teams',
          'Florida A&M.png',
        ),
      ),
    ).resolves.toBeUndefined();
  });
});
