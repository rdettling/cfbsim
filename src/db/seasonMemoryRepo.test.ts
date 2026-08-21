import { describe, expect, it } from 'vitest';
import {
  buildTestAwardStats,
  buildTestLeague,
  buildTestPlayer,
  buildTestSeasonMemory,
  buildTestSeasonTeamSnapshot,
} from '../test/fixtures';
import type { GameRecord } from '../types/db';
import type { SeasonMemory } from '../types/memory';
import {
  assertCurrentSeasonMemory,
  assertSeasonMemoryReferences,
} from './seasonMemoryRepo';

const memory: SeasonMemory = buildTestSeasonMemory({
  teamSnapshots: [
    buildTestSeasonTeamSnapshot(),
  ],
});

const game: GameRecord = {
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
  gameType: 'national_championship',
  rivalryKey: null,
  watchability: 90,
};

describe('season memory integrity', () => {
  it('accepts the exact current shape', () => {
    expect(() => assertCurrentSeasonMemory(memory)).not.toThrow();
  });

  it('requires exact numeric award-window totals', () => {
    const awardMemory = buildTestSeasonMemory({
      awards: [{
        categorySlug: 'heisman',
        playerId: 1,
        teamId: 1,
        stats: buildTestAwardStats({ pass_yards: 3_500 }),
      }],
    });
    expect(() => assertCurrentSeasonMemory(awardMemory)).not.toThrow();
    const malformed = structuredClone(awardMemory);
    delete (malformed.awards[0].stats as Partial<typeof malformed.awards[0]['stats']>)
      .pass_yards;
    expect(() => assertCurrentSeasonMemory(malformed)).toThrow();
  });

  it('rejects malformed snapshot rankings and records', () => {
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{ ...memory.teamSnapshots[0], ranking: 1.5 }],
    })).toThrow();
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{ ...memory.teamSnapshots[0], ranking: 0 }],
    })).toThrow();
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{ ...memory.teamSnapshots[0], record: '   ' }],
    })).toThrow();
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{
        ...memory.teamSnapshots[0],
        offense: { ...memory.teamSnapshots[0].offense, points: 1.5 },
      }],
    })).toThrow();
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{ ...memory.teamSnapshots[0], conference: '' }],
    })).toThrow();
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{ ...memory.teamSnapshots[0], prestige: 0 }],
    })).toThrow();
    expect(() => assertCurrentSeasonMemory({
      ...memory,
      teamSnapshots: [{ ...memory.teamSnapshots[0], prestige: 8 }],
    })).toThrow();
  });

  it('rejects aliases and dangling game references', () => {
    expect(() =>
      assertCurrentSeasonMemory({ ...memory, legacyYear: 2025 }),
    ).toThrow();
    expect(() =>
      assertCurrentSeasonMemory({ ...memory, playoffTeams: 2, events: [] }),
    ).toThrow();
    expect(() =>
      assertSeasonMemoryReferences(
        [memory],
        buildTestLeague('realignment'),
        [],
        [buildTestPlayer()],
        [],
        [],
      ),
    ).toThrow();
  });

  it('rejects a memory missing a participating team snapshot', () => {
    const league = buildTestLeague('realignment', {
      teams: [
        buildTestLeague('realignment').teams[0],
        { ...buildTestLeague('realignment').teams[0], id: 2, name: 'Other State' },
      ],
    });
    expect(() =>
      assertSeasonMemoryReferences(
        [memory],
        league,
        [game],
        [buildTestPlayer()],
        [],
        [],
      ),
    ).toThrow();
  });

  it('accepts references to retained completed games', () => {
    const league = buildTestLeague('realignment', {
      teams: [
        buildTestLeague('realignment').teams[0],
        { ...buildTestLeague('realignment').teams[0], id: 2, name: 'Other State' },
      ],
    });
    expect(() =>
      assertSeasonMemoryReferences(
        [{
          ...memory,
          teamSnapshots: [
            ...memory.teamSnapshots,
            buildTestSeasonTeamSnapshot({
              teamId: 2,
              rating: 79,
              ranking: 2,
              record: '11-1 (7-1)',
            }),
          ],
        }],
        league,
        [game],
        [buildTestPlayer()],
        [],
        [],
      ),
    ).not.toThrow();
  });
});
