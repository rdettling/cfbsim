import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import { loadRecruitingState } from '../../db/recruitingRepo';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import {
  buildRecruitingProspect,
  buildRecruitingState,
} from '../../test/recruitingFixtures';
import type { LeagueState } from '../../types/league';
import { RecruitingConflictError } from '../../types/recruiting';
import {
  advanceRecruitingRound,
  completeRecruitingWithAi,
  finalizeRecruiting,
  initializeRecruiting,
  updateRecruitingBoard,
} from './recruiting';
import { RECRUITING } from '../recruiting/config';
import { calculateInterestGain } from '../recruiting/rules';

const STORES = [
  'baseData',
  'league',
  'recruiting',
  'players',
  'games',
  'gameDetails',
  'playerSeasons',
  'historicalPlayers',
  'playerOrigins',
] as const;

const resetDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction([...STORES], 'readwrite');
  await Promise.all(STORES.map(store => tx.objectStore(store).clear()));
  await tx.done;
};

const seedProgression = async () => {
  const db = await getDb();
  const tx = db.transaction(
    ['baseData', 'league', 'players'],
    'readwrite',
  );
  await tx.objectStore('league').put({
    key: 'current',
    value: buildTestLeague('progression'),
  });
  await tx.objectStore('players').put(
    buildTestPlayer({ id: 10, year: 'jr', rating_sr: 88 }),
  );
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

const addAiTeam = async () => {
  const db = await getDb();
  const leagueRecord = await db.get('league', 'current');
  const league = leagueRecord!.value as ReturnType<typeof buildTestLeague>;
  const aiTeam = buildTestTeam({
    id: 2,
    name: 'AI State',
    abbreviation: 'AIS',
    state: 'OS',
    ranking: 2,
  });
  league.teams.push(aiTeam);
  league.conferences[0].teams.push(aiTeam);
  await db.put('league', { key: 'current', value: league });
  await db.put(
    'players',
    buildTestPlayer({ id: 20, teamId: aiTeam.id }),
  );
};

const snapshot = async () => {
  const db = await getDb();
  return {
    baseData: await db.getAll('baseData'),
    league: await db.get('league', 'current'),
    recruiting: await db.get('recruiting', 'current'),
    players: await db.getAll('players'),
    playerOrigins: await db.getAll('playerOrigins'),
  };
};

describe('persistent recruiting commands', () => {
  beforeEach(resetDatabase);

  it('initializes progression and the seeded aggregate atomically once', async () => {
    await seedProgression();
    const results = await Promise.allSettled([
      initializeRecruiting({
        expectedStage: 'progression',
        expectedYear: 2025,
        seed: 42,
      }),
      initializeRecruiting({
        expectedStage: 'progression',
        expectedYear: 2025,
        seed: 42,
      }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await loadRecruitingState())?.version).toBe(1);
    expect((await loadRecruitingState())?.seed).toBe(42);
    expect((await getDb().then(db => db.get('players', 10)))).toMatchObject({
      year: 'sr',
      rating: 88,
    });
    const league = (await getDb().then(db => db.get('league', 'current')))
      ?.value as ReturnType<typeof buildTestLeague>;
    expect(league.info.stage).toBe('recruiting');
  });

  it('leaves every store unchanged when initialization prerequisites fail', async () => {
    await seedProgression();
    const db = await getDb();
    await db.delete('baseData', 'names');
    const before = await snapshot();

    await expect(
      initializeRecruiting({
        expectedStage: 'progression',
        expectedYear: 2025,
        seed: 42,
      }),
    ).rejects.toThrow('source data is unavailable');

    expect(await snapshot()).toEqual(before);
  });

  it('persists board changes and rejects a stale retry without writes', async () => {
    await seedProgression();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 7,
    });
    const prospectId = (await loadRecruitingState())!.prospects[0].id;
    await updateRecruitingBoard({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 1,
      expectedVersion: 1,
      prospectIds: [prospectId],
    });
    const before = await snapshot();

    await expect(
      advanceRecruitingRound({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: 1,
        expectedVersion: 1,
        allocations: { [prospectId]: 20 },
      }),
    ).rejects.toMatchObject({
      code: 'VERSION_MISMATCH',
    });

    expect(await snapshot()).toEqual(before);
    expect((await loadRecruitingState())?.version).toBe(2);
  });

  it.each([
    [
      'STAGE_MISMATCH',
      {
        expectedStage: 'recruiting' as const,
        expectedYear: 2025,
        expectedRound: 1 as const,
        expectedVersion: 1,
      },
      'progression',
    ],
    [
      'YEAR_MISMATCH',
      {
        expectedStage: 'recruiting' as const,
        expectedYear: 2026,
        expectedRound: 1 as const,
        expectedVersion: 1,
      },
      'recruiting',
    ],
    [
      'ROUND_MISMATCH',
      {
        expectedStage: 'recruiting' as const,
        expectedYear: 2025,
        expectedRound: 2 as const,
        expectedVersion: 1,
      },
      'recruiting',
    ],
    [
      'VERSION_MISMATCH',
      {
        expectedStage: 'recruiting' as const,
        expectedYear: 2025,
        expectedRound: 1 as const,
        expectedVersion: 9,
      },
      'recruiting',
    ],
  ])('rejects %s without changing stores', async (code, guard, stage) => {
    await seedProgression();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 9,
    });
    if (stage !== 'recruiting') {
      const db = await getDb();
      const record = await db.get('league', 'current');
      const league = record!.value as ReturnType<typeof buildTestLeague>;
      league.info.stage = stage as 'progression';
      await db.put('league', { key: 'current', value: league });
    }
    const before = await snapshot();

    await expect(
      advanceRecruitingRound({ ...guard, allocations: {} }),
    ).rejects.toMatchObject({ code });

    expect(await snapshot()).toEqual(before);
  });

  it('rejects invalid allocations and finalized-state updates without writes', async () => {
    await seedProgression();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 10,
    });
    const beforeInvalidAllocation = await snapshot();
    await expect(
      advanceRecruitingRound({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: 1,
      expectedVersion: 1,
      allocations: { 999999: 500 },
      }),
    ).rejects.toBeDefined();
    expect(await snapshot()).toEqual(beforeInvalidAllocation);

    const db = await getDb();
    const record = await db.get('recruiting', 'current');
    const finalized = record!.value;
    finalized.status = 'finalized';
    await db.put('recruiting', { key: 'current', value: finalized });
    const beforeStatusConflict = await snapshot();
    await expect(
      updateRecruitingBoard({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: 1,
        expectedVersion: 1,
        prospectIds: [],
      }),
    ).rejects.toMatchObject({ code: 'STATUS_MISMATCH' });
    expect(await snapshot()).toEqual(beforeStatusConflict);
  });

  it('serializes duplicate round advancement and applies allocations once', async () => {
    await seedProgression();
    await addAiTeam();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 8,
    });
    const guard = {
      expectedStage: 'recruiting' as const,
      expectedYear: 2025,
      expectedRound: 1 as const,
      expectedVersion: 1,
      allocations: {},
    };
    const results = await Promise.allSettled([
      advanceRecruitingRound(guard),
      advanceRecruitingRound(guard),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await loadRecruitingState()).toMatchObject({
      round: 2,
      version: 2,
    });
    const advanced = (await loadRecruitingState())!;
    const aiLifetimePoints = advanced.prospects.flatMap(prospect =>
      prospect.interest
        .filter(entry => entry.teamId === 2)
        .map(entry => entry.lifetimePoints),
    );
    expect(Math.max(...aiLifetimePoints)).toBeLessThanOrEqual(26);
    expect(Math.max(...aiLifetimePoints)).toBeGreaterThan(0);
  });

  it('plans non-user teams inside round advancement while preserving user decisions', async () => {
    await seedProgression();
    await addAiTeam();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 81,
    });
    const initialized = (await loadRecruitingState())!;
    const userProspect = initialized.prospects.find(prospect => {
      const interest = prospect.interest.find(entry => entry.teamId === 1);
      return (
        interest &&
        interest.initial + calculateInterestGain(20, interest.fit) <
          RECRUITING.commitmentThreshold
      );
    });
    expect(userProspect).toBeDefined();
    const userProspectId = userProspect!.id;
    await updateRecruitingBoard({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 1,
      expectedVersion: 1,
      prospectIds: [userProspectId],
    });
    const result = await advanceRecruitingRound({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 1,
      expectedVersion: 2,
      allocations: { [userProspectId]: 20 },
    });

    const advanced = (await loadRecruitingState())!;
    const user = advanced.teams.find(team => team.teamId === 1)!;
    const ai = advanced.teams.find(team => team.teamId === 2)!;
    expect(advanced).toMatchObject({ round: 2, version: 3 });
    expect(user.board).toContain(userProspectId);
    expect(user.allocations).toEqual({});
    expect(result.assistance.pointsAdded).toBeGreaterThan(0);
    expect(
      advanced.prospects
        .find(prospect => prospect.id === userProspectId)
        ?.interest.find(entry => entry.teamId === 1)?.lifetimePoints,
    ).toBeGreaterThanOrEqual(20);
    expect(ai.board.length).toBeGreaterThan(0);
    expect(ai.board.length).toBeLessThanOrEqual(25);
    expect(ai.allocations).toEqual({});
    expect(
      advanced.prospects.some(prospect =>
        prospect.interest.some(
          entry => entry.teamId === 2 && entry.lifetimePoints >= 20,
        ),
      ),
    ).toBe(true);
  });

  it('matches uninterrupted execution when state is reloaded between every round', async () => {
    const run = async (reloadBetweenRounds: boolean) => {
      await seedProgression();
      await addAiTeam();
      await initializeRecruiting({
        expectedStage: 'progression',
        expectedYear: 2025,
        seed: 82,
      });
      for (let round = 1; round <= 6; round += 1) {
        const state = (await loadRecruitingState())!;
        if (reloadBetweenRounds) {
          expect(await loadRecruitingState()).toEqual(state);
        }
        await advanceRecruitingRound({
          expectedStage: 'recruiting',
          expectedYear: 2025,
          expectedRound: round as 1 | 2 | 3 | 4 | 5 | 6,
          expectedVersion: state.version,
          allocations: {},
        });
      }
      return loadRecruitingState();
    };

    const uninterrupted = await run(false);
    await resetDatabase();
    const reloaded = await run(true);
    expect(reloaded).toEqual(uninterrupted);
  });

  it('completes every remaining round and Signing Day atomically with AI', async () => {
    await seedProgression();
    await addAiTeam();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 83,
    });
    const initialized = (await loadRecruitingState())!;
    const prospectId = initialized.prospects[0].id;
    await updateRecruitingBoard({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 1,
      expectedVersion: initialized.version,
      prospectIds: [prospectId],
    });
    const boarded = (await loadRecruitingState())!;

    const result = await completeRecruitingWithAi({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 1,
      expectedVersion: boarded.version,
      allocations: { [prospectId]: 10 },
    });

    const db = await getDb();
    const league = (await db.get('league', 'current'))!
      .value as LeagueState;
    const completed = (await loadRecruitingState())!;
    expect(result.route).toBe('/recruiting_summary');
    expect(league.info.stage).toBe('recruiting_summary');
    expect(completed).toMatchObject({
      round: 6,
      status: 'finalized',
      version: boarded.version + 1,
    });
    expect(completed.teams.every(team => !Object.keys(team.allocations).length))
      .toBe(true);
    expect(result.commitments.length).toBeGreaterThan(0);

    const beforeStale = await snapshot();
    await expect(
      completeRecruitingWithAi({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: 1,
        expectedVersion: boarded.version,
        allocations: {},
      }),
    ).rejects.toBeDefined();
    expect(await snapshot()).toEqual(beforeStale);
  }, 30_000);

  it('can hand the final active week and Signing Day to AI', async () => {
    await seedProgression();
    await addAiTeam();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 831,
    });
    for (let round = 1; round < 6; round += 1) {
      const state = (await loadRecruitingState())!;
      await advanceRecruitingRound({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: round as 1 | 2 | 3 | 4 | 5,
        expectedVersion: state.version,
        allocations: {},
      });
    }
    const finalWeek = (await loadRecruitingState())!;
    const result = await completeRecruitingWithAi({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 6,
      expectedVersion: finalWeek.version,
      allocations: {},
    });
    expect(result).toMatchObject({
      stage: 'recruiting_summary',
      round: 6,
      status: 'finalized',
      version: finalWeek.version + 1,
    });
    const origins = await (await getDb()).getAll('playerOrigins');
    expect(origins.length).toBeGreaterThan(0);
    expect(origins.every(origin => origin.kind === 'recruit')).toBe(true);
  }, 30_000);

  it('rolls back AI completion when freshman persistence fails', async () => {
    await seedProgression();
    await addAiTeam();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 84,
    });
    const db = await getDb();
    const leagueRecord = await db.get('league', 'current');
    (leagueRecord!.value as LeagueState).idCounters.player =
      Number.MAX_VALUE;
    await db.put('league', leagueRecord!);
    const state = (await loadRecruitingState())!;
    const before = await snapshot();

    await expect(
      completeRecruitingWithAi({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: 1,
        expectedVersion: state.version,
        allocations: {},
      }),
    ).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
  }, 30_000);

  it('finalizes commitments and creates freshmen exactly once', async () => {
    const db = await getDb();
    const league = buildTestLeague('recruiting', {
      idCounters: {
        game: 1,
        player: 2,
      },
    });
    const prospect = buildRecruitingProspect({
      committedTeamId: 1,
      committedRound: 4,
    });
    const state = buildRecruitingState({
      status: 'ready_for_signing_day',
      version: 7,
      prospects: [prospect],
      teams: [
        {
          ...buildRecruitingState().teams[0],
          commitmentIds: [prospect.id],
        },
      ],
    });
    const tx = db.transaction(['league', 'recruiting', 'players'], 'readwrite');
    await tx.objectStore('league').put({ key: 'current', value: league });
    await tx.objectStore('recruiting').put({ key: 'current', value: state });
    await tx.objectStore('players').put(buildTestPlayer({ id: 10 }));
    await tx.done;

    const guard = {
      expectedStage: 'recruiting' as const,
      expectedYear: 2025,
      expectedRound: 6 as const,
      expectedVersion: 7,
    };
    const results = await Promise.allSettled([
      finalizeRecruiting(guard),
      finalizeRecruiting(guard),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.getAll('players')).toHaveLength(2);
    expect((await db.getAll('players')).find(player => player.year === 'fr')).toMatchObject({
      id: 11,
      teamId: 1,
    });
    expect(await db.get('playerOrigins', 11)).toMatchObject({
      playerId: 11,
      kind: 'recruit',
      acquisitionYear: 2025,
      originalTeamId: 1,
      commitmentRound: 4,
    });
    expect(await loadRecruitingState()).toMatchObject({
      status: 'finalized',
      version: 8,
    });
    expect(
      ((await db.get('league', 'current'))?.value as ReturnType<typeof buildTestLeague>)
        .info.stage,
    ).toBe('recruiting_summary');
    const rejection = results.find(result => result.status === 'rejected');
    expect((rejection as PromiseRejectedResult).reason).toBeInstanceOf(
      RecruitingConflictError,
    );
  });
});
