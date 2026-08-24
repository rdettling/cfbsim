import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../constants/routes';
import { buildTestLeague } from '../test/fixtures';
import type { GameNewsItem } from '../types/news';
import type { NewsPageData } from '../types/pages';
import News from './News';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const story = (gameId: number, week: number, headline: string): GameNewsItem => ({
  id: `game:${gameId}`,
  type: 'game',
  year: 2026,
  week,
  gameId,
  teamIds: [1, 2],
  featuredPlayerId: null,
  headline,
  deck: `${headline} deck.`,
  primaryAngle: 'routine_result',
  storylines: ['routine_result'],
  importance: 50 - gameId,
});

const buildData = (): NewsPageData => {
  const league = buildTestLeague('season');
  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team: league.teams[0],
    conferences: league.conferences,
    year: 2026,
    availableYears: [2026, 2025],
    weeks: [
      {
        week: 3,
        stories: [
          story(1, 3, 'Week three lead'),
          story(2, 3, 'Week three support one'),
          story(3, 3, 'Week three support two'),
        ],
      },
      { week: 2, stories: [story(4, 2, 'Week two lead')] },
      { week: 0, stories: [story(5, 0, 'Preseason lead')] },
    ],
  };
};

const renderPage = (entry = `${ROUTES.NEWS}/2026`) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path={ROUTES.NEWS_YEAR} element={<News />} />
    </Routes>
  </MemoryRouter>,
);

describe('News page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({ data: buildData(), loading: false, error: null });
  });

  it('defaults to the newest available week in a two-panel workspace', () => {
    const markup = renderPage();

    expect(markup).toContain('aria-label="News weeks"');
    expect(markup).toContain('aria-label="Week 3 stories"');
    expect(markup).toContain('Week three lead');
    expect(markup).not.toContain('Week two lead deck.');
    expect(markup).toContain('3 stories');
  });

  it('selects a requested week from the URL query', () => {
    const markup = renderPage(`${ROUTES.NEWS}/2026?week=2`);

    expect(markup).toContain('aria-label="Week 2 stories"');
    expect(markup).toContain('Week two lead deck.');
    expect(markup).not.toContain('Week three lead deck.');
    expect(markup).toContain('1 story');
  });

  it.each(['99', 'invalid', ''])(
    'falls back to the newest week for query value %j',
    query => {
      const markup = renderPage(`${ROUTES.NEWS}/2026?week=${query}`);
      expect(markup).toContain('aria-label="Week 3 stories"');
      expect(markup).toContain('Week three lead deck.');
    },
  );

  it('supports preseason selection', () => {
    const markup = renderPage(`${ROUTES.NEWS}/2026?week=0`);

    expect(markup).toContain('aria-label="Preseason stories"');
    expect(markup).toContain('Preseason lead deck.');
  });

  it('preserves lead and supporting story order', () => {
    const markup = renderPage();
    const leadIndex = markup.indexOf('Week three lead deck.');
    const firstSupportIndex = markup.indexOf('Week three support one deck.');
    const secondSupportIndex = markup.indexOf('Week three support two deck.');

    expect(leadIndex).toBeGreaterThan(-1);
    expect(firstSupportIndex).toBeGreaterThan(leadIndex);
    expect(secondSupportIndex).toBeGreaterThan(firstSupportIndex);
    expect(markup).toContain('href="/game/1"');
  });

  it('omits week controls when the selected season has no stories', () => {
    mockUseDomainData.mockReturnValue({
      data: { ...buildData(), weeks: [] },
      loading: false,
      error: null,
    });

    const markup = renderPage();
    expect(markup).toContain('No stories from this season yet');
    expect(markup).not.toContain('aria-label="News weeks"');
    expect(markup).not.toContain('aria-label="Week 3 stories"');
  });
});
