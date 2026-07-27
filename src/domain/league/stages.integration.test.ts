import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import type { LeagueState } from '../../types/league';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import { advanceOffseasonStage } from './stages';
import { updateNextSeasonConfiguration } from './nextSeasonConfiguration';
import { loadRecruitingSummary } from './loaders/loadRecruitingSummary';
import { loadRealignment } from './loaders/loadRealignment';
import { loadRosterCuts } from './loaders/loadRosterCuts';
import { loadRosterProgression } from './loaders/loadRosterProgression';
import { loadSeasonSummary } from './loaders/offseason';
import { loadNonCon } from './loaders/season/loadNonCon';
import { POSITION_ORDER, ROSTER } from '../rosterConfig';

const resetDatabase = async () => {
  const db = await getDb();
  const stores = [
    'baseData',
    'league',
    'players',
    'games',
    'drives',
    'plays',
    'gameLogs',
  ] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const seedFullCycle = async () => {
  const db = await getDb();
  const tx = db.transaction(['baseData', 'league', 'players'], 'readwrite');
  await tx.objectStore('league').put({
    key: 'current',
    value: buildTestLeague('summary'),
  });
  await tx.objectStore('players').put(buildTestPlayer());

  const baseRecords = [
    {
      key: 'history',
      value: {
        generated_at: 'test',
        years: [2024],
        conf_index: { 'Test Conference': 1 },
        teams: { 'Test State': [[2024, 1, 1, 12, 0, 4]] },
      },
    },
    { key: 'prestige_config', value: { 7: 100 } },
    {
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
    },
    { key: 'conferences', value: { 'Test Conference': 'Test Conference' } },
    { key: 'years:index', value: { years: ['2025', '2026'] } },
    {
      key: 'years:2026',
      value: {
        playoff: {
          teams: 4,
          conf_champ_autobids: 0,
          conf_champ_top_4: false,
        },
        conferences: {
          'Test Conference': {
            games: 8,
            teams: { 'Test State': 4 },
          },
        },
        Independent: {},
      },
    },
    {
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
    },
    { key: 'states', value: { TS: 1 } },
    { key: 'rivalries', value: { rivalries: [] } },
  ];

  for (const record of baseRecords) {
    await tx.objectStore('baseData').put(record);
  }
  await tx.done;
};

const loadPersistedLeague = async () => {
  const db = await getDb();
  const record = await db.get('league', 'current');
  return record?.value as LeagueState;
};

describe('offseason lifecycle integration', () => {
  beforeEach(resetDatabase);

  it('advances a complete offseason with each mutation applied once', async () => {
    await seedFullCycle();

    const summaryPreview = await loadSeasonSummary();
    const summaryReload = await loadSeasonSummary();
    const withoutAwardTimestamps = (
      awards: typeof summaryPreview.awards,
    ) =>
      awards.map(({ last_updated: _lastUpdated, ...award }) => award);
    expect({
      ...summaryReload,
      awards: withoutAwardTimestamps(summaryReload.awards),
    }).toEqual({
      ...summaryPreview,
      awards: withoutAwardTimestamps(summaryPreview.awards),
    });
    await advanceOffseasonStage('summary');
    let league = await loadPersistedLeague();
    expect(league.info.stage).toBe('realignment');
    expect(league.teams[0]).toMatchObject({
      prestige: 5,
      prestige_change: 0,
    });
    await expect(advanceOffseasonStage('summary')).rejects.toMatchObject({
      actualStage: 'realignment',
    });

    const setupPreview = await loadRealignment();
    await expect(loadRealignment()).resolves.toEqual(setupPreview);
    await advanceOffseasonStage('realignment');
    league = await loadPersistedLeague();
    expect(league.info).toMatchObject({
      stage: 'progression',
      currentYear: 2026,
    });
    expect(league.settings?.playoff_teams).toBe(4);
    await expect(
      advanceOffseasonStage('realignment'),
    ).rejects.toMatchObject({
      actualStage: 'progression',
    });

    const progressionPreview = await loadRosterProgression();
    await expect(loadRosterProgression()).resolves.toEqual(
      progressionPreview,
    );
    await advanceOffseasonStage('progression');
    league = await loadPersistedLeague();
    const db = await getDb();
    const recruitedPlayers = await db.getAll('players');
    expect(league.info.stage).toBe('recruiting_summary');
    expect(recruitedPlayers.length).toBeGreaterThan(1);
    expect(recruitedPlayers.find(player => player.id === 1)).toMatchObject({
      year: 'sr',
      rating: 85,
    });
    await expect(
      advanceOffseasonStage('progression'),
    ).rejects.toMatchObject({
      actualStage: 'recruiting_summary',
    });

    const recruitingSummary = await loadRecruitingSummary();
    const persistedFreshmanIds = recruitedPlayers
      .filter(player => player.active && player.year === 'fr')
      .map(player => player.id)
      .sort((left, right) => left - right);
    expect(
      recruitingSummary.playerRankings
        .map(player => player.id)
        .sort((left, right) => left - right),
    ).toEqual(persistedFreshmanIds);
    await expect(loadRecruitingSummary()).resolves.toEqual(
      recruitingSummary,
    );

    await advanceOffseasonStage('recruiting_summary');
    expect((await loadPersistedLeague()).info.stage).toBe('roster_cuts');
    expect(await db.getAll('players')).toEqual(recruitedPlayers);
    await expect(
      advanceOffseasonStage('recruiting_summary'),
    ).rejects.toMatchObject({
      actualStage: 'roster_cuts',
    });

    const cutsPreview = await loadRosterCuts();
    await expect(loadRosterCuts()).resolves.toEqual(cutsPreview);
    await advanceOffseasonStage('roster_cuts');
    league = await loadPersistedLeague();
    const preseasonPlayers = await db.getAll('players');
    cutsPreview.cuts.forEach(projected => {
      expect(
        preseasonPlayers.find(player => player.id === projected.id),
      ).toMatchObject({
        active: false,
        starter: false,
      });
    });
    league.teams.forEach(team => {
      POSITION_ORDER.forEach(position => {
        const active = preseasonPlayers.filter(
          player =>
            player.active &&
            player.teamId === team.id &&
            player.pos === position,
        );
        expect(active.length).toBeLessThanOrEqual(
          ROSTER[position].total,
        );
        expect(active.filter(player => player.starter)).toHaveLength(
          Math.min(active.length, ROSTER[position].starters),
        );
      });
    });
    expect(league.info.stage).toBe('preseason');
    expect(league.scheduleBuilt).toBe(false);
    expect(league.simInitialized).toBe(false);
    await expect(
      advanceOffseasonStage('roster_cuts'),
    ).rejects.toMatchObject({
      actualStage: 'preseason',
    });
    const preseason = await loadNonCon();
    await expect(loadNonCon()).resolves.toEqual(preseason);
  });

  it('never combines a stale configuration with realignment advancement', async () => {
    await seedFullCycle();
    await advanceOffseasonStage('summary');

    const results = await Promise.allSettled([
      advanceOffseasonStage('realignment'),
      updateNextSeasonConfiguration({ conferencePolicy: 'current' }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const league = await loadPersistedLeague();
    if (league.info.stage === 'progression') {
      expect(league.info.currentYear).toBe(2026);
      expect(league.settings?.auto_realignment).toBe(true);
    } else {
      expect(league.info).toMatchObject({
        stage: 'realignment',
        currentYear: 2025,
      });
      expect(league.settings?.auto_realignment).toBe(false);
    }
  });

  it('applies the exact user-team progression preview once', async () => {
    await seedFullCycle();
    await advanceOffseasonStage('summary');
    await advanceOffseasonStage('realignment');

    const db = await getDb();
    const leagueRecord = await db.get('league', 'current');
    const progressionLeague = leagueRecord?.value as LeagueState;
    progressionLeague.idCounters!.player = 100;
    await db.put('league', {
      key: 'current',
      value: progressionLeague,
    });
    await db.clear('players');
    const previewPlayers = [
      buildTestPlayer({
        id: 10,
        year: 'fr',
        rating: 70,
        rating_so: 74,
      }),
      buildTestPlayer({
        id: 11,
        year: 'so',
        rating: 75,
        rating_jr: 81,
      }),
      buildTestPlayer({
        id: 12,
        year: 'jr',
        rating: 80,
        rating_sr: 87,
      }),
      buildTestPlayer({
        id: 13,
        year: 'sr',
        rating: 90,
        starter: true,
      }),
    ];
    const playerTx = db.transaction('players', 'readwrite');
    for (const player of previewPlayers) {
      await playerTx.objectStore('players').put(player);
    }
    await playerTx.done;

    const preview = await loadRosterProgression();
    expect(preview.returning).toHaveLength(3);
    expect(preview.departing.map(player => player.id)).toEqual([13]);

    await advanceOffseasonStage('progression');
    const persistedPlayers = await db.getAll('players');
    preview.returning.forEach(projected => {
      expect(
        persistedPlayers.find(player => player.id === projected.id),
      ).toMatchObject({
        year: projected.projectedClass,
        rating: projected.projectedRating,
        active: true,
      });
    });
    expect(
      persistedPlayers.find(player => player.id === 13),
    ).toMatchObject({
      active: false,
      starter: false,
    });

    await expect(
      advanceOffseasonStage('progression'),
    ).rejects.toMatchObject({
      actualStage: 'recruiting_summary',
    });
  });

  it('processes other-team cuts for a compliant user roster and creates rivalry games', async () => {
    await seedFullCycle();
    const db = await getDb();
    const userTeam = buildTestTeam({ id: 1 });
    const rival = buildTestTeam({
      id: 2,
      name: 'Rival State',
      abbreviation: 'RIV',
      conference: 'Other Conference',
      confName: 'Other Conference',
    });
    const league = buildTestLeague('roster_cuts', {
      teams: [userTeam, rival],
      idCounters: {
        game: 10,
        drive: 1,
        play: 1,
        gameLog: 1,
        player: 30,
      },
    });
    await db.put('league', { key: 'current', value: league });
    await db.put('baseData', {
      key: 'rivalries',
      value: {
        rivalries: [
          ['Test State', 'Rival State', 3, 'State Rivalry', false],
        ],
      },
    });
    await db.put('baseData', {
      key: 'betting_odds',
      value: { odds: {}, max_diff: 100 },
    });
    await db.clear('players');
    const players = [userTeam, rival].flatMap((team, teamIndex) =>
      Array.from({
        length:
          ROSTER.qb.total + (teamIndex === 0 ? 0 : 1),
      }, (_, index) =>
        buildTestPlayer({
          id: teamIndex * 10 + index + 1,
          teamId: team.id,
          pos: 'qb',
          rating: 85 - index,
          rating_sr: 90 - index,
          starter: index === ROSTER.qb.total,
        }),
      ),
    );
    const tx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await tx.objectStore('players').put(player);
    }
    await tx.done;

    const preview = await loadRosterCuts();
    expect(preview.cuts).toEqual([]);
    expect(preview.summary.projectedCuts).toBe(0);

    await advanceOffseasonStage('roster_cuts');

    const persisted = await db.getAll('players');
    expect(
      persisted
        .filter(player => !player.active)
        .map(player => player.id),
    ).toEqual([15]);
    [userTeam.id, rival.id].forEach(teamId => {
      const activeQbs = persisted.filter(
        player =>
          player.active &&
          player.teamId === teamId &&
          player.pos === 'qb',
      );
      expect(activeQbs).toHaveLength(ROSTER.qb.total);
      expect(activeQbs.filter(player => player.starter)).toHaveLength(
        ROSTER.qb.starters,
      );
    });
    expect((await loadPersistedLeague()).info.stage).toBe('preseason');
    expect(await db.getAll('games')).toEqual([
      expect.objectContaining({
        id: 10,
        name: 'State Rivalry',
        weekPlayed: 3,
      }),
    ]);
  });
});
