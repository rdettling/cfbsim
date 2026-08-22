import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import { RecentFormPanel } from './RecentFormPanel';

describe('RecentFormPanel', () => {
  it('presents each team and its games in side-by-side columns', () => {
    const texas = buildTestTeam({ id: 1, name: 'Texas' });
    const alabama = buildTestTeam({ id: 2, name: 'Alabama' });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <RecentFormPanel
          awayTeam={texas}
          homeTeam={alabama}
          awayGames={[{
            id: 10,
            week: 3,
            opponent: 'Ohio State',
            result: 'W',
            score: '28-23',
            location: 'vs',
          }]}
          homeGames={[{
            id: 11,
            week: 3,
            opponent: 'Missouri',
            result: 'W',
            score: '34-16',
            location: 'vs',
          }]}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('aria-label="Texas recent form"');
    expect(markup).toContain('aria-label="Alabama recent form"');
    expect(markup).toContain('aria-orientation="vertical"');
    expect(markup).toContain('href="/game/10"');
    expect(markup).toContain('href="/game/11"');
  });
});
