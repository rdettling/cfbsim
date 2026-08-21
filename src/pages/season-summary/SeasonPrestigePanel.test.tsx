import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { getOrderedPrestigeChanges, SeasonPrestigePanel } from './SeasonPrestigePanel';

const team = (name: string, prestigeChange: number) => ({
  ...buildTestTeam({ name, prestige_change: prestigeChange }),
  avg_rank_before: 30,
  avg_rank_after: 20,
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
});
