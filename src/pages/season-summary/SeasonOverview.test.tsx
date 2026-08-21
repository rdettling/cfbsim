import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { SeasonOverview } from './SeasonOverview';

const userTeam = {
  ...buildTestTeam({
    name: 'Test State',
    totalWins: 11,
    totalLosses: 3,
    ranking: 3,
    prestige: 5,
  }),
  next_prestige: 6,
  prestige_change: 1,
  avg_rank_before: 18.5,
  avg_rank_after: 14.25,
  prestige_score_before: 82.5,
  prestige_score_after: 87.25,
  prestige_seasons_before: 4,
  prestige_seasons_after: 4,
};

const championship = {
  gameId: 44,
  champion: buildTestTeam({ id: 2, name: 'Champion State', totalWins: 14, totalLosses: 1 }),
  runnerUp: buildTestTeam({ id: 3, name: 'Runner Up', totalWins: 13, totalLosses: 2, ranking: 2 }),
  championScore: 31,
  runnerUpScore: 24,
};

describe('SeasonOverview', () => {
  it('renders the user season, legacy, and championship scoreboard', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonOverview
          userTeam={userTeam}
          championship={championship}
          legacy={{
            accomplishments: [{ type: 'playoff', label: 'Playoff' }],
            milestones: ['First playoff appearance of the dynasty era.'],
            signatureGames: [{
              id: 12,
              year: 2025,
              week: 7,
              opponent: 'Rival State',
              gameLabel: 'Test Bowl',
              result: 'W',
              score: '28-24',
              label: 'W 28-24 vs Rival State',
            }],
          }}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('11-3 · Final #3');
    expect(markup).toContain('Tier 5 → Tier 6 · +1');
    expect(markup).toContain('Season Highlights');
    expect(markup).not.toContain('Current');
    expect(markup).not.toContain('Next');
    expect(markup).not.toContain('Movement');
    expect(markup).toContain('First playoff appearance of the dynasty era.');
    expect(markup).toContain('href="/game/12"');
    expect(markup).toContain('Week 7');
    expect(markup).toContain('Rival State');
    expect(markup).toContain('Rival State logo');
    expect(markup).toContain('Test Bowl');
    expect(markup).toContain('28–24');
    expect(markup).toContain('Champion State');
    expect(markup).toContain('Champion State logo');
    expect(markup).toContain('Runner Up');
    expect(markup).toContain('Runner Up logo');
    expect(markup).toContain('Champion');
    expect(markup).toContain('31');
    expect(markup).toContain('24');
    expect(markup).toContain('href="/game/44"');
  });

  it('renders explicit empty states for missing legacy and championship data', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonOverview
          userTeam={userTeam}
          championship={null}
          legacy={null}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Season complete');
    expect(markup).toContain('No new dynasty milestones this season.');
    expect(markup).toContain('No signature games were identified.');
    expect(markup).toContain('Championship result unavailable');
    expect(markup).not.toContain('View game');
    expect(markup).not.toContain('Final</');
  });

  it('renders unchanged prestige as a compact status', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonOverview
          userTeam={{ ...userTeam, next_prestige: 5, prestige_change: 0 }}
          championship={championship}
          legacy={null}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Tier 5 → Tier 5 · No change');
  });
});
