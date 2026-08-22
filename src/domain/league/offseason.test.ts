import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import conferencesData from '../../../public/data/conferences.json';
import historyData from '../../../public/data/history.json';
import prestigeConfig from '../../../public/data/prestige_config.json';
import teamsData from '../../../public/data/teams.json';
import year2024 from '../../../public/data/seasons/2024.json';
import year2025 from '../../../public/data/seasons/2025.json';
import year2026 from '../../../public/data/seasons/2026.json';
import { deleteCurrentDatabase, getDb } from '../../db/db';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { SeasonData } from '../../types/baseData';
import type { LeagueState } from '../../types/league';
import { applyRealignmentAndPlayoff } from './offseason';

const teamEntries = (year: SeasonData) => [
  ...Object.entries(year.conferences).flatMap(([conference, data]) =>
    data.teams.map(name => ({
      name,
      conference,
    })),
  ),
  ...year.independents.map(name => ({
    name,
    conference: 'Independent',
  })),
];

const buildHistoricalLeague = (
  currentYear: number,
  year: SeasonData,
): LeagueState => {
  const teams = teamEntries(year).map((entry, index) =>
    buildTestTeam({
      id: index + 1,
      name: entry.name,
      prestige: 4,
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
    await db.put('baseData', { key: 'history', value: historyData });
    await db.put('baseData', { key: 'prestige_config', value: prestigeConfig });
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
      current as unknown as SeasonData,
    );
    const added = await applyRealignmentAndPlayoff(league, {
      dataSource: {
        targetYear: currentYear + 1,
        sourceYear: currentYear + 1,
        resolution: 'exact',
        atHistoricalFrontier: false,
      },
      yearData: next as unknown as SeasonData,
    });

    expect(added.map(team => team.name)).toEqual(expected);
    expect(added.map(team => team.ranking)).toEqual([
      league.teams.length - 1,
      league.teams.length,
    ]);
  });

  it('does not add programs when conference alignment is fixed', async () => {
    const league = buildHistoricalLeague(2024, year2024 as unknown as SeasonData);
    league.settings.conferencePolicy = 'current';
    league.conferences[0].championship = 99;
    league.conferences[0].finalStandings = {
      year: 2024,
      entries: [{
        teamId: league.conferences[0].teams[0].id,
        pollRank: league.conferences[0].teams[0].ranking,
        resolvedBy: null,
      }],
    };
    const added = await applyRealignmentAndPlayoff(league, {
      dataSource: {
        targetYear: 2025,
        sourceYear: 2025,
        resolution: 'exact',
        atHistoricalFrontier: false,
      },
      yearData: year2025 as unknown as SeasonData,
    });

    expect(added).toEqual([]);
    expect(league.teams).toHaveLength(teamEntries(year2024 as unknown as SeasonData).length);
    expect(league.conferences[0].championship).toBeNull();
    expect(league.conferences[0].finalStandings).toBeNull();
  });

  it('uses dynasty history for a new entrant without resetting existing Prestige', async () => {
    const db = await getDb();
    await db.put('baseData', {
      key: 'history',
      value: {
        years: [2024],
        conf_index: { SEC: 1, CUSA: 2 },
        teams: {
          Alabama: [[2024, 1, 2, 8, 4, 2]],
          Delaware: [[2024, 2, 1, 12, 0, 4]],
        },
      },
    });
    await db.put('baseData', {
      key: 'prestige_config',
      value: { 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 },
    });
    const existing = buildTestTeam({
      id: 1,
      name: 'Alabama',
      prestige: 2,
      conference: 'SEC',
      confName: 'SEC',
    });
    const league = buildTestLeague('realignment', {
      info: {
        ...buildTestLeague('realignment').info,
        currentYear: 2024,
        startYear: 2024,
        stage: 'realignment',
        team: 'Alabama',
      },
      teams: [existing],
      conferences: [{
        id: 1,
        confName: 'SEC',
        confFullName: 'Southeastern Conference',
        confGames: 8,
        info: '',
        championship: null,
        finalStandings: null,
        teams: [existing],
      }],
      settings: {
        conferencePolicy: 'historical',
        postseasonPolicy: 'custom',
        playoffTeams: 12,
        playoffAutobids: 5,
        conferenceChampionsReceiveTopSeeds: true,
      },
    });
    const yearData: SeasonData = {
      year: 2024,
      playoff: {
        teams: 12,
        conf_champ_autobids: 5,
        conf_champ_top_4: true,
      },
      conferences: {
        CUSA: { games: 8, teams: ['Alabama', 'Delaware'] },
      },
      independents: [],
      results: null,
    };

    const added = await applyRealignmentAndPlayoff(league, {
      dataSource: {
        targetYear: 2025,
        sourceYear: 2024,
        resolution: 'fallback',
        atHistoricalFrontier: false,
      },
      yearData,
    });

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ name: 'Delaware', prestige: 4 });
    expect(league.teams.find(team => team.name === 'Alabama')?.prestige).toBe(2);
  });
});
