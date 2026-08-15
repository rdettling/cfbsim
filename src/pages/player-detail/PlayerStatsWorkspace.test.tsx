import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerCareerSeason } from '../../types/player';
import { PlayerStatsWorkspace } from './PlayerStatsWorkspace';

const season: PlayerCareerSeason = {
  classYear: 'jr',
  rating: 91,
  games: 12,
  stats: {
    pass_completions: 275,
    pass_attempts: 438,
    completion_percentage: 62.8,
    pass_yards: 3263,
    pass_touchdowns: 28,
    pass_interceptions: 8,
    passer_rating: 99.1,
    adjusted_pass_yards_per_attempt: 7.9,
  },
};

describe('PlayerStatsWorkspace', () => {
  it('associates the career tab with its populated panel', () => {
    const markup = renderToStaticMarkup(
      <PlayerStatsWorkspace
        activeTab="career"
        onTabChange={() => undefined}
        years={[2026]}
        selectedYear={2026}
        onYearChange={() => undefined}
        seasons={[{ year: 2026, season }]}
        gameLogs={[]}
        category="passing"
        gameLogScope="complete"
        onTeamClick={() => undefined}
      />,
    );

    expect(markup).toContain('id="player-career-tab"');
    expect(markup).toContain('aria-controls="player-career-panel"');
    expect(markup).toContain('id="player-career-panel"');
    expect(markup).toContain('aria-labelledby="player-career-tab"');
    expect(markup).toContain('aria-label="Career statistics"');
    expect(markup).not.toContain('player-log-year-label');
  });

  it('keeps the year control and retained-history notice with an empty logs panel', () => {
    const markup = renderToStaticMarkup(
      <PlayerStatsWorkspace
        activeTab="logs"
        onTabChange={() => undefined}
        years={[2026, 2025]}
        selectedYear={2026}
        onYearChange={() => undefined}
        seasons={[]}
        gameLogs={[]}
        category="passing"
        gameLogScope="retained_postseason_only"
        onTeamClick={() => undefined}
      />,
    );

    expect(markup).toContain('id="player-logs-tab"');
    expect(markup).toContain('id="player-logs-panel"');
    expect(markup).toContain('player-log-year-label');
    expect(markup).toContain('Game-by-game history is limited');
    expect(markup).toContain('No games played this season');
    expect(markup).toContain('ordinary historical game detail is not retained');
  });
});
