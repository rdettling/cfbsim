import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../../types/db';
import type { SeasonMemory } from '../../types/memory';
import { buildTestSeasonTeamSnapshot, buildTestTeam } from '../../test/fixtures';
import {
  buildSeasonMilestones,
  buildTeamAccomplishments,
  selectSignatureGames,
} from './memoryProjection';

const teams = [
  buildTestTeam(),
  buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH' }),
];

const game = (
  id: number,
  year: number,
  winnerId: number,
  options: Partial<GameRecord> = {},
): GameRecord => ({
  id,
  teamAId: 1,
  teamBId: 2,
  homeTeamId: 1,
  awayTeamId: 2,
  neutralSite: false,
  venue: null,
  winnerId,
  baseLabel: 'Test State vs Other State',
  name: null,
  spreadA: '-3',
  spreadB: '+3',
  moneylineA: '-150',
  moneylineB: '+130',
  winProbA: 0.6,
  winProbB: 0.4,
  weekPlayed: id,
  year,
  rankATOG: 1,
  rankBTOG: 2,
  resultA: winnerId === 1 ? 'W' : 'L',
  resultB: winnerId === 2 ? 'W' : 'L',
  overtime: 0,
  scoreA: winnerId === 1 ? 31 : 24,
  scoreB: winnerId === 2 ? 31 : 24,
  gameType: 'regular_season',
  rivalryKey: null,
  watchability: 75,
  ...options,
});

const memory: SeasonMemory = {
  year: 2025,
  playoffTeams: 12,
  teamSnapshots: [
    buildTestSeasonTeamSnapshot(),
    buildTestSeasonTeamSnapshot({ teamId: 2, ranking: 2, record: '11-1 (7-1)' }),
  ],
  events: [
    { type: 'conference_championship', gameId: 2, conferenceName: 'Test Conference' },
    { type: 'national_championship', gameId: 3 },
  ],
  awards: [],
};

describe('dynasty memory projections', () => {
  it('builds proven accomplishments and selects achievement and heartbreak games', () => {
    const games = [
      game(1, 2025, 1, { winProbA: 0.2 }),
      game(2, 2025, 1),
      game(3, 2025, 2, { overtime: 2, scoreA: 27, scoreB: 30 }),
    ];
    const gamesById = new Map(games.map(entry => [entry.id, entry]));
    expect(buildTeamAccomplishments(1, memory, gamesById).map(entry => entry.type))
      .toEqual(['national_runner_up', 'playoff', 'conference_champion']);
    expect(selectSignatureGames({
      teamId: 1,
      memory,
      games,
      teams,
      rivalries: {
        rivalries: [{
          teamA: 'Test State',
          teamB: 'Other State',
          week: 12,
          name: 'Test Trophy',
          neutralSite: false,
          venue: null,
        }],
      },
    }).map(entry => entry.id)).toEqual([3, 1, 2]);
  });

  it('limits legacy milestones and recognizes new dynasty bests', () => {
    const milestones = buildSeasonMilestones({
      teamId: 1,
      current: memory,
      previous: [],
      games: [game(2, 2025, 1), game(3, 2025, 1)],
      currentWins: 13,
      currentRank: 1,
      previousRows: [[2024, 1, 5, 10, 3, 4]],
    });
    expect(milestones).toEqual([
      'First national championship of the dynasty era.',
      'First conference championship of the dynasty era.',
      'First playoff appearance of the dynasty era.',
    ]);
  });
});
