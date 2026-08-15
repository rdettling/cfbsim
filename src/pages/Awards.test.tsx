import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague } from '../test/fixtures';
import type { AwardsPageData } from '../types/pages';
import Awards from './Awards';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const buildData = (
  stage: 'season' | 'summary' | 'realignment',
  mode: AwardsPageData['mode'],
): AwardsPageData => {
  const league = buildTestLeague(stage);
  if (mode === null) {
    return {
      info: league.info,
      team: league.teams[0],
      conferences: league.conferences,
      mode,
      awards: [],
    };
  }
  return {
    info: league.info,
    team: league.teams[0],
    conferences: league.conferences,
    mode,
    awards: [{
      categorySlug: 'heisman',
      categoryName: 'Heisman Trophy',
      categoryDescription: 'Most outstanding player.',
      group: 'overall',
      placements: [{
        key: 'first',
        player: {
          id: 1,
          first: 'Pat',
          last: 'Player',
          position: 'qb',
          teamName: league.teams[0].name,
        },
        score: 300,
        statLine: '4000 passing yards',
      }],
    }],
  };
};

const renderPage = () => renderToStaticMarkup(
  <MemoryRouter initialEntries={['/awards']}>
    <Awards />
  </MemoryRouter>,
);

describe('Awards page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({
      data: buildData('season', 'live'),
      loading: false,
      error: null,
    });
  });

  it('shows only the current live awards board during the season', () => {
    const markup = renderPage();

    expect(markup).toContain('Individual Awards');
    expect(markup).toContain('Live award races');
    expect(markup).toContain('Awards board');
    expect(markup).toContain('Pat Player');
    expect(markup).not.toContain('Current Season');
    expect(markup).not.toContain('Awards views');
    expect(markup).not.toContain('History</button>');
  });

  it('shows final results during Season Summary', () => {
    mockUseDomainData.mockReturnValue({
      data: buildData('summary', 'final'),
      loading: false,
      error: null,
    });

    const markup = renderPage();
    expect(markup).toContain('Final results');
    expect(markup).toContain('Awards board');
    expect(markup).toContain('Pat Player');
  });

  it('sends unavailable stages to archived awards in League History', () => {
    mockUseDomainData.mockReturnValue({
      data: buildData('realignment', null),
      loading: false,
      error: null,
    });

    const markup = renderPage();
    expect(markup).toContain('Current awards unavailable');
    expect(markup).toContain('View award history');
    expect(markup).toContain('href="/league/history?tab=awards"');
    expect(markup).not.toContain('Live award races');
  });
});
