import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../db/db';
import type { LeagueStage } from '../../../types/domain';
import type { LeagueState } from '../../../types/league';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestPlayerSeason,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
  buildTestTeam,
  TEST_NAMES_DATA,
  TEST_STATES_DATA,
} from '../../../test/fixtures';
import {
  buildRecruitingProspect,
  buildRecruitingState,
} from '../../../test/recruitingFixtures';
import {
  loadSeasonSummary,
} from './seasonSummary';
import { loadRosterCuts } from './loadRosterCuts';
import { loadRecruitingSummary } from './loadRecruitingSummary';
import { loadRecruiting } from './loadRecruiting';
import { loadRealignment } from './loadRealignment';
import { loadRosterProgression } from './loadRosterProgression';
import { loadNonCon } from './season/loadNonCon';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from '../../rosterConfig';

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

const resetDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const buildCompliantRoster = () => {
  let id = 1;
  return POSITION_ORDER.flatMap(position =>
    Array.from({ length: ROSTER[position].total }, (_, index) =>
      buildTestPlayer({
        id: id++,
        pos: position,
        year: index % 2 ? 'jr' : 'sr',
        rating: 70 + index,
        rating_sr: 78 + index,
        starter: false,
      }),
    ),
  );
};

const seedScenario = async (stage: LeagueStage) => {
  const db = await getDb();
  const baseLeague = buildTestLeague(stage);
  const opponent = buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH', ranking: 2 });
  const summaryLeague = buildTestLeague(stage, {
    teams: [baseLeague.teams[0], opponent],
    conferences: [{
      ...baseLeague.conferences[0],
      teams: [baseLeague.teams[0], opponent],
    }],
    settings: {
      ...baseLeague.settings,
      playoffTeams: 2,
      playoffAutobids: 0,
      conferenceChampionsReceiveTopSeeds: false,
    },
    playoff: { seeds: [1, 2], natty: 1 },
  });
  const tx = db.transaction([
    'baseData',
    'league',
    'recruiting',
    'players',
    'games',
    'seasonMemories',
    'playerSeasons',
  ], 'readwrite');
  await tx.objectStore('league').put({
    key: 'current',
    value: stage === 'summary' ? summaryLeague : baseLeague,
  });
  if (stage === 'roster_cuts') {
    for (const player of buildCompliantRoster()) {
      await tx.objectStore('players').put(player);
    }
  } else {
    await tx.objectStore('players').put(buildTestPlayer());
    if (stage === 'summary') {
      await tx.objectStore('players').put(buildTestPlayer({ id: 2, teamId: 2 }));
      await tx.objectStore('games').put({
        id: 1,
        teamAId: 1,
        teamBId: 2,
        homeTeamId: null,
        awayTeamId: null,
        neutralSite: true,
        venue: null,
        winnerId: 1,
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
        weekPlayed: 18,
        year: 2025,
        rankATOG: 1,
        rankBTOG: 2,
        resultA: 'W',
        resultB: 'L',
        overtime: 0,
        quarter: 4,
        clockSecondsLeft: 0,
        scoreA: 31,
        scoreB: 24,
        watchability: 90,
      });
      await tx.objectStore('seasonMemories').put(buildTestSeasonMemory({
        year: summaryLeague.info.currentYear,
        teamSnapshots: [
          buildTestSeasonTeamSnapshot({ teamId: 1 }),
          buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2 }),
        ],
      }));
      await tx.objectStore('playerSeasons').put(buildTestPlayerSeason({
        year: summaryLeague.info.currentYear,
        playerId: 1,
        teamId: 1,
      }));
      await tx.objectStore('playerSeasons').put(buildTestPlayerSeason({
        year: summaryLeague.info.currentYear,
        playerId: 2,
        teamId: 2,
      }));
    }
  }
  if (
    stage === 'recruiting' ||
    stage === 'recruiting_summary' ||
    stage === 'roster_cuts'
  ) {
    await tx.objectStore('recruiting').put({
      key: 'current',
      value: buildRecruitingState(
        stage === 'recruiting'
          ? { round: 1, status: 'active' }
          : undefined,
      ),
    });
  }
  await tx.objectStore('baseData').put({
    key: 'history',
    value: {
      years: [2024],
      conf_index: { 'Test Conference': 1 },
      teams: {},
    },
  });
  await tx.objectStore('baseData').put({
    key: 'rivalries',
    value: { rivalries: [] },
  });
  await tx.objectStore('baseData').put({
    key: 'prestige_config',
    value: { 1: 0, 2: 0, 3: 0, 4: 100, 5: 0, 6: 0, 7: 0 },
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
    key: 'seasons:index',
    value: { years: ['2026'] },
  });
  await tx.objectStore('baseData').put({
    key: 'seasons:2026',
    value: {
      year: 2026,
      playoff: {
        teams: 12,
        conf_champ_autobids: 6,
        conf_champ_top_4: true,
      },
      conferences: {
        'Test Conference': {
          games: 0,
          teams: { 'Test State': 4 },
        },
      },
      independents: {},
      results: null,
    },
  });
  await tx.objectStore('baseData').put({
    key: 'names',
    value: TEST_NAMES_DATA,
  });
  await tx.objectStore('baseData').put({
    key: 'states',
    value: TEST_STATES_DATA,
  });
  await tx.done;
};

