import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeagueState } from '../../types/league';
import { buildTestLeague } from '../../test/fixtures';

const state = vi.hoisted(() => ({
  league: null as unknown,
}));

vi.mock('./leagueStore', () => ({
  loadLeagueOrThrow: vi.fn(async () => state.league),
}));

vi.mock('../../db/offseasonRepo', () => ({
  commitOffseasonTransition: vi.fn(async () => undefined),
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

vi.mock('./recruiting', () => ({
  initializeRecruiting: vi.fn(async () => ({
    stage: 'recruiting',
    route: '/recruiting',
  })),
}));

vi.mock('./rosterFinalization', () => ({
  initializeRosterFinalization: vi.fn(async () => ({
    previousStage: 'recruiting_summary',
    currentStage: 'roster_cuts',
    route: '/roster_cuts',
  })),
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

  it('delegates progression to atomic recruiting initialization', async () => {
    state.league = buildTestLeague('progression');

    await expect(advanceOffseasonStage('progression')).resolves.toEqual({
      previousStage: 'progression',
      currentStage: 'recruiting',
      route: '/recruiting',
    });

    expect(commitMock).not.toHaveBeenCalled();
  });

  it('enters roster cuts without mutating players', async () => {
    state.league = buildTestLeague('recruiting_summary');

    await expect(advanceOffseasonStage('recruiting_summary')).resolves.toEqual({
      previousStage: 'recruiting_summary',
      currentStage: 'roster_cuts',
      route: '/roster_cuts',
    });

    expect(commitMock).not.toHaveBeenCalled();
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
