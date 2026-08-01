import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../db/db';
import { loadRecruitingState } from '../../db/recruitingRepo';
import {
  buildTestLeague,
  buildTestPlayer,
  buildTestTeam,
} from '../../test/fixtures';
import type { PlayerRecord } from '../../types/db';
import type { LeagueState } from '../../types/league';
import { buildAiRecruitingSnapshot } from '../recruiting/aiSnapshot';
import { planAiRecruitingDecisions } from '../recruiting/aiStrategy';
import { buildRecruitingContext } from '../recruiting/context';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from '../rosterConfig';
import { loadRecruitingSummary } from './loaders/loadRecruitingSummary';
import { loadRosterCuts } from './loaders/loadRosterCuts';
import {
  advanceRecruitingRound,
  finalizeRecruiting,
  initializeRecruiting,
  updateRecruitingBoard,
} from './recruiting';
import {
  finalizeRoster,
  initializeRosterFinalization,
  selectRosterCut,
  undoRosterCut,
} from './rosterFinalization';

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

const buildRoster = (teamId: number, startId: number) => {
  let id = startId;
  let slot = 0;
  return POSITION_ORDER.flatMap(position =>
    Array.from({ length: ROSTER[position].total }, (_, index) => {
      const year = ['fr', 'so', 'jr', 'sr'][slot++ % 4] as
        PlayerRecord['year'];
      return buildTestPlayer({
        id: id++,
        teamId,
        pos: position,
        year,
        rating: 60 + index,
        rating_fr: 55 + index,
        rating_so: 60 + index,
        rating_jr: 65 + index,
        rating_sr: 70 + index,
        starter: index < ROSTER[position].starters,
      });
    }),
  );
};

const seedProgression = async () => {
  const db = await getDb();
  const user = buildTestTeam({ id: 1 });
  const ai = buildTestTeam({
    id: 2,
    name: 'Other State',
    abbreviation: 'OTH',
    state: 'OS',
    ranking: 2,
  });
  const league = buildTestLeague('progression', {
    teams: [user, ai],
    idCounters: {
      game: 10,
      player: 500,
    },
  });
  league.conferences[0].teams = [user, ai];
  const baseData = [
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
    { key: 'states', value: { TS: 1, OS: 1 } },
    { key: 'rivalries', value: { rivalries: [] } },
    { key: 'teams', value: { teams: {} } },
    { key: 'betting_odds', value: { odds: {}, max_diff: 100 } },
  ];
  const tx = db.transaction(
    ['baseData', 'league', 'players', 'playerOrigins'],
    'readwrite',
  );
  await tx.objectStore('league').put({ key: 'current', value: league });
  for (const record of baseData) {
    await tx.objectStore('baseData').put(record);
  }
  const players = [
    ...buildRoster(user.id, 1),
    ...buildRoster(ai.id, 101),
  ];
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
};

const snapshot = async () => {
  const db = await getDb();
  return Object.fromEntries(
    await Promise.all(
      STORES.map(async store => [store, await db.getAll(store)]),
    ),
  );
};

