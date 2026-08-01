import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestPlayer } from '../test/fixtures';
import type { GameRecord } from '../types/db';
import type { SeasonMemory } from '../types/memory';
import {
  assertCurrentSeasonMemory,
  assertSeasonMemoryReferences,
} from './seasonMemoryRepo';

const memory: SeasonMemory = {
  year: 2025,
  playoffTeams: 12,
  teamSnapshots: [
    { teamId: 1, rating: 80, prestige: 4, ranking: 1, record: '12-0 (8-0)' },
  ],
  events: [{ type: 'national_championship', gameId: 1 }],
  awards: [],
};

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
  scoreA: 31,
  scoreB: 24,
  headline: null,
  watchability: 90,
};

describe('season memory integrity', () => {
  it('accepts the exact current shape', () => {
    expect(() => assertCurrentSeasonMemory(memory)).not.toThrow();
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
  });

  it('rejects aliases and dangling game references', () => {
    expect(() =>
      assertCurrentSeasonMemory({ ...memory, legacyYear: 2025 }),
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
            { teamId: 2, rating: 79, prestige: 4, ranking: 2, record: '11-1 (7-1)' },
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
