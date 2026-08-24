import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import type { BiggestUpsetsPageData } from '../types/pages';
import BiggestUpsets from './BiggestUpsets';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const buildData = (): BiggestUpsetsPageData => {
  const winner = buildTestTeam({ id: 1, name: 'Alpha State', abbreviation: 'ALP' });
  const loser = buildTestTeam({ id: 2, name: 'Beta Tech', abbreviation: 'BET' });
  const league = buildTestLeague('season', { teams: [winner, loser] });
  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team: winner,
    conferences: league.conferences,
    upsets: [{
      gameId: 42,
      year: 2025,
      week: 8,
      label: 'Test Conference Championship',
      overtime: 2,
      winnerWinProbability: 0.075,
      winner: { id: 1, name: 'Alpha State', abbreviation: 'ALP', rank: 0, score: 31 },
      loser: { id: 2, name: 'Beta Tech', abbreviation: 'BET', rank: 3, score: 28 },
    }],
  };
};

const renderPage = () => renderToStaticMarkup(
  <MemoryRouter initialEntries={['/league/upsets']}>
    <BiggestUpsets />
  </MemoryRouter>,
);

describe('BiggestUpsets page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({ data: buildData(), loading: false, error: null });
  });

  it('renders the current-season list, default sort, and responsive result views', () => {
    const markup = renderPage();

    expect(markup).toContain('Biggest Upsets');
    expect(markup).toContain('2025 season · 1 qualifying upset');
    expect(markup).toContain('pregame win probability of 10% or lower');
    expect(markup).toContain('Week — newest first');
    expect(markup.match(/aria-label="Biggest upsets"/g)).toHaveLength(2);
    expect(markup).toContain('7.5%');
    expect(markup).toContain('31–28');
    expect(markup).toContain('2OT');
    expect(markup).toContain('href="/game/42"');
    expect(markup).toContain('Alpha State');
    expect(markup).toContain('#3');
  });

  it('renders the current-season empty state', () => {
    mockUseDomainData.mockReturnValue({
      data: { ...buildData(), upsets: [] },
      loading: false,
      error: null,
    });

    const markup = renderPage();
    expect(markup).toContain('No qualifying upsets yet');
    expect(markup).toContain('as the season progresses');
    expect(markup).not.toContain('aria-label="Biggest upsets"');
  });
});
