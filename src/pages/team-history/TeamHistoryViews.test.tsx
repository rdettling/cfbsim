import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TeamHistoryDesktopTable } from './TeamHistoryDesktopTable';
import { TeamHistoryMobileList } from './TeamHistoryMobileList';
import type { TeamHistoryViewProps } from './types';

const years: TeamHistoryViewProps['years'] = [{
  year: 2025,
  prestige: 4,
  rating: null,
  conference: 'Test Conference',
  wins: 9,
  losses: 4,
  rank: 8,
  hasSchedule: true,
  era: 'historical',
  isChampion: false,
  accomplishments: [],
  signatureGames: [],
}];

describe('Team History schedule links', () => {
  it('links an available historical year in desktop and mobile views', () => {
    const desktop = renderToStaticMarkup(
      <MemoryRouter>
        <TeamHistoryDesktopTable
          years={years}
          teamName="Test State"
          startYear={2026}
        />
      </MemoryRouter>,
    );
    const mobile = renderToStaticMarkup(
      <MemoryRouter>
        <TeamHistoryMobileList
          years={years}
          teamName="Test State"
          startYear={2026}
        />
      </MemoryRouter>,
    );

    expect(desktop).toContain('schedule/2025');
    expect(mobile).toContain('schedule/2025');
  });

  it('leaves unavailable historical years as plain text', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <TeamHistoryMobileList
          years={[{ ...years[0], hasSchedule: false }]}
          teamName="Test State"
          startYear={2026}
        />
      </MemoryRouter>,
    );

    expect(markup).not.toContain('schedule/2025');
  });
});
