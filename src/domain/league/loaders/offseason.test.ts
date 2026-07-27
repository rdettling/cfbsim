import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../db/db';
import type { LeagueStage } from '../../../types/domain';
import type { LeagueState } from '../../../types/league';
import { buildTestLeague, buildTestPlayer } from '../../../test/fixtures';
import {
  loadSeasonSummary,
} from './offseason';
import { loadRosterCuts } from './loadRosterCuts';
import { loadAuthoritativeStage } from './loadAuthoritativeStage';
import { loadRecruitingSummary } from './loadRecruitingSummary';
import { loadRealignment } from './loadRealignment';
import { loadRosterProgression } from './loadRosterProgression';
import { loadNonCon } from './season/loadNonCon';

const stores = [
  'baseData',
  'league',
  'players',
  'games',
  'drives',
  'plays',
  'gameLogs',
] as const;

const resetDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const seedScenario = async (stage: LeagueStage) => {
  const db = await getDb();
  const tx = db.transaction(['baseData', 'league', 'players'], 'readwrite');
  await tx.objectStore('league').put({
    key: 'current',
    value: buildTestLeague(stage),
  });
  await tx.objectStore('players').put(buildTestPlayer());
  await tx.objectStore('baseData').put({
    key: 'history',
    value: {
      generated_at: 'test',
      years: [2024],
      conf_index: { 'Test Conference': 1 },
      teams: {},
    },
  });
  await tx.objectStore('baseData').put({
    key: 'prestige_config',
    value: { 4: 100 },
  });
  await tx.objectStore('baseData').put({
    key: 'teams',
    value: {
      teams: {
        'Test State': {
          mascot: 'Testers',
          abbreviation: 'TST',
          ceiling: 7,
          floor: 1,
          colorPrimary: '#123456',
          colorSecondary: '#ffffff',
          city: 'Test City',
          state: 'TS',
          stadium: 'Test Stadium',
        },
      },
    },
  });
  await tx.objectStore('baseData').put({
    key: 'years:index',
    value: { years: ['2026'] },
  });
  await tx.objectStore('baseData').put({
    key: 'years:2026',
    value: {
      playoff: {
        teams: 12,
        conf_champ_autobids: 6,
        conf_champ_top_4: true,
      },
      conferences: {
        'Test Conference': {
          games: 8,
          teams: { 'Test State': 4 },
        },
      },
      Independent: {},
    },
  });
  await tx.objectStore('baseData').put({
    key: 'names',
    value: {
      black: {
        first: [{ name: 'Pat', weight: 1 }],
        last: [{ name: 'Player', weight: 1 }],
      },
      white: {
        first: [{ name: 'Sam', weight: 1 }],
        last: [{ name: 'Tester', weight: 1 }],
      },
    },
  });
  await tx.objectStore('baseData').put({
    key: 'states',
    value: { TS: 1 },
  });
  await tx.done;
};

const snapshotLifecycleStores = async () => {
  const db = await getDb();
  const league = await db.get('league', 'current');
  const history = await db.get('baseData', 'history');
  return {
    league: league?.value as LeagueState,
    history: history?.value,
    players: await db.getAll('players'),
    games: await db.getAll('games'),
    drives: await db.getAll('drives'),
    plays: await db.getAll('plays'),
    gameLogs: await db.getAll('gameLogs'),
  };
};

