import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGamesByYear } from '../../../db/simRepo';
import { buildTestLeague, buildTestTeam } from '../../../test/fixtures';
import type { GameRecord } from '../../../types/db';
import { GAME_TYPES } from '../../../types/news';
import { loadLeagueOrThrow } from '../leagueStore';
import {
  BIGGEST_UPSET_MAX_WIN_PROBABILITY,
  loadBiggestUpsets,
} from './biggestUpsets';

vi.mock('../../../db/simRepo');
vi.mock('../leagueStore');

const teamA = buildTestTeam({ id: 1, name: 'Alpha State', abbreviation: 'ALP' });
const teamB = buildTestTeam({ id: 2, name: 'Beta Tech', abbreviation: 'BET' });

const game = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 1,
  teamAId: teamA.id,
  teamBId: teamB.id,
  homeTeamId: teamA.id,
  awayTeamId: teamB.id,
  neutralSite: false,
  venue: teamA.stadium,
  winnerId: teamA.id,
  baseLabel: 'Non-Conference',
  name: null,
  gameType: 'regular_season',
  rivalryKey: null,
  spreadA: '+21',
  spreadB: '-21',
  moneylineA: '+900',
  moneylineB: '-1200',
  winProbA: BIGGEST_UPSET_MAX_WIN_PROBABILITY,
  winProbB: 1 - BIGGEST_UPSET_MAX_WIN_PROBABILITY,
  weekPlayed: 4,
  year: 2025,
  rankATOG: 0,
  rankBTOG: 3,
  resultA: 'W',
  resultB: 'L',
  overtime: 0,
  quarter: 4,
  clockSecondsLeft: 0,
  scoreA: 27,
  scoreB: 24,
  watchability: 90,
  ...overrides,
});

describe('loadBiggestUpsets', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeagueOrThrow).mockResolvedValue(buildTestLeague('season', {
      teams: [teamA, teamB],
      info: { ...buildTestLeague('season').info, currentYear: 2025 },
    }));
  });

  it('projects qualifying winners on either side using game-time values', async () => {
    vi.mocked(getGamesByYear).mockResolvedValue([
      game(),
      game({
        id: 2,
        winnerId: teamB.id,
        winProbA: 0.925,
        winProbB: 0.075,
        weekPlayed: 9,
        rankATOG: 5,
        rankBTOG: 0,
        resultA: 'L',
        resultB: 'W',
        scoreA: 17,
        scoreB: 31,
        overtime: 2,
      }),
    ]);

    const result = await loadBiggestUpsets();

    expect(getGamesByYear).toHaveBeenCalledWith(2025);
    expect(result.upsets).toEqual([
      {
        gameId: 1,
        year: 2025,
        week: 4,
        label: 'Non-Conference',
        overtime: 0,
        winnerWinProbability: 0.1,
        winner: { id: 1, name: 'Alpha State', abbreviation: 'ALP', rank: 0, score: 27 },
        loser: { id: 2, name: 'Beta Tech', abbreviation: 'BET', rank: 3, score: 24 },
      },
      {
        gameId: 2,
        year: 2025,
        week: 9,
        label: 'Non-Conference',
        overtime: 2,
        winnerWinProbability: 0.075,
        winner: { id: 2, name: 'Beta Tech', abbreviation: 'BET', rank: 0, score: 31 },
        loser: { id: 1, name: 'Alpha State', abbreviation: 'ALP', rank: 5, score: 17 },
      },
    ]);
  });

  it('excludes incomplete games and winners above the inclusive threshold', async () => {
    vi.mocked(getGamesByYear).mockResolvedValue([
      game({ id: 3, winProbA: 0.101, winProbB: 0.899 }),
      game({
        id: 4,
        winnerId: null,
        resultA: null,
        resultB: null,
        scoreA: null,
        scoreB: null,
        quarter: 1,
        clockSecondsLeft: 900,
      }),
      game({ id: 5, winProbA: 0.9, winProbB: 0.1 }),
    ]);

    const result = await loadBiggestUpsets();

    expect(result.upsets).toEqual([]);
  });

  it('includes qualifying results from every persisted game type', async () => {
    vi.mocked(getGamesByYear).mockResolvedValue(GAME_TYPES.map((gameType, index) => game({
      id: index + 1,
      gameType,
      baseLabel: gameType,
      weekPlayed: index + 1,
    })));

    const result = await loadBiggestUpsets();

    expect(result.upsets.map(upset => upset.label)).toEqual([...GAME_TYPES]);
  });
});
