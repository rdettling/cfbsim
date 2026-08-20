import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../db/db';
import type { LeagueState } from '../../../types/league';
import {
  buildTestLeague,
  buildTestPlayParticipants,
  buildTestPlayer,
  buildTestTeam,
  TEST_NAMES_DATA,
  TEST_STATES_DATA,
} from '../../../test/fixtures';
import { TEST_BETTING_ODDS_DATA } from '../../../test/fixtures';
import { advanceOffseasonStage } from './stages';
import { updateNextSeasonConfiguration } from './nextSeasonConfiguration';
import { loadRecruitingSummary } from '../loaders/loadRecruitingSummary';
import { loadRealignment } from '../loaders/loadRealignment';
import { loadRosterCuts } from '../loaders/loadRosterCuts';
import { loadRosterProgression } from '../loaders/loadRosterProgression';
import { loadSeasonSummary } from '../loaders/seasonSummary';
import { loadNonCon } from '../loaders/season/loadNonCon';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from '../../rosterConfig';
import {
  advanceRecruitingRound,
  finalizeRecruiting,
} from './recruiting';
import { finalizeRoster } from './rosterFinalization';
import { loadRecruitingState } from '../../../db/recruitingRepo';
import type { GameRecord } from '../../../types/db';

const resetDatabase = async () => {
  const db = await getDb();
  const stores = [
    'baseData',
    'league',
    'recruiting',
    'players',
    'games',
  'gameDetails',
  'newsItems',
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
  const baseLeague = buildTestLeague('summary');
  const userTeam = baseLeague.teams[0];
  const opponent = buildTestTeam({
    id: 2,
    name: 'Opponent State',
    abbreviation: 'OPP',
    ranking: 2,
    conference: 'Test Conference',
  });
  const league = buildTestLeague('summary', {
    teams: [userTeam, opponent],
    conferences: [{
      ...baseLeague.conferences[0],
      teams: [userTeam, opponent],
    }],
    settings: {
      ...baseLeague.settings,
      playoffTeams: 2,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    },
    playoff: { seeds: [userTeam.id, opponent.id], natty: 1 },
    idCounters: { game: 2, player: 3 },
  });
  const championship: GameRecord = {
    id: 1,
    teamAId: userTeam.id,
    teamBId: opponent.id,
    homeTeamId: null,
    awayTeamId: null,
    neutralSite: true,
    venue: null,
    winnerId: userTeam.id,
    baseLabel: 'National Championship',
    name: 'National Championship',
    gameType: 'national_championship',
    rivalryKey: null,
    spreadA: '-3',
    spreadB: '+3',
    moneylineA: '-150',
    moneylineB: '+130',
    winProbA: 0.6,
    winProbB: 0.4,
    weekPlayed: 16,
    year: 2025,
    rankATOG: 1,
    rankBTOG: 2,
    resultA: 'W',
    resultB: 'L',
    overtime: 0,
    quarter: 4,
    clockSecondsLeft: 0,
    scoreA: 6,
    scoreB: 0,
    watchability: 95,
  };
  const tx = db.transaction(
    ['baseData', 'league', 'players', 'games', 'gameDetails'],
    'readwrite',
  );
  await tx.objectStore('league').put({
    key: 'current',
    value: league,
  });
  await tx.objectStore('players').put(buildTestPlayer());
  await tx.objectStore('players').put(buildTestPlayer({ id: 2, teamId: 2 }));
  await tx.objectStore('games').put(championship);
  await tx.objectStore('gameDetails').put({
    gameId: championship.id,
    year: championship.year,
    drives: [{
      driveNum: 0,
      offenseId: userTeam.id,
      defenseId: opponent.id,
      startingFP: 94,
      result: 'touchdown',
      points: 6,
      scoreAAfter: 6,
      scoreBAfter: 0,
      plays: [{
        startingFP: 94,
        down: 1,
        yardsLeft: 6,
        playType: 'run',
        yardsGained: 6,
        result: 'touchdown',
        text: 'Test State scored.',
        header: '1st and goal',
        scoreA: 0,
        scoreB: 0,
        call: { kind: 'scrimmage', offense: 'option', defense: 'base' },
        participants: buildTestPlayParticipants({ rusherId: 1 }),
        timing: {
          kind: 'regulation',
          start: { quarter: 4, secondsLeft: 6, running: true },
          end: { quarter: 4, secondsLeft: 0, running: false },
          elapsedSeconds: 6,
          outOfBounds: false,
          tempo: 'normal',
          eventAfter: 'end_of_regulation',
          chargedTimeoutAfter: null,
        },
      }],
    }],
    playerStats: [{
      playerId: 1,
      pass_yards: 0,
      pass_attempts: 0,
      pass_completions: 0,
      pass_touchdowns: 0,
      pass_interceptions: 0,
      rush_yards: 6,
      rush_attempts: 1,
      rush_touchdowns: 1,
      receiving_yards: 0,
      receiving_catches: 0,
      receiving_touchdowns: 0,
      fumbles: 0,
      tackles: 0,
      sacks: 0,
      interceptions: 0,
      fumbles_forced: 0,
      fumbles_recovered: 0,
      field_goals_made: 0,
      field_goals_attempted: 0,
      extra_points_made: 0,
      extra_points_attempted: 0,
    }],
  });

  const baseRecords = [
    {
      key: 'history',
      value: {
        years: [2024],
        conf_index: { 'Test Conference': 1 },
        teams: { 'Test State': [[2024, 1, 1, 12, 0, 4]] },
      },
    },
    {
      key: 'prestige_config',
      value: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 100 },
    },
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
          'Entry State': {
            mascot: 'Entrants',
            abbreviation: 'ENT',
            ceiling: 6,
            floor: 1,
            colorPrimary: '#654321',
            colorSecondary: '#ffffff',
            city: 'Entry City',
            state: 'TS',
            stadium: 'Entry Stadium',
          },
          'Opponent State': {
            mascot: 'Opponents',
            abbreviation: 'OPP',
            ceiling: 5,
            floor: 1,
            colorPrimary: '#333333',
            colorSecondary: '#ffffff',
            city: 'Opponent City',
            state: 'TS',
            stadium: 'Opponent Stadium',
          },
        },
      },
    },
    { key: 'conferences', value: { 'Test Conference': 'Test Conference' } },
    { key: 'seasons:index', value: { years: ['2026', '2025'] } },
    {
      key: 'seasons:2026',
      value: {
        year: 2026,
        playoff: {
          teams: 4,
          conf_champ_autobids: 0,
          conf_champ_top_4: false,
        },
        conferences: {
          'Test Conference': {
            games: 0,
            teams: { 'Test State': 4, 'Opponent State': 3, 'Entry State': 3 },
          },
        },
        independents: {},
        results: null,
      },
    },
    {
      key: 'names',
      value: TEST_NAMES_DATA,
    },
    { key: 'states', value: TEST_STATES_DATA },
    { key: 'rivalries', value: { rivalries: [] } },
    { key: 'betting_odds', value: TEST_BETTING_ODDS_DATA },
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
    expect(summaryReload).toEqual(summaryPreview);
    await advanceOffseasonStage('summary');
    let league = await loadPersistedLeague();
    const memoryDb = await getDb();
    expect(await memoryDb.get('seasonMemories', 2025)).toMatchObject({
      year: 2025,
      postseason: {
        playoff: { format: 2, seeds: [1, 2], games: { championship: 1 } },
      },
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
    expect(league.teams.map(team => team.name)).toContain('Entry State');
    const entryTeam = league.teams.find(team => team.name === 'Entry State')!;
    const entryPlayers = (await memoryDb.getAll('players')).filter(
      player => player.teamId === entryTeam.id,
    );
    expect(entryPlayers).toHaveLength(FINAL_ROSTER_SIZE);
    expect(new Set(entryPlayers.map(player => player.year))).toEqual(
      new Set(['fr', 'so', 'jr', 'sr']),
    );
    expect(
      (await memoryDb.getAll('playerOrigins')).filter(
        origin => origin.kind === 'program_entry',
      ),
    ).toHaveLength(FINAL_ROSTER_SIZE);
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
    expect(
      (await db.getAllFromIndex('players', 'teamId', entryTeam.id)).filter(
        player => player.year !== 'fr',
      ),
    ).toHaveLength(60);
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
    progressionLeague.idCounters!.player = 200;
    await db.put('league', {
      key: 'current',
      value: progressionLeague,
    });
    const existingPlayers = await db.getAll('players');
    const playerIdsToReplace = existingPlayers
      .filter(player => player.teamId === progressionLeague.teams[0].id)
      .map(player => player.id);
    const replacementTx = db.transaction('players', 'readwrite');
    for (const playerId of playerIdsToReplace) {
      await replacementTx.objectStore('players').delete(playerId);
    }
    await replacementTx.done;
    const previewPlayers = [
      buildTestPlayer({
        id: 100,
        year: 'fr',
        rating: 70,
        rating_so: 74,
      }),
      buildTestPlayer({
        id: 101,
        year: 'so',
        rating: 75,
        rating_jr: 81,
      }),
      buildTestPlayer({
        id: 102,
        year: 'jr',
        rating: 80,
        rating_sr: 87,
      }),
      buildTestPlayer({
        id: 103,
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
    expect(preview.departing.map(player => player.id)).toEqual([103]);

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
    expect(persistedPlayers.some(player => player.id === 103)).toBe(false);

    await expect(
      advanceOffseasonStage('progression'),
    ).rejects.toMatchObject({
      actualStage: 'recruiting',
    });
  });

});
