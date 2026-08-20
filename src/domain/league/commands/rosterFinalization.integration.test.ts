import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../db/db';
import { loadRecruitingState } from '../../../db/recruitingRepo';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../../test/fixtures';
import {
  TEST_BETTING_ODDS_DATA,
  TEST_NAMES_DATA,
  TEST_TEAMS_DATA,
} from '../../../test/fixtures';
import { buildRecruitingState } from '../../../test/recruitingFixtures';
import type { PlayerRecord } from '../../../types/db';
import type { LeagueState } from '../../../types/league';
import type { RecruitingState } from '../../../types/recruiting';
import type { RosterFinalizationCommandGuard } from '../../../types/roster';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from '../../rosterConfig';
import {
  finalizeRoster,
  initializeRosterFinalization,
  selectRosterCut,
  undoRosterCut,
} from './rosterFinalization';

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
  ] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const buildRoster = (
  teamId: number,
  startId: number,
): PlayerRecord[] => {
  let id = startId;
  return POSITION_ORDER.flatMap(position =>
    Array.from({ length: ROSTER[position].total }, (_, index) =>
      buildTestPlayer({
        id: id++,
        teamId,
        pos: position,
        year: index % 3 === 0 ? 'so' : index % 3 === 1 ? 'jr' : 'sr',
        rating: 70 + index,
        rating_sr: 78 + index,
        starter: false,
      }),
    ),
  );
};

const seedBaseData = async () => {
  const db = await getDb();
  const records = [
    {
      key: 'names',
      value: TEST_NAMES_DATA,
    },
    { key: 'rivalries', value: { rivalries: [] } },
    { key: 'teams', value: TEST_TEAMS_DATA },
    { key: 'betting_odds', value: TEST_BETTING_ODDS_DATA },
  ];
  const tx = db.transaction('baseData', 'readwrite');
  for (const record of records) {
    await tx.objectStore('baseData').put(record);
  }
  await tx.done;
};

const seedRosterCuts = async () => {
  await seedBaseData();
  const db = await getDb();
  const user = buildTestTeam({ id: 1 });
  const other = buildTestTeam({ id: 2, name: 'Other State' });
  const league = buildTestLeague('roster_cuts', {
    teams: [user, other],
    idCounters: {
      game: 2,
      player: 500,
    },
  });
  const players = [
    ...buildRoster(1, 1),
    buildTestPlayer({
      id: 100,
      teamId: 1,
      pos: 'qb',
      year: 'sr',
      rating: 40,
      rating_sr: 45,
    }),
    ...buildRoster(2, 200),
    buildTestPlayer({
      id: 300,
      teamId: 2,
      pos: 'qb',
      year: 'sr',
      rating: 40,
      rating_sr: 45,
    }),
    buildTestPlayer({
      id: 301,
      teamId: 2,
      pos: 'rb',
      year: 'fr',
      rating: 30,
      rating_sr: 42,
    }),
  ];
  const recruiting = buildRecruitingState({
    teams: [
      buildRecruitingState().teams[0],
      {
        teamId: 2,
        board: [],
        allocations: {},
        commitmentIds: [],
        baseSigningCapacity: 0,
        oversignCapacity: 4,
        pointBudget: 105,
      },
    ],
  });
  const tx = db.transaction(
    ['league', 'recruiting', 'players', 'playerOrigins'],
    'readwrite',
  );
  await tx.objectStore('league').put({ key: 'current', value: league });
  await tx.objectStore('recruiting').put({
    key: 'current',
    value: recruiting,
  });
  for (const player of players) {
    await tx.objectStore('players').put(player);
    await tx.objectStore('playerOrigins').put({
      playerId: player.id,
      kind: 'initial_roster',
      acquisitionYear: league.info.startYear,
      originalTeamId: player.teamId,
      classAtStart: player.year,
    });
  }
  await tx.done;
  return { league, players, recruiting };
};

const guard = (version: number): RosterFinalizationCommandGuard => ({
  expectedStage: 'roster_cuts',
  expectedYear: 2025,
  expectedRound: 6,
  expectedStatus: 'finalized',
  expectedVersion: version,
});

const snapshot = async () => {
  const db = await getDb();
  return {
    league: await db.get('league', 'current'),
    recruiting: await db.get('recruiting', 'current'),
    players: await db.getAll('players'),
    games: await db.getAll('games'),
    drives: await db.getAll('gameDetails'),
    plays: await db.getAll('playerSeasons'),
    logs: await db.getAll('historicalPlayers'),
    origins: await db.getAll('playerOrigins'),
  };
};

