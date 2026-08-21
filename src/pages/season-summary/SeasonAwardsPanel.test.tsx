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
          userTeamName="Test State"
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Heisman Trophy');
    expect(markup).toContain('Most outstanding overall player');
    expect(markup).not.toContain('Season Stats');
    expect(markup).toContain('Pat Player');
    expect(markup).toContain('Test State');
    expect(markup).toContain('Test State logo');
    expect(markup).toContain('QB');
    expect(markup).toContain('200/300, 3000 pass yds, 30 pass TD, 10 INT');
    expect(markup).toContain('Your Team');
    expect(markup).toContain('href="/players/10"');
  });

  it('keeps awards in canonical input order and renders its empty state', () => {
    const awards = [
      {
        categorySlug: 'heisman',
        categoryName: 'Heisman Trophy',
        categoryDescription: 'Most outstanding overall player',
        group: 'overall' as const,
        placements: [],
      },
      {
        categorySlug: 'maxwell',
        categoryName: 'Maxwell Award',
        categoryDescription: 'College football player of the year',
        group: 'overall' as const,
        placements: [],
      },
    ];
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonAwardsPanel
          awards={awards}
          userTeamName="Test State"
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );
    const emptyMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonAwardsPanel awards={[]} userTeamName="Test State" onTeamClick={vi.fn()} />
      </MemoryRouter>,
    );

    expect(markup.indexOf('Heisman Trophy')).toBeLessThan(markup.indexOf('Maxwell Award'));
    expect(markup).toContain('Winner unavailable');
    expect(markup).toContain('This category has no finalized winner.');
    expect(emptyMarkup).toContain('No finalized awards');
  });
});
