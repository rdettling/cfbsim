import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import conferencesData from '../../../public/data/conferences.json';
import teamsData from '../../../public/data/teams.json';
import year2024 from '../../../public/data/years/2024.json';
import year2025 from '../../../public/data/years/2025.json';
import year2026 from '../../../public/data/years/2026.json';
import { deleteCurrentDatabase, getDb } from '../../db/db';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { YearData } from '../../types/baseData';
import type { LeagueState } from '../../types/league';
import { applyRealignmentAndPlayoff } from './offseason';

const teamEntries = (year: YearData) => [
  ...Object.entries(year.conferences).flatMap(([conference, data]) =>
    Object.entries(data.teams ?? {}).map(([name, prestige]) => ({
      name,
      prestige: Number(prestige),
      conference,
    })),
  ),
  ...Object.entries(year.independents).map(([name, prestige]) => ({
    name,
    prestige: Number(prestige),
    conference: 'Independent',
  })),
];

const buildHistoricalLeague = (
  currentYear: number,
  year: YearData,
): LeagueState => {
  const teams = teamEntries(year).map((entry, index) =>
    buildTestTeam({
      id: index + 1,
      name: entry.name,
      prestige: entry.prestige,
      conference: entry.conference,
      confName: entry.conference,
      ranking: index + 1,
    }),
  );
  return buildTestLeague('realignment', {
    info: {
      currentWeek: 18,
      lastRankingsWeek: 17,
      currentYear,
      startYear: 2024,
      stage: 'realignment',
      team: teams[0].name,
      lastWeek: 18,
    },
    teams,
    settings: {
      conferencePolicy: 'historical',
      postseasonPolicy: 'historical',
      playoffTeams: 4,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    },
    idCounters: { game: 2, player: teams.length * 80 + 1 },
  });
};

describe('historical realignment', () => {
  beforeEach(async () => {
    await deleteCurrentDatabase();
    const db = await getDb();
    await db.put('baseData', { key: 'teams', value: teamsData });
    await db.put('baseData', { key: 'conferences', value: conferencesData });
  });

  it.each([
    {
      currentYear: 2024,
      current: year2024,
      next: year2025,
      expected: ['Missouri State', 'Delaware'],
    },
    {
      currentYear: 2025,
      current: year2025,
      next: year2026,
      expected: ['Sacramento State', 'North Dakota State'],
    },
  ])('returns only programs added in $currentYear realignment', async ({
    currentYear,
    current,
    next,
    expected,
  }) => {
    const league = buildHistoricalLeague(
      currentYear,
      current as unknown as YearData,
    );
    const added = await applyRealignmentAndPlayoff(league, {
      dataSource: {
        targetYear: currentYear + 1,
        sourceYear: currentYear + 1,
        resolution: 'exact',
        atHistoricalFrontier: false,
      },
      yearData: next as unknown as YearData,
    });

    expect(added.map(team => team.name)).toEqual(expected);
    expect(added.map(team => team.ranking)).toEqual([
      league.teams.length - 1,
      league.teams.length,
    ]);
  });

  it('does not add programs when conference alignment is fixed', async () => {
    const league = buildHistoricalLeague(2024, year2024 as unknown as YearData);
    league.settings.conferencePolicy = 'current';
    const added = await applyRealignmentAndPlayoff(league, {
      dataSource: {
        targetYear: 2025,
        sourceYear: 2025,
        resolution: 'exact',
        atHistoricalFrontier: false,
      },
      yearData: year2025 as unknown as YearData,
    });

    expect(added).toEqual([]);
    expect(league.teams).toHaveLength(teamEntries(year2024 as unknown as YearData).length);
  });
});
