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

  it('accepts references to retained completed games', () => {
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
    ).not.toThrow();
  });
});
