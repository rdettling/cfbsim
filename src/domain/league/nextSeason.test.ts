import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import { buildTestLeague } from '../../test/fixtures';
import { resolveHistoricalData } from './historicalData';
import { buildNextSeasonPreview } from './nextSeasonPreview';

const validSeasonData = {
  playoff: {
    teams: 12,
    conf_champ_autobids: 5,
    conf_champ_top_4: true,
  },
  conferences: {
    'Test Conference': {
      games: 0,
      teams: ['Test State'],
    },
  },
  independents: [],
  results: null,
};

const resetDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction(['baseData', 'league'], 'readwrite');
  await Promise.all([
    tx.objectStore('baseData').clear(),
    tx.objectStore('league').clear(),
  ]);
  await tx.done;
};

const seedHistoricalYears = async (years: number[]) => {
  const db = await getDb();
  const tx = db.transaction('baseData', 'readwrite');
  await tx.objectStore('baseData').put({
    key: 'seasons:index',
    value: { years: [...years].sort((left, right) => right - left).map(String) },
  });
  for (const year of years) {
    await tx.objectStore('baseData').put({
      key: `seasons:${year}`,
      value: { ...validSeasonData, year },
    });
  }
  await tx.done;
};

describe('historical next-season resolution', () => {
  beforeEach(resetDatabase);

  it('resolves exact historical data', async () => {
    await seedHistoricalYears([2023, 2024, 2025]);

    await expect(resolveHistoricalData(2024, 2020)).resolves.toMatchObject({
      dataSource: {
        targetYear: 2024,
        sourceYear: 2024,
        resolution: 'exact',
        atHistoricalFrontier: false,
      },
    });
  });

  it.each([2023, 2024, 2025])(
    'keeps preview source exact for bundled year %s',
    async targetYear => {
      await seedHistoricalYears([2023, 2024, 2025]);

      const resolved = await resolveHistoricalData(targetYear, 2023);
      expect(resolved.dataSource).toMatchObject({
        targetYear,
        sourceYear: targetYear,
        resolution: 'exact',
      });
      expect(
        buildNextSeasonPreview(
          buildTestLeague('realignment'),
          resolved,
        ).dataSource,
      ).toEqual(resolved.dataSource);
    },
  );

  it('uses the closest prior year inside the historical range', async () => {
    await seedHistoricalYears([2020, 2023, 2025]);

    await expect(resolveHistoricalData(2024, 2020)).resolves.toMatchObject({
      dataSource: {
        targetYear: 2024,
        sourceYear: 2023,
        resolution: 'fallback',
        atHistoricalFrontier: false,
      },
    });
  });

  it('uses the earliest source before the historical range', async () => {
    await seedHistoricalYears([2000, 2001]);

    await expect(resolveHistoricalData(1998, 1998)).resolves.toMatchObject({
      dataSource: {
        sourceYear: 2000,
        resolution: 'fallback',
        atHistoricalFrontier: false,
      },
    });
  });

  it('marks newest-year reuse beyond the historical frontier', async () => {
    await seedHistoricalYears([2024, 2025]);

    await expect(resolveHistoricalData(2027, 2024)).resolves.toMatchObject({
      dataSource: {
        targetYear: 2027,
        sourceYear: 2025,
        resolution: 'fallback',
        atHistoricalFrontier: true,
      },
    });
  });

  it('rejects missing and malformed historical data explicitly', async () => {
    await expect(resolveHistoricalData(2026)).rejects.toMatchObject({
      targetYear: 2026,
    });

    const db = await getDb();
    await db.put('baseData', {
      key: 'seasons:index',
      value: { years: ['2026'] },
    });
    await db.put('baseData', {
      key: 'seasons:2026',
      value: { playoff: { teams: 6 }, conferences: {} },
    });

    await expect(resolveHistoricalData(2026)).rejects.toThrow('malformed');
  });

  it('returns empty change arrays for a valid zero-change preview', async () => {
    await seedHistoricalYears([2026]);
    const resolved = await resolveHistoricalData(2026, 2025);
    const league = buildTestLeague('realignment');

    expect(buildNextSeasonPreview(league, resolved)).toMatchObject({
      dataSource: { sourceYear: 2026 },
      conferenceChanges: [],
      postseasonChanges: [
        {
          setting: 'playoffAutobids',
          currentValue: 6,
          nextValue: 5,
        },
      ],
    });

    resolved.yearData.playoff.conf_champ_autobids = 6;
    expect(buildNextSeasonPreview(league, resolved)).toMatchObject({
      conferenceChanges: [],
      postseasonChanges: [],
    });
  });
});
