import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { getOrderedPrestigeChanges, SeasonPrestigePanel } from './SeasonPrestigePanel';

const team = (name: string, prestigeChange: number) => ({
  ...buildTestTeam({ name }),
  next_prestige: 4 + prestigeChange,
  prestige_change: prestigeChange,
  avg_rank_before: 30,
  avg_rank_after: 20,
  prestige_score_before: 70,
  prestige_score_after: 80,
  prestige_seasons_before: 2,
  prestige_seasons_after: 3,
});

describe('SeasonPrestigePanel', () => {
  it('shows promotions before relegations and excludes unchanged teams', () => {
    const ordered = getOrderedPrestigeChanges([
      team('Relegated State', -1),
      team('Unchanged State', 0),
      team('Promoted State', 1),
    ]);

    expect(ordered.map(entry => entry.name)).toEqual([
      'Promoted State',
      'Relegated State',
    ]);
  });

  it('renders the no-change state when every team retains its tier', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonPrestigePanel
          teams={[team('Unchanged State', 0)]}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('No prestige changes');
  });

  it('renders both performance metrics, short history, and multi-tier movement', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonPrestigePanel
          teams={[team('Rising State', 2)]}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('3-Year Score');
    expect(markup).toContain('70.0');
    expect(markup).toContain('80.0');
    expect(markup).toContain('Avg Finish');
    expect(markup).toContain('30.0');
    expect(markup).toContain('20.0');
    expect(markup).toContain('2 → 3 seasons');
    expect(markup).toContain('4 → 6');
    expect(markup).toContain('+2 Promotion');
  });
});
