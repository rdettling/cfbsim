import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { buildTestLeague } from '../test/fixtures';
import type { BowlGamesPageData } from '../types/pages';
import BowlGames from './BowlGames';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const buildData = (): BowlGamesPageData => {
  const league = buildTestLeague('season');
  return {
    info: league.info,
    team: league.teams[0],
    conferences: league.conferences,
    playoffTeams: league.settings.playoffTeams,
    games: [{
      gameId: 1,
      name: 'Alamo Bowl',
      status: 'scheduled',
      tier: 'other',
      teams: [
        {
          name: 'Test State',
          conference: 'Big 12',
          isConferenceChampion: false,
          ranking: 12,
          record: '10-2 (7-2)',
          spread: '-7',
          score: null,
          isWinner: false,
        },
        {
          name: 'Other Tech',
          conference: 'ACC',
          isConferenceChampion: false,
          ranking: 18,
          record: '9-3 (6-2)',
          spread: null,
          score: null,
          isWinner: false,
        },
      ],
    }],
  };
};

describe('BowlGames page', () => {
  it('uses the simplified header without slate-level metadata', () => {
    mockUseDomainData.mockReturnValue({ data: buildData(), loading: false, error: null });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <BowlGames />
      </MemoryRouter>,
    );

    expect(markup).toContain('<h1');
    expect(markup).toContain('Bowl Games');
    expect(markup).toContain('Scheduled');
    expect(markup).toContain('>-7<');
    expect(markup).not.toContain('scheduled game');
    expect(markup).not.toContain('12-team playoff');
    expect(markup).not.toContain('5 autobids');
    expect(markup).not.toContain('Final field');
    expect(markup).not.toContain('Scheduled postseason games and completed results.');
  });
});
