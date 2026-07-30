import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import type { LeagueState } from '../../types/league';
import {
  buildTestLeague,
  buildTestPlayer,
} from '../../test/fixtures';
import { advanceOffseasonStage } from './stages';
import { updateNextSeasonConfiguration } from './nextSeasonConfiguration';
import { loadRecruitingSummary } from './loaders/loadRecruitingSummary';
import { loadRealignment } from './loaders/loadRealignment';
import { loadRosterCuts } from './loaders/loadRosterCuts';
import { loadRosterProgression } from './loaders/loadRosterProgression';
import { loadSeasonSummary } from './loaders/offseason';
import { loadNonCon } from './loaders/season/loadNonCon';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from '../rosterConfig';
import {
  advanceRecruitingRound,
  finalizeRecruiting,
} from './recruiting';
import { finalizeRoster } from './rosterFinalization';
import { loadRecruitingState } from '../../db/recruitingRepo';

const resetDatabase = async () => {
  const db = await getDb();
  const stores = [
    'baseData',
    'league',
    'recruiting',
    'players',
    'games',
    'gameDetails',
    'playerSeasons',
    'historicalPlayers',
    'playerOrigins',
    'seasonMemories',
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
            games: 0,
            teams: { 'Test State': 4 },
          },
        },
        independents: {},
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
    { key: 'betting_odds', value: { odds: {}, max_diff: 100 } },
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
    const memoryDb = await getDb();
    expect(await memoryDb.get('seasonMemories', 2025)).toMatchObject({
      year: 2025,
      playoffTeams: 12,
      events: [],
    });
    expect(league.info.stage).toBe('realignment');
    expect(league.teams[0]).toMatchObject({
      prestige: 5,
      prestige_change: 0,
    });
    await expect(advanceOffseasonStage('summary')).rejects.toMatchObject({
      actualStage: 'realignment',
    });
    expect(await memoryDb.count('seasonMemories')).toBe(1);

    const setupPreview = await loadRealignment();
    await expect(loadRealignment()).resolves.toEqual(setupPreview);
    await advanceOffseasonStage('realignment');
    league = await loadPersistedLeague();
    expect(league.info).toMatchObject({
      stage: 'progression',
      currentYear: 2026,
    });
    expect(league.settings.playoffTeams).toBe(4);
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
    expect(league.info.stage).toBe('recruiting');
    expect((await loadRecruitingState())?.version).toBe(1);
    expect((await db.get('players', 1))).toMatchObject({
      year: 'sr',
      rating: 85,
    });
    await expect(
      advanceOffseasonStage('progression'),
    ).rejects.toMatchObject({
      actualStage: 'recruiting',
    });

    for (let round = 1; round <= 6; round += 1) {
      const state = await loadRecruitingState();
      await advanceRecruitingRound({
        expectedStage: 'recruiting',
        expectedYear: 2026,
        expectedRound: round as 1 | 2 | 3 | 4 | 5 | 6,
        expectedVersion: state!.version,
        allocations: {},
      });
    }
    const ready = await loadRecruitingState();
    await finalizeRecruiting({
      expectedStage: 'recruiting',
      expectedYear: 2026,
      expectedRound: 6,
      expectedVersion: ready!.version,
    });
    const recruitedPlayers = await db.getAll('players');
    expect((await loadPersistedLeague()).info.stage).toBe(
      'recruiting_summary',
    );
    const finalizedRecruiting = (await loadRecruitingState())!;
    const recruitingSummary = await loadRecruitingSummary();
    const persistedFreshmen = recruitedPlayers
      .filter(player => player.year === 'fr')
      .length;
    const committedProspects = finalizedRecruiting.prospects
      .filter(prospect => prospect.committedTeamId !== null)
      .sort(
        (left, right) =>
          left.nationalRank - right.nationalRank || left.id - right.id,
      );
    expect(recruitingSummary.playerRankings).toHaveLength(
      persistedFreshmen,
    );
    expect(
      recruitingSummary.playerRankings.map(player => ({
        id: player.prospectId,
        rank: player.rank,
      })),
    ).toEqual(
      committedProspects.map(prospect => ({
        id: prospect.id,
        rank: prospect.nationalRank,
      })),
    );
    await expect(loadRecruitingSummary()).resolves.toEqual(
      recruitingSummary,
    );

    await advanceOffseasonStage('recruiting_summary');
    expect((await loadPersistedLeague()).info.stage).toBe('roster_cuts');
    expect(await loadRecruitingState()).not.toBeNull();
    const rosterCutPlayers = await db.getAll('players');
    recruitedPlayers.forEach(player => {
      expect(rosterCutPlayers).toContainEqual(player);
    });
    await expect(
      advanceOffseasonStage('recruiting_summary'),
    ).rejects.toMatchObject({
      actualStage: 'roster_cuts',
    });

    const cutsPreview = await loadRosterCuts();
    await expect(loadRosterCuts()).resolves.toEqual(cutsPreview);
    expect(cutsPreview.summary).toMatchObject({
      activePlayers: FINAL_ROSTER_SIZE,
      requiredCuts: 0,
    });
    const finalizationGuard = {
      expectedStage: 'roster_cuts' as const,
      expectedYear: 2026,
      expectedRound: 6 as const,
      expectedStatus: 'finalized' as const,
      expectedVersion: cutsPreview.cursor!.version,
    };
    await finalizeRoster(finalizationGuard);
    league = await loadPersistedLeague();
    const preseasonPlayers = await db.getAll('players');
    cutsPreview.recommendedCutIds.forEach(projectedId => {
      expect(
        preseasonPlayers.find(player => player.id === projectedId),
      ).toMatchObject({
        starter: false,
      });
    });
    league.teams.forEach(team => {
      POSITION_ORDER.forEach(position => {
        const active = preseasonPlayers.filter(
          player =>
            player.teamId === team.id &&
            player.pos === position,
        );
        expect(active.length).toBeGreaterThanOrEqual(
          ROSTER[position].starters,
        );
        expect(active.filter(player => player.starter)).toHaveLength(
          ROSTER[position].starters,
        );
      });
      expect(
        preseasonPlayers.filter(
          player => player.teamId === team.id,
        ),
      ).toHaveLength(FINAL_ROSTER_SIZE);
    });
    expect(league.info.stage).toBe('preseason');
    expect(await loadRecruitingState()).toBeNull();
    expect(league.scheduleBuilt).toBe(false);
    expect(league.simInitialized).toBe(false);
    await expect(
      finalizeRoster(finalizationGuard),
    ).rejects.toBeDefined();
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
      expect(league.settings.conferencePolicy).toBe('historical');
    } else {
      expect(league.info).toMatchObject({
        stage: 'realignment',
        currentYear: 2025,
      });
      expect(league.settings.conferencePolicy).toBe('current');
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
      });
    });
    expect(persistedPlayers.some(player => player.id === 13)).toBe(false);

    await expect(
      advanceOffseasonStage('progression'),
    ).rejects.toMatchObject({
      actualStage: 'recruiting',
    });
  });

});
