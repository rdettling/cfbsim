import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerRecord } from '../../types/db';
import type { LeagueState } from '../../types/league';
import { buildTestLeague, buildTestPlayer } from '../../test/fixtures';

const state = vi.hoisted(() => ({
  league: null as unknown,
  players: [] as unknown[],
}));

vi.mock('./leagueStore', () => ({
  loadLeagueOrThrow: vi.fn(async () => state.league),
}));

vi.mock('../../db/offseasonRepo', () => ({
  commitOffseasonTransition: vi.fn(async () => undefined),
}));

vi.mock('../../db/simRepo', () => ({
  getAllPlayers: vi.fn(async () => state.players),
}));

vi.mock('../../db/baseData', () => ({
  getHistoryData: vi.fn(async () => ({
    generated_at: 'test',
    years: [2024],
    conf_index: { 'Test Conference': 1 },
    teams: {},
  })),
  getPrestigeConfig: vi.fn(async () => ({ 4: 100 })),
  getTeamsData: vi.fn(async () => ({
    teams: {
      'Test State': {
        ceiling: 7,
        floor: 1,
      },
    },
  })),
}));

vi.mock('../roster', () => ({
  ensureRosters: vi.fn(async () => undefined),
  applyProgression: vi.fn((players: PlayerRecord[]) => {
    players.forEach(player => {
      if (player.year === 'jr') {
        player.year = 'sr';
        player.rating = player.rating_sr;
      }
    });
  }),
  runRecruitingCycle: vi.fn(async (_league, _teams, players: PlayerRecord[]) => {
    players.push(buildTestPlayer({ id: 2, year: 'fr', first: 'New' }));
  }),
  setStarters: vi.fn(),
  recalculateTeamRatings: vi.fn((teams) => {
    teams[0].rating = 85;
  }),
}));

vi.mock('../rosterCuts', () => ({
  applyRosterCuts: vi.fn((_teams, players: PlayerRecord[]) => {
    players.forEach(player => {
      player.active = false;
      player.starter = false;
    });
  }),
}));

vi.mock('./offseason', () => ({
  applyRealignmentAndPlayoff: vi.fn(async (league: LeagueState) => {
    league.info.currentYear += 1;
    league.playoff = { seeds: [] };
  }),
}));

vi.mock('./historicalData', () => ({
  resolveHistoricalData: vi.fn(async () => ({
    dataSource: {
      targetYear: 2026,
      sourceYear: 2026,
      resolution: 'exact',
      atHistoricalFrontier: false,
    },
    yearData: {
      playoff: { teams: 4 },
      conferences: {},
      Independent: {},
    },
  })),
}));

vi.mock('./history', () => ({
  updateHistoryForSeason: vi.fn((_league, history) => ({
    ...history,
    years: [2025, ...history.years],
  })),
}));

vi.mock('./prestige', () => ({
  calculatePrestigeChanges: vi.fn((league: LeagueState) => {
    league.teams[0].prestige_change = 1;
    return {};
  }),
  applyPrestigeChanges: vi.fn((league: LeagueState) => {
    league.teams[0].prestige += league.teams[0].prestige_change ?? 0;
    league.teams[0].prestige_change = 0;
  }),
}));

vi.mock('./seasonReset', () => ({
  prepareSeasonReset: vi.fn(async () => ({ gamesToSave: [] })),
}));

import { commitOffseasonTransition } from '../../db/offseasonRepo';
import {
  OffseasonStageMismatchError,
} from '../../types/league';
import { advanceOffseasonStage } from './stages';

const commitMock = vi.mocked(commitOffseasonTransition);

describe('advanceOffseasonStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.players = [buildTestPlayer()];
  });

  it('finalizes history and prestige for summary to realignment', async () => {
    state.league = buildTestLeague('summary');

    await expect(advanceOffseasonStage('summary')).resolves.toEqual({
      previousStage: 'summary',
      currentStage: 'realignment',
      route: '/realignment',
    });

    const committed = commitMock.mock.calls[0][0];
    expect(committed.league.info.stage).toBe('realignment');
    expect(committed.league.teams[0].prestige).toBe(5);
    expect(committed.history?.years).toEqual([2025, 2024]);
  });

  it('applies structure and increments the year for realignment to progression', async () => {
    state.league = buildTestLeague('realignment');

    await expect(advanceOffseasonStage('realignment')).resolves.toEqual({
      previousStage: 'realignment',
      currentStage: 'progression',
      route: '/roster_progression',
    });

    const committed = commitMock.mock.calls[0][0];
    expect(committed.league.info.currentYear).toBe(2026);
    expect(committed.league.info.stage).toBe('progression');
  });

  it('applies progression and recruiting before recruiting summary', async () => {
    state.league = buildTestLeague('progression');

    await expect(advanceOffseasonStage('progression')).resolves.toEqual({
      previousStage: 'progression',
      currentStage: 'recruiting_summary',
      route: '/recruiting_summary',
    });

    const committed = commitMock.mock.calls[0][0];
    expect(committed.players).toHaveLength(2);
    expect(committed.players?.[0]).toMatchObject({ year: 'sr', rating: 85 });
    expect(committed.players?.[1]).toMatchObject({ year: 'fr', first: 'New' });
  });

  it('enters roster cuts without mutating players', async () => {
    state.league = buildTestLeague('recruiting_summary');

    await expect(advanceOffseasonStage('recruiting_summary')).resolves.toEqual({
      previousStage: 'recruiting_summary',
      currentStage: 'roster_cuts',
      route: '/roster_cuts',
    });

    const committed = commitMock.mock.calls[0][0];
    expect(committed.league.info.stage).toBe('roster_cuts');
    expect(committed.players).toBeUndefined();
  });

  it('applies cuts and reset work before entering preseason', async () => {
    state.league = buildTestLeague('roster_cuts');

    await expect(advanceOffseasonStage('roster_cuts')).resolves.toEqual({
      previousStage: 'roster_cuts',
      currentStage: 'preseason',
      route: '/noncon',
    });

    const committed = commitMock.mock.calls[0][0];
    expect(committed.league.info.stage).toBe('preseason');
    expect(committed.league.teams[0].rating).toBe(85);
    expect(committed.players?.[0]).toMatchObject({
      active: false,
      starter: false,
    });
    expect(committed.clearNonGameArtifacts).toBe(true);
  });

  it('rejects a stale expected stage without attempting a commit', async () => {
    state.league = buildTestLeague('roster_cuts');

    await expect(advanceOffseasonStage('progression')).rejects.toEqual(
      expect.objectContaining<Partial<OffseasonStageMismatchError>>({
        expectedStage: 'progression',
        actualStage: 'roster_cuts',
      }),
    );
    expect(commitMock).not.toHaveBeenCalled();
  });
});
