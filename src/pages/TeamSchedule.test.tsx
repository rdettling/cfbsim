import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import type { TeamSchedulePageData } from '../types/pages';
import TeamSchedule from './TeamSchedule';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const buildData = (): TeamSchedulePageData => {
  const league = buildTestLeague('season', {
    info: {
      ...buildTestLeague('season').info,
      currentYear: 2026,
      startYear: 2026,
    },
  });
  return {
    info: league.info,
    playoffTeams: league.settings.playoffTeams,
    team: buildTestTeam(),
    schedule: [{
      kind: 'game',
      source: 'historical',
      rowKey: 'historical:101',
      weekPlayed: 1,
      opponent: {
        name: 'Other State',
        rating: null,
        ranking: 12,
        record: null,
        canOpen: true,
      },
      result: 'W',
      score: '31-17',
      spread: null,
      moneyline: null,
      gameId: null,
      location: 'Home',
      venue: 'Historic Stadium',
      label: 'Conference: Test',
    }],
    teams: ['Other State', 'Test State'],
    conferences: league.conferences,
    years: [2026, 2025],
    selected_year: 2025,
    selectedTeamMetrics: {
      record: '9-4',
      rating: null,
      prestige: 5,
      ranking: 8,
      conference: 'Test Conference',
    },
  };
};

describe('TeamSchedule page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({
      data: buildData(),
      loading: false,
      error: null,
    });
  });

  it('renders an indexed historical selection and its non-clickable result', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/Test%20State/schedule/2025']}>
        <Routes>
          <Route path="/:teamName/schedule/:year" element={<TeamSchedule />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('2025 season');
    expect(markup).toContain('schedule-year-label');
    expect(markup).toContain('W 31-17');
    expect(markup).not.toContain('href="/game/');
    expect(markup).not.toContain('Rating 0');
  });
});
