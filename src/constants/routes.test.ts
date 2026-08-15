import { describe, expect, it } from 'vitest';
import { getTeamStatsPath, ROUTES } from './routes';

describe('statistics routes', () => {
  it('supports optional historical seasons without changing current-season paths', () => {
    expect(ROUTES.TEAM_STATS).toBe('/:teamName/stats/:year?');
    expect(ROUTES.TEAM_RANKINGS).toBe('/stats/teams/:year?');
    expect(ROUTES.PLAYER_LEADERS).toBe('/stats/players/:year?');
    expect(getTeamStatsPath('Georgia')).toBe('/Georgia/stats');
    expect(getTeamStatsPath('Georgia', 2024)).toBe('/Georgia/stats/2024');
  });

  it('defines both current and historical league news routes', () => {
    expect(ROUTES.NEWS).toBe('/news');
    expect(ROUTES.NEWS_YEAR).toBe('/news/:year');
  });
});
