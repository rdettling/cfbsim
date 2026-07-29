import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../../db/db';
import {
  buildTestLeague,
  buildTestPlayer,
} from '../../../test/fixtures';
import {
  buildRecruitingProspect,
  buildRecruitingState,
} from '../../../test/recruitingFixtures';
import { loadRecruiting } from './loadRecruiting';

const stores = [
  'baseData',
  'league',
  'recruiting',
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

const seedRecruiting = async () => {
  const db = await getDb();
  const prospect = buildRecruitingProspect({
    interest: [
      {
        teamId: 1,
        fit: 80,
        initial: 32,
        earned: 25,
        lifetimePoints: 20,
      },
    ],
  });
  const state = buildRecruitingState({
    round: 2,
    status: 'active',
    version: 4,
    prospects: [prospect],
    teams: [
      {
        teamId: 1,
        board: [prospect.id],
        allocations: { [prospect.id]: 15 },
        commitmentIds: [],
        baseSigningCapacity: 1,
        oversignCapacity: 5,
        pointBudget: 105,
      },
    ],
  });
  const tx = db.transaction(['league', 'recruiting', 'players'], 'readwrite');
  await tx.objectStore('league').put({
    key: 'current',
    value: buildTestLeague('recruiting'),
  });
  await tx.objectStore('recruiting').put({ key: 'current', value: state });
  await tx.objectStore('players').put(buildTestPlayer());
  await tx.done;
};

const snapshot = async () => {
  const db = await getDb();
  return {
    league: await db.get('league', 'current'),
    recruiting: await db.get('recruiting', 'current'),
    players: await db.getAll('players'),
  };
};

describe('loadRecruiting', () => {
  beforeEach(resetDatabase);

  it('returns a public-only command projection without writing', async () => {
    await seedRecruiting();
    const before = await snapshot();

    const result = await loadRecruiting();

    expect(result.cursor).toEqual({
      stage: 'recruiting',
      year: 2025,
      round: 2,
      status: 'active',
      version: 4,
    });
    expect(result.userRecruiting).toMatchObject({
      pointBudget: 105,
      perProspectCap: 26,
      boardIds: [1],
      remainingBaseSlots: 1,
    });
    expect(result.userRecruiting).not.toHaveProperty('allocations');
    expect(result.userRecruiting).not.toHaveProperty('savedPoints');
    expect(result.userRecruiting).not.toHaveProperty('remainingPoints');
    expect(result.rules).toEqual({
      meaningfulPursuitPoints: 20,
      commitmentThreshold: 55,
      commitmentLead: 10,
    });
    expect(result.prospects[0]).toMatchObject({
      id: 1,
      nationalRank: 1,
      onUserBoard: true,
      leaderTeamId: 1,
      leaderInterest: 57,
      commitmentThresholdRemaining: 0,
      commitmentLeadRemaining: 0,
      standings: [
        {
          teamId: 1,
          totalInterest: 57,
          lifetimePoints: 20,
          offerActive: true,
          meaningful: true,
          eligible: true,
          leader: true,
        },
      ],
    });
    expect(result.prospects[0]).not.toHaveProperty('userAllocation');
    expect(result.prospects[0]).not.toHaveProperty('ratingFr');
    expect(result.prospects[0]).not.toHaveProperty('ratingSo');
    expect(result.prospects[0]).not.toHaveProperty('publicRatingMin');
    expect(result.prospects[0]).not.toHaveProperty('publicRatingMax');
    expect(result.prospects[0]).not.toHaveProperty('developmentTrait');
    expect(result.cursor).not.toHaveProperty('seed');
    expect(await snapshot()).toEqual(before);
  });

  it('is stable across repeated reads', async () => {
    await seedRecruiting();

    expect(await loadRecruiting()).toEqual(await loadRecruiting());
  });

  it('returns the exact gated projection off-stage', async () => {
    const db = await getDb();
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('season'),
    });
    await db.put('players', buildTestPlayer());

    const result = await loadRecruiting();

    expect(result).toMatchObject({
      cursor: null,
      userRecruiting: null,
      prospects: [],
      positions: [],
      rules: null,
    });
  });

  it('fails when active-stage recruiting state is missing or malformed', async () => {
    const db = await getDb();
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('recruiting'),
    });
    await db.put('players', buildTestPlayer());

    await expect(loadRecruiting()).rejects.toMatchObject({
      code: 'STATE_MISSING',
    });

    const malformed = buildRecruitingState({
      status: 'active',
    }) as unknown as Record<string, unknown>;
    malformed.legacy = true;
    await db.put('recruiting', {
      key: 'current',
      value: malformed as never,
    });
    await expect(loadRecruiting()).rejects.toMatchObject({
      code: 'INVALID_RECRUITING_STATE',
    });
  });
});