const snapshotLifecycleStores = async () => {
  const db = await getDb();
  const league = await db.get('league', 'current');
  const history = await db.get('baseData', 'history');
  return {
    league: league?.value as LeagueState,
    recruiting: await db.get('recruiting', 'current'),
    history: history?.value,
    players: await db.getAll('players'),
    games: await db.getAll('games'),
    drives: await db.getAll('gameDetails'),
    plays: await db.getAll('playerSeasons'),
    gameLogs: await db.getAll('historicalPlayers'),
  };
};

describe('lifecycle loaders', () => {
  beforeEach(resetDatabase);

  it.each([
    ['summary', loadSeasonSummary],
    ['realignment', loadRealignment],
    ['progression', loadRosterProgression],
    ['recruiting', loadRecruiting],
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

  it('projects both prestige windows and the complete target without writing it', async () => {
    await seedScenario('summary');
    const before = await snapshotLifecycleStores();

    const summary = await loadSeasonSummary();

    expect(summary.teams).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Test State',
        prestige: 4,
        next_prestige: 4,
        prestige_change: 0,
        avg_rank_before: null,
        avg_rank_after: 1,
        prestige_score_before: null,
        prestige_score_after: 100,
        prestige_seasons_before: 0,
        prestige_seasons_after: 1,
      }),
      expect.objectContaining({
        name: 'Other State',
        prestige: 4,
        next_prestige: 4,
        prestige_change: 0,
        avg_rank_before: null,
        avg_rank_after: 2,
        prestige_score_before: null,
        prestige_score_after: 0,
        prestige_seasons_before: 0,
        prestige_seasons_after: 1,
      }),
    ]));
    expect(await snapshotLifecycleStores()).toEqual(before);
  });

  it('returns exact empty page payloads from every off-stage lifecycle loader', async () => {
    await seedScenario('season');
    const before = await snapshotLifecycleStores();

    const summary = await loadSeasonSummary();
    const realignment = await loadRealignment();
    const progression = await loadRosterProgression();
    const recruiting = await loadRecruitingSummary();
    const interactiveRecruiting = await loadRecruiting();
    const cuts = await loadRosterCuts();
    const preseason = await loadNonCon();

    expect(summary).toMatchObject({
      championship: null,
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
      },
    });
    expect(interactiveRecruiting).toMatchObject({
      cursor: null,
      userRecruiting: null,
      prospects: [],
      positions: [],
      rules: null,
    });
    expect(cuts).toMatchObject({
      players: [],
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

  it.each([
    {
      winnerId: 1,
      scoreA: 31,
      scoreB: 24,
      champion: 'Test State',
      runnerUp: 'Other State',
      championScore: 31,
      runnerUpScore: 24,
    },
    {
      winnerId: 2,
      scoreA: 20,
      scoreB: 27,
      champion: 'Other State',
      runnerUp: 'Test State',
      championScore: 27,
      runnerUpScore: 20,
    },
  ])('orients the championship projection around winner $winnerId', async ({
    winnerId,
    scoreA,
    scoreB,
    champion,
    runnerUp,
    championScore,
    runnerUpScore,
  }) => {
    await seedScenario('summary');
    const db = await getDb();
    const game = await db.get('games', 1);
    await db.put('games', {
      ...game!,
      winnerId,
      scoreA,
      scoreB,
      resultA: winnerId === 1 ? 'W' : 'L',
      resultB: winnerId === 2 ? 'W' : 'L',
    });

    const summary = await loadSeasonSummary();

    expect(summary.championship).toMatchObject({
      gameId: 1,
      champion: { name: champion },
      runnerUp: { name: runnerUp },
      championScore,
      runnerUpScore,
    });
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

  it('returns an explicit preview error for malformed historical data', async () => {
    await seedScenario('realignment');
    const db = await getDb();
    await db.put('baseData', {
      key: 'seasons:2026',
      value: { playoff: { teams: 6 }, conferences: {} },
    });

    const result = await loadRealignment();

    expect(result.preview).toBeNull();
    expect(result.previewError).toContain('malformed');
    expect(result.info.stage).toBe('realignment');
  });

  it('rejects missing rosters without writing a replacement', async () => {
    await seedScenario('progression');
    const db = await getDb();
    await db.clear('players');
    const before = await snapshotLifecycleStores();

    await expect(loadRosterProgression()).rejects.toMatchObject({
      code: 'INVALID_ROSTER_STATE',
    });

    expect(await snapshotLifecycleStores()).toEqual(before);
  });

  it('returns a focused deterministic roster-cuts preview', async () => {
    await seedScenario('roster_cuts');
    const db = await getDb();
    await db.clear('players');
    const players = buildCompliantRoster();
    players.push(
      buildTestPlayer({
        id: 100,
        first: 'Extra Quarterback',
        pos: 'qb',
        rating: 40,
        rating_sr: 45,
      }),
    );
    const tx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await tx.objectStore('players').put(player);
    }
    await tx.done;

    const result = await loadRosterCuts();

    expect(result.players.find(player => player.id === 100)).toEqual(
      {
        id: 100,
        first: 'Extra Quarterback',
        last: 'Player',
        position: 'qb',
        currentClass: 'jr',
        currentRating: 40,
        selected: false,
        recommended: true,
        protected: false,
        canSelect: true,
        blockedReason: null,
      },
    );
    expect(result.positions[0]).toEqual({
      position: 'qb',
      activePlayers: ROSTER.qb.total + 1,
      rosterLimit: ROSTER.qb.total,
      starterMinimum: 1,
      selectedCuts: 0,
      projectedCuts: 1,
      projectedPlayers: ROSTER.qb.total,
    });
    expect(result.summary).toEqual({
      activePlayers: FINAL_ROSTER_SIZE + 1,
      requiredCuts: 1,
      selectedCuts: 0,
      remainingCuts: 1,
      projectedCuts: 1,
      projectedRosterSize: FINAL_ROSTER_SIZE,
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

  it('returns complete typed recruiting results', async () => {
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
    ];
    const tx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await tx.objectStore('players').put(player);
    }
    await tx.done;
    const recruiting = (await db.get('recruiting', 'current'))!;
    await db.put('recruiting', {
      ...recruiting,
      value: {
        ...recruiting.value,
        prospects: [
          buildRecruitingProspect({
            id: 20,
            nationalRank: 1,
            committedTeamId: 1,
            committedRound: 5,
            position: 'wr',
            stars: 5,
          }),
          buildRecruitingProspect({
            id: 21,
            nationalRank: 4,
            committedTeamId: 1,
            committedRound: 'signing_day',
            position: 'qb',
            stars: 4,
          }),
        ],
        teams: recruiting.value.teams.map(team => ({
          ...team,
          commitmentIds:
            team.teamId === 1 ? [20, 21] : team.commitmentIds,
        })),
      },
    });

    const result = await loadRecruitingSummary();

    expect(result.playerRankings.map(player => player.prospectId)).toEqual([
      20,
      21,
    ]);
    expect(result.playerRankings.map(player => player.rank)).toEqual([1, 4]);
    expect(result.teamRankings).toHaveLength(1);
    expect(result.userTeam).toMatchObject({
      teamId: 1,
      totalRecruits: 2,
      averageStars: 4.5,
      starCounts: { five: 1, four: 1 },
    });
    expect(result.positions).toEqual(['qb', 'wr']);
    expect(result.summary).toEqual({
      totalRecruits: 2,
    });
    expect(result.playerRankings[0]).not.toHaveProperty('rating');
    expect(result).not.toHaveProperty('team_rankings');
    expect(result).not.toHaveProperty('summary_stats');
  });

  it.each([
    ['recruiting_summary', loadRecruitingSummary],
    ['roster_cuts', loadRosterCuts],
  ] as const)(
    'rejects unsupported %s saves without recruiting state',
    async (stage, loader) => {
      await seedScenario(stage);
      const db = await getDb();
      await db.clear('recruiting');
      const before = await snapshotLifecycleStores();

      await expect(loader()).rejects.toMatchObject({
        code: 'STATE_MISSING',
      });
      expect(await snapshotLifecycleStores()).toEqual(before);
    },
  );
});