describe('offseason loaders', () => {
  beforeEach(resetDatabase);

  it.each([
    ['summary', loadSeasonSummary],
    ['realignment', loadRealignment],
    ['progression', loadRosterProgression],
    ['recruiting_summary', loadRecruitingSummary],
    ['roster_cuts', loadRosterCuts],
    ['preseason', loadNonCon],
  ] as const)('does not mutate lifecycle data when %s is loaded repeatedly', async (
    stage,
    loader,
  ) => {
    await seedScenario(stage);

    await loader();
    const afterCompatibilityNormalization = await snapshotLifecycleStores();
    await loader();

    expect(await snapshotLifecycleStores()).toEqual(
      afterCompatibilityNormalization,
    );
  });

  it('returns exact empty page payloads from every off-stage lifecycle loader', async () => {
    await seedScenario('season');
    await loadAuthoritativeStage();
    const before = await snapshotLifecycleStores();

    const summary = await loadSeasonSummary();
    const realignment = await loadRealignment();
    const progression = await loadRosterProgression();
    const recruiting = await loadRecruitingSummary();
    const cuts = await loadRosterCuts();
    const preseason = await loadNonCon();

    expect(summary).toMatchObject({
      champion: null,
      awards: [],
      teams: [],
    });
    expect(realignment).toMatchObject({
      configuration: null,
      preview: null,
      previewError: null,
    });
    expect(progression).toMatchObject({
      returning: [],
      departing: [],
      positions: [],
      summary: {
        returningPlayers: 0,
        departingSeniors: 0,
        averageRatingChange: 0,
        maximumRatingChange: 0,
      },
    });
    expect(recruiting).toMatchObject({
      teamRankings: [],
      playerRankings: [],
      positions: [],
      userTeam: null,
      summary: {
        totalRecruits: 0,
        averageRating: 0,
        highestRating: 0,
      },
    });
    expect(cuts).toMatchObject({
      cuts: [],
      positions: [],
      summary: {
        activePlayers: 0,
        projectedCuts: 0,
        projectedRosterSize: 0,
        positionsOverLimit: 0,
      },
    });
    expect(preseason).toMatchObject({
      schedule: [],
      pending_rivalries: [],
    });
    expect(await snapshotLifecycleStores()).toEqual(before);
  });

  it('returns a gated setup preview when realignment is off-stage', async () => {
    await seedScenario('summary');

    const result = await loadRealignment();

    expect(result).toMatchObject({
      configuration: null,
      preview: null,
      previewError: null,
    });
    expect(result).not.toHaveProperty('settings');
    expect(result).not.toHaveProperty('realignment');
    expect(result).not.toHaveProperty('playoff_changes');
  });

  it.each([
    'preseason',
    'season',
    'summary',
    'realignment',
    'progression',
    'recruiting_summary',
    'roster_cuts',
  ] as const)(
    'loads the authoritative navigation envelope at %s',
    async stage => {
      await seedScenario(stage);

      const result = await loadAuthoritativeStage();

      expect(result.info.stage).toBe(stage);
      expect(result.team.name).toBe('Test State');
      expect(result.conferences).toHaveLength(1);
      expect(result).not.toHaveProperty('settings');
    },
  );

  it('normalizes missing settings through the authoritative-stage redirect loader', async () => {
    await seedScenario('summary');
    const db = await getDb();
    const record = await db.get('league', 'current');
    const league = record?.value as LeagueState;
    delete league.settings;
    await db.put('league', { key: 'current', value: league });

    const result = await loadAuthoritativeStage();
    const persisted = await db.get('league', 'current');

    expect(result.info.stage).toBe('summary');
    expect((persisted?.value as LeagueState).settings).toMatchObject({
      playoff_teams: 12,
      auto_realignment: true,
    });
  });

  it('initializes missing settings without advancing an older save', async () => {
    await seedScenario('realignment');
    const db = await getDb();
    const record = await db.get('league', 'current');
    const league = record?.value as LeagueState;
    delete league.settings;
    await db.put('league', { key: 'current', value: league });

    const result = await loadRealignment();
    const persisted = await db.get('league', 'current');

    expect(result.configuration).toMatchObject({
      conferencePolicy: 'historical',
      playoffTeams: 12,
    });
    expect((persisted?.value as LeagueState).settings).toMatchObject({
      playoff_teams: 12,
      auto_realignment: true,
    });
    expect((persisted?.value as LeagueState).info.stage).toBe('realignment');
  });

  it('returns an explicit preview error for malformed historical data', async () => {
    await seedScenario('realignment');
    const db = await getDb();
    await db.put('baseData', {
      key: 'years:2026',
      value: { playoff: { teams: 6 }, conferences: {} },
    });

    const result = await loadRealignment();

    expect(result.preview).toBeNull();
    expect(result.previewError).toContain('malformed');
    expect(result.info.stage).toBe('realignment');
  });

  it('initializes missing legacy rosters without advancing the stage or year', async () => {
    await seedScenario('progression');
    const db = await getDb();
    await db.clear('players');

    const result = await loadRosterProgression();
    const persisted = await db.get('league', 'current');

    expect(await db.count('players')).toBeGreaterThan(0);
    expect(result.info).toMatchObject({
      stage: 'progression',
      currentYear: 2025,
    });
    expect((persisted?.value as LeagueState).info).toMatchObject({
      stage: 'progression',
      currentYear: 2025,
    });
  });

  it('returns a focused deterministic roster-cuts preview', async () => {
    await seedScenario('roster_cuts');
    const db = await getDb();
    await db.clear('players');
    const players = Array.from({ length: 5 }, (_, index) =>
      buildTestPlayer({
        id: index + 1,
        first: `Quarterback ${index + 1}`,
        pos: 'qb',
        rating: 84 - index,
        rating_sr: 90 - index,
      }),
    );
    players.push(
      buildTestPlayer({
        id: 10,
        pos: 'rb',
        rating: 75,
        rating_sr: 85,
      }),
      buildTestPlayer({ id: 11, active: false }),
      buildTestPlayer({ id: 12, teamId: 999 }),
    );
    const tx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await tx.objectStore('players').put(player);
    }
    await tx.done;

    const result = await loadRosterCuts();

    expect(result.cuts).toEqual([
      {
        id: 5,
        first: 'Quarterback 5',
        last: 'Player',
        position: 'qb',
        currentClass: 'jr',
        currentRating: 80,
        seniorRating: 86,
      },
    ]);
    expect(result.positions[0]).toEqual({
      position: 'qb',
      activePlayers: 5,
      rosterLimit: 4,
      projectedCuts: 1,
      projectedPlayers: 4,
    });
    expect(result.summary).toEqual({
      activePlayers: 6,
      projectedCuts: 1,
      projectedRosterSize: 5,
      positionsOverLimit: 1,
    });
  });

  it('returns a deterministic typed progression preview and summary', async () => {
    await seedScenario('progression');
    const db = await getDb();
    await db.clear('players');
    const players = [
      buildTestPlayer({
        id: 1,
        first: 'Jamie',
        last: 'Junior',
        year: 'jr',
        pos: 'wr',
        rating: 80,
        rating_sr: 86,
      }),
      buildTestPlayer({
        id: 2,
        first: 'Sam',
        last: 'Sophomore',
        year: 'so',
        pos: 'rb',
        rating: 75,
        rating_jr: 79,
      }),
      buildTestPlayer({
        id: 3,
        first: 'Fran',
        last: 'Freshman',
        year: 'fr',
        pos: 'qb',
        rating: 70,
        rating_so: 75,
      }),
      buildTestPlayer({
        id: 4,
        first: 'Sid',
        last: 'Senior',
        year: 'sr',
        pos: 'dl',
        rating: 88,
      }),
      buildTestPlayer({
        id: 5,
        first: 'Inactive',
        last: 'Player',
        active: false,
        rating: 99,
      }),
      buildTestPlayer({
        id: 6,
        first: 'Other',
        last: 'Team',
        teamId: 999,
        rating: 99,
      }),
      buildTestPlayer({
        id: 7,
        first: 'Alex',
        last: 'Alpha',
        year: 'jr',
        pos: 'te',
        rating: 75,
        rating_sr: 80,
      }),
    ];
    const tx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await tx.objectStore('players').put(player);
    }
    await tx.done;

    const result = await loadRosterProgression();

    expect(result.returning).toEqual([
      expect.objectContaining({
        id: 1,
        currentClass: 'jr',
        projectedClass: 'sr',
        currentRating: 80,
        projectedRating: 86,
        ratingChange: 6,
      }),
      expect.objectContaining({
        id: 7,
        position: 'te',
        ratingChange: 5,
      }),
      expect.objectContaining({
        id: 2,
        position: 'rb',
        ratingChange: 4,
      }),
      expect.objectContaining({
        id: 3,
        position: 'qb',
        ratingChange: 5,
      }),
    ]);
    expect(result.departing).toEqual([
      expect.objectContaining({
        id: 4,
        currentClass: 'sr',
        currentRating: 88,
      }),
    ]);
    expect(result.positions).toEqual(['qb', 'rb', 'wr', 'te', 'dl']);
    expect(result.summary).toEqual({
      returningPlayers: 4,
      departingSeniors: 1,
      averageRatingChange: 5,
      maximumRatingChange: 6,
    });
  });

  it('returns a valid empty preview when the user team has no active players', async () => {
    await seedScenario('progression');
    const db = await getDb();
    await db.clear('players');
    await db.put(
      'players',
      buildTestPlayer({ id: 10, active: false }),
    );

    await expect(loadRosterProgression()).resolves.toMatchObject({
      returning: [],
      departing: [],
      positions: [],
      summary: {
        returningPlayers: 0,
        departingSeniors: 0,
      },
    });
  });

  it('returns complete typed recruiting results without legacy fields', async () => {
    await seedScenario('recruiting_summary');
    const db = await getDb();
    await db.clear('players');
    const players = [
      buildTestPlayer({
        id: 20,
        year: 'fr',
        pos: 'wr',
        rating: 88,
        stars: 5,
      }),
      buildTestPlayer({
        id: 21,
        year: 'fr',
        pos: 'qb',
        rating: 82,
        stars: 4,
      }),
      buildTestPlayer({
        id: 22,
        year: 'so',
        rating: 99,
      }),
      buildTestPlayer({
        id: 23,
        teamId: 999,
        year: 'fr',
        rating: 99,
      }),
    ];
    const tx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await tx.objectStore('players').put(player);
    }
    await tx.done;

    const result = await loadRecruitingSummary();

    expect(result.playerRankings.map(player => player.id)).toEqual([20, 21]);
    expect(result.teamRankings).toHaveLength(1);
    expect(result.userTeam).toMatchObject({
      teamId: 1,
      totalRecruits: 2,
      averageRating: 85,
      starCounts: { five: 1, four: 1 },
    });
    expect(result.positions).toEqual(['qb', 'wr']);
    expect(result.summary).toEqual({
      totalRecruits: 2,
      averageRating: 85,
      highestRating: 88,
    });
    expect(result).not.toHaveProperty('team_rankings');
    expect(result).not.toHaveProperty('summary_stats');
  });
});
