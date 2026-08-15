import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SeasonAwardsPanel } from './SeasonAwardsPanel';

describe('SeasonAwardsPanel', () => {
  it('renders the compact winner panel from normalized placements', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonAwardsPanel
          awards={[{
            categorySlug: 'heisman',
            categoryName: 'Heisman Trophy',
            categoryDescription: 'Most outstanding overall player',
            group: 'overall',
            placements: [{
              key: 'first',
              player: {
                id: 10,
                first: 'Pat',
                last: 'Player',
                position: 'qb',
                teamName: 'Test State',
              },
              score: 300,
              statLine: '200/300, 3000 pass yds, 30 pass TD, 10 INT',
            }],
          }]}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Heisman Trophy');
    expect(markup).toContain('Pat Player');
    expect(markup).toContain('Test State');
    expect(markup).toContain('200/300, 3000 pass yds, 30 pass TD, 10 INT');
    expect(markup).toContain('href="/players/10"');
  });
});
