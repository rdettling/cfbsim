import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import type { LeagueRecordsPageData } from '../types/pages';
import LeagueRecords from './LeagueRecords';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const buildData = (): LeagueRecordsPageData => {
  const league = buildTestLeague('season');
  return {
    info: league.info,
    team: buildTestTeam(),
    conferences: league.conferences,
    coverage: {
      firstCompletedYear: 2000,
      lastCompletedYear: 2025,
      firstDynastyYear: 2025,
      lastDynastyYear: 2025,
    },
    hasCompletedSeasons: true,
    programs: [
      {
        name: 'Test State',
        active: true,
        conference: 'Test Conference',
        seasons: 26,
        wins: 230,
        losses: 90,
        winPercentage: 230 / 320,
        bestSeason: { year: 2025, wins: 15, losses: 0, finalRank: 1 },
        bestFinalRank: 1,
        nationalTitles: 1,
        conferenceTitles: 1,
        playoffAppearances: 1,
        bowlWins: 0,
        awardWinners: 2,
      },
      {
        name: 'Old College',
        active: false,
        conference: 'Old Conference',
        seasons: 5,
        wins: 30,
        losses: 25,
        winPercentage: 30 / 55,
        bestSeason: { year: 2004, wins: 9, losses: 3, finalRank: null },
        bestFinalRank: null,
        nationalTitles: 0,
        conferenceTitles: 0,
        playoffAppearances: 0,
        bowlWins: 0,
        awardWinners: 0,
      },
    ],
  };
};

const renderPage = () => renderToStaticMarkup(
  <MemoryRouter initialEntries={['/league/records']}>
    <LeagueRecords />
  </MemoryRouter>,
);

describe('LeagueRecords page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({ data: buildData(), loading: false, error: null });
  });

  it('renders grouped desktop records and compact mobile program rows', () => {
    const markup = renderPage();

    expect(markup).toContain('League Records');
    expect(markup).toContain('Completed seasons 2000–2025');
    expect(markup).toContain('Dynasty honors 2025–2025');
    expect(markup).toContain('Completed Seasons');
    expect(markup).toContain('Dynasty Honors');
    expect(markup).toContain('Rank by');
    expect(markup.match(/aria-label="League records"/g)).toHaveLength(2);
    expect(markup).toContain('Old College');
    expect(markup).toContain('Historical');
  });

  it('only renders active programs as team interactions', () => {
    const markup = renderPage();

    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Test State<\/button>/);
    expect(markup).not.toMatch(/<button[^>]*type="button"[^>]*>Old College<\/button>/);
  });

  it('renders the completed-season empty state and coverage copy', () => {
    mockUseDomainData.mockReturnValue({
      data: {
        ...buildData(),
        coverage: {
          firstCompletedYear: null,
          lastCompletedYear: null,
          firstDynastyYear: null,
          lastDynastyYear: null,
        },
        hasCompletedSeasons: false,
        programs: [],
      },
      loading: false,
      error: null,
    });

    const markup = renderPage();
    expect(markup).toContain('No completed seasons recorded');
    expect(markup).toContain('No dynasty seasons archived');
    expect(markup).toContain('League records will appear after completed season data is available.');
  });
});