describe('complete persisted recruiting lifecycle', () => {
  beforeEach(resetDatabase);

  it('survives reloads and stale requests and rolls finalization back atomically', async () => {
    await seedProgression();
    await initializeRecruiting({
      expectedStage: 'progression',
      expectedYear: 2025,
      seed: 20260727,
    });
    expect(await loadRecruitingState()).toMatchObject({
      seed: 20260727,
      version: 1,
      round: 1,
    });
    const progressedDb = await getDb();
    expect(await progressedDb.count('playerOrigins')).toBe(
      await progressedDb.count('players'),
    );

    let staleRoundGuard:
      | Parameters<typeof advanceRecruitingRound>[0]
      | undefined;
    for (let round = 1; round <= 6; round += 1) {
      const db = await getDb();
      const state = (await loadRecruitingState())!;
      const league = (await db.get('league', 'current'))!.value as LeagueState;
      const players = await db.getAll('players');
      const decision = planAiRecruitingDecisions(
        buildAiRecruitingSnapshot(
          state,
          buildRecruitingContext(league.teams, players),
        ),
        [1],
      )[0];
      await updateRecruitingBoard({
        expectedStage: 'recruiting',
        expectedYear: 2025,
        expectedRound: round as 1 | 2 | 3 | 4 | 5 | 6,
        expectedVersion: state.version,
        prospectIds: decision.board,
      });
      const boarded = (await loadRecruitingState())!;
      const guard = {
        expectedStage: 'recruiting' as const,
        expectedYear: 2025,
        expectedRound: round as 1 | 2 | 3 | 4 | 5 | 6,
        expectedVersion: boarded.version,
        allocations: decision.allocations,
      };
      staleRoundGuard ??= guard;
      await advanceRecruitingRound(guard);
      expect(await loadRecruitingState()).not.toBeNull();
    }

    const beforeStaleRound = await snapshot();
    await expect(
      advanceRecruitingRound(staleRoundGuard!),
    ).rejects.toBeDefined();
    expect(await snapshot()).toEqual(beforeStaleRound);

    const ready = (await loadRecruitingState())!;
    await finalizeRecruiting({
      expectedStage: 'recruiting',
      expectedYear: 2025,
      expectedRound: 6,
      expectedVersion: ready.version,
    });
    const summaryBefore = await snapshot();
    const firstSummary = await loadRecruitingSummary();
    const secondSummary = await loadRecruitingSummary();
    expect(secondSummary).toEqual(firstSummary);
    expect(await snapshot()).toEqual(summaryBefore);

    await initializeRosterFinalization({
      expectedStage: 'recruiting_summary',
      expectedYear: 2025,
    });
    let cuts = await loadRosterCuts();
    if (cuts.recommendedCutIds.length) {
      const firstId = cuts.recommendedCutIds[0];
      await selectRosterCut(
        {
          expectedStage: 'roster_cuts',
          expectedYear: 2025,
          expectedRound: 6,
          expectedStatus: 'finalized',
          expectedVersion: cuts.cursor!.version,
        },
        firstId,
      );
      const selected = await loadRosterCuts();
      const beforeStaleCut = await snapshot();
      await expect(
        selectRosterCut(
          {
            expectedStage: 'roster_cuts',
            expectedYear: 2025,
            expectedRound: 6,
            expectedStatus: 'finalized',
            expectedVersion: cuts.cursor!.version,
          },
          firstId,
        ),
      ).rejects.toBeDefined();
      expect(await snapshot()).toEqual(beforeStaleCut);
      await undoRosterCut(
        {
          expectedStage: 'roster_cuts',
          expectedYear: 2025,
          expectedRound: 6,
          expectedStatus: 'finalized',
          expectedVersion: selected.cursor!.version,
        },
        firstId,
      );
    }

    cuts = await loadRosterCuts();
    for (const playerId of cuts.recommendedCutIds) {
      const current = await loadRosterCuts();
      await selectRosterCut(
        {
          expectedStage: 'roster_cuts',
          expectedYear: 2025,
          expectedRound: 6,
          expectedStatus: 'finalized',
          expectedVersion: current.cursor!.version,
        },
        playerId,
      );
    }
    const readyCuts = await loadRosterCuts();
    const finalGuard = {
      expectedStage: 'roster_cuts' as const,
      expectedYear: 2025,
      expectedRound: 6 as const,
      expectedStatus: 'finalized' as const,
      expectedVersion: readyCuts.cursor!.version,
    };

    const db = await getDb();
    await db.delete('baseData', 'betting_odds');
    const beforeFailure = await snapshot();
    await expect(finalizeRoster(finalGuard)).rejects.toThrow(
      /Season reset data/,
    );
    expect(await snapshot()).toEqual(beforeFailure);
    await db.put('baseData', {
      key: 'betting_odds',
      value: { odds: {}, max_diff: 100 },
    });

    await finalizeRoster(finalGuard);
    const finalized = await snapshot();
    const finalLeague = (await db.get('league', 'current'))!
      .value as LeagueState;
    const finalPlayers = await db.getAll('players');
    expect(finalLeague.info.stage).toBe('preseason');
    expect(await loadRecruitingState()).toBeNull();
    expect(new Set(finalPlayers.map(player => player.id)).size).toBe(
      finalPlayers.length,
    );
    finalLeague.teams.forEach(team => {
      const active = finalPlayers.filter(
        player => player.teamId === team.id,
      );
      expect(active).toHaveLength(FINAL_ROSTER_SIZE);
      POSITION_ORDER.forEach(position => {
        expect(
          active.filter(
            player => player.pos === position && player.starter,
          ),
        ).toHaveLength(ROSTER[position].starters);
      });
    });
    await expect(finalizeRoster(finalGuard)).rejects.toBeDefined();
    expect(await snapshot()).toEqual(finalized);
  }, 30_000);
});
