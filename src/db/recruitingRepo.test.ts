import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildRecruitingState } from '../test/recruitingFixtures';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';
import type { RecruitingState } from '../types/recruiting';
import { getDb } from './db';
import {
  assertCurrentRecruitingState,
  loadRecruitingLifecycleSnapshot,
  loadRecruitingState,
  toRecruitingRecord,
} from './recruitingRepo';

const resetDatabase = async () => {
  const db = await getDb();
  const tx = db.transaction(
    ['league', 'recruiting', 'players'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('league').clear(),
    tx.objectStore('recruiting').clear(),
    tx.objectStore('players').clear(),
  ]);
  await tx.done;
};

describe('current recruiting schema', () => {
  beforeEach(resetDatabase);

  it('accepts and returns the exact current aggregate', async () => {
    const state = buildRecruitingState();
    expect(() => assertCurrentRecruitingState(state)).not.toThrow();
    const db = await getDb();
    await db.put('recruiting', toRecruitingRecord(state));
    expect(await loadRecruitingState()).toEqual(state);
  });

  const invalidCases: Array<
    [string, (state: RecruitingState) => unknown]
  > = [
    [
      'missing version',
      ({ version: _version, ...state }: RecruitingState) => state,
    ],
    [
      'extra alias',
      (state: RecruitingState) => ({
        ...state,
        currentRound: state.round,
      }),
    ],
    [
      'malformed seed',
      (state: RecruitingState) => ({ ...state, seed: undefined }),
    ],
    [
      'duplicate pending cut',
      (state: RecruitingState) => ({
        ...state,
        pendingUserCutIds: [10, 10],
      }),
    ],
  ];

  it.each(invalidCases)('rejects %s without normalization', (_label, mutate) => {
    const malformed = mutate(buildRecruitingState());
    expect(() => assertCurrentRecruitingState(malformed)).toThrowError(
      expect.objectContaining({ code: 'INVALID_RECRUITING_STATE' }),
    );
  });

  it('rejects malformed lifecycle records without mutating them', async () => {
    const db = await getDb();
    const malformed = {
      ...buildRecruitingState(),
      version: undefined,
    } as unknown as RecruitingState;
    await db.put('league', {
      key: 'current',
      value: buildTestLeague('roster_cuts'),
    });
    await db.put('players', buildTestPlayer());
    await db.put('recruiting', { key: 'current', value: malformed });

    await expect(loadRecruitingLifecycleSnapshot()).rejects.toMatchObject({
      code: 'INVALID_RECRUITING_STATE',
    });
    expect((await db.get('recruiting', 'current'))?.value).toEqual(malformed);
  });
});