describe('persistent roster finalization', () => {
  beforeEach(resetDatabase);

  it('generates walk-ons exactly once after recruiting summary', async () => {
    await seedBaseData();
    const db = await getDb();
    const teams = [
      buildTestTeam({ id: 1 }),
      buildTestTeam({ id: 2, name: 'Other State' }),
    ];
    const league = buildTestLeague('recruiting_summary', {
      teams,
      idCounters: {
        game: 2,
        player: 500,
      },
    });
    const players = teams.flatMap((team, index) =>
      buildRoster(team.id, index * 100 + 1).slice(
        0,
        FINAL_ROSTER_SIZE - 4,
      ),
    );
    await db.put('league', { key: 'current', value: league });
    await db.put('recruiting', {
      key: 'current',
      value: buildRecruitingState(),
    });
    const playerTx = db.transaction('players', 'readwrite');
    for (const player of players) {
      await playerTx.objectStore('players').put(player);
    }
    await playerTx.done;

    const result = await initializeRosterFinalization({
      expectedStage: 'recruiting_summary',
      expectedYear: 2025,
    });
    expect(result.currentStage).toBe('roster_cuts');
    const persisted = await db.getAll('players');
    teams.forEach(team => {
      expect(
        persisted.filter(player => player.teamId === team.id),
      ).toHaveLength(FINAL_ROSTER_SIZE);
    });
    expect(persisted.filter(player => player.year === 'fr')).toHaveLength(8);
    const origins = await db.getAll('playerOrigins');
    expect(origins.filter(origin => origin.kind === 'walk_on')).toHaveLength(8);
    expect((await loadRecruitingState())?.version).toBe(9);

    const after = await snapshot();
    await expect(
      initializeRosterFinalization({
        expectedStage: 'recruiting_summary',
        expectedYear: 2025,
      }),
    ).rejects.toMatchObject({ code: 'STAGE_MISMATCH' });
    expect(await snapshot()).toEqual(after);
  });

  it('persists guarded user selections and supports undo', async () => {
    await seedRosterCuts();
    const selected = await selectRosterCut(guard(8), 100);
    expect(selected).toMatchObject({
      version: 9,
      pendingUserCutIds: [100],
      requiredCuts: 1,
    });
    expect((await loadRecruitingState())?.pendingUserCutIds).toEqual([100]);

    const beforeStale = await snapshot();
    await expect(selectRosterCut(guard(8), 1)).rejects.toMatchObject({
      code: 'VERSION_MISMATCH',
    });
    expect(await snapshot()).toEqual(beforeStale);

    const undone = await undoRosterCut(guard(9), 100);
    expect(undone).toMatchObject({
      version: 10,
      pendingUserCutIds: [],
    });
  });

  it('rejects protected and starter-breaking selections atomically', async () => {
    const { players } = await seedRosterCuts();
    const db = await getDb();
    const freshman = players.find(
      player => player.teamId === 1 && player.pos === 'qb',
    )!;
    freshman.year = 'fr';
    await db.put('players', freshman);
    const before = await snapshot();
    await expect(selectRosterCut(guard(8), freshman.id)).rejects.toMatchObject({
      code: 'FRESHMAN_PROTECTED',
    });
    expect(await snapshot()).toEqual(before);
  });

  it('fills every user cut when finalizing without selections', async () => {
    await seedRosterCuts();
    await finalizeRoster(guard(8));
    const db = await getDb();
    const players = await db.getAll('players');

    expect(players.some(player => player.id === 100)).toBe(false);
    expect(await db.get('playerOrigins', 100)).toBeUndefined();
  });

  it('preserves user selections and fills only the remaining cuts', async () => {
    await seedRosterCuts();
    const db = await getDb();
    await db.put(
      'players',
      buildTestPlayer({
        id: 101,
        teamId: 1,
        pos: 'rb',
        year: 'jr',
        rating: 41,
        rating_sr: 99,
      }),
    );
    const selected = await selectRosterCut(guard(8), 100);
    await finalizeRoster(guard(selected.version));
    const league = (await db.get('league', 'current'))?.value as LeagueState;
    const players = await db.getAll('players');
    expect(league.info.stage).toBe('preseason');
    expect(await loadRecruitingState()).toBeNull();
    for (const team of league.teams) {
      const active = players.filter(
        player => player.teamId === team.id,
      );
      expect(active).toHaveLength(FINAL_ROSTER_SIZE);
      for (const position of POSITION_ORDER) {
        expect(
          active.filter(
            player => player.pos === position && player.starter,
          ),
        ).toHaveLength(ROSTER[position].starters);
      }
    }
    expect(players.some(player => player.id === 100)).toBe(false);
    expect(players.some(player => player.id === 101)).toBe(false);
    expect(players.some(player => player.id === 301)).toBe(true);
  });

  it('allows only one concurrent finalizer and applies outcomes once', async () => {
    await seedRosterCuts();
    const selected = await selectRosterCut(guard(8), 100);
    const results = await Promise.allSettled([
      finalizeRoster(guard(selected.version)),
      finalizeRoster(guard(selected.version)),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const db = await getDb();
    expect(await db.get('recruiting', 'current')).toBeUndefined();
  });

  it('rolls back every store when season reset data is missing', async () => {
    await seedRosterCuts();
    const selected = await selectRosterCut(guard(8), 100);
    const db = await getDb();
    await db.delete('baseData', 'betting_odds');
    const before = await snapshot();
    await expect(finalizeRoster(guard(selected.version))).rejects.toThrow(
      /Season reset data/,
    );
    expect(await snapshot()).toEqual(before);
  });

  it('rejects malformed required recruiting values without repair', async () => {
    await seedRosterCuts();
    const db = await getDb();
    const record = await db.get('recruiting', 'current');
    await db.put('recruiting', {
      key: 'current',
      value: {
        ...record!.value,
        seed: undefined,
      } as unknown as RecruitingState,
    });
    const before = await snapshot();
    await expect(selectRosterCut(guard(8), 100)).rejects.toMatchObject({
      code: 'INVALID_RECRUITING_STATE',
    });
    expect(await snapshot()).toEqual(before);
  });
});
