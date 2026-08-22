import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import type { TeamAggregateStatKey, TeamAggregateStats } from '../types/stats';
import type { TeamStatsPageData } from '../types/pages';
import TeamStats from './TeamStats';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const zeroAggregate: TeamAggregateStats = {
  games: 0,
  ppg: 0,
  pass_cpg: 0,
  pass_apg: 0,
  comp_percent: 0,
  pass_ypg: 0,
  pass_tdpg: 0,
  rush_apg: 0,
  rush_ypg: 0,
  rush_ypc: 0,
  rush_tdpg: 0,
  playspg: 0,
  yardspg: 0,
  ypp: 0,
  first_downs_pass: 0,
  first_downs_rush: 0,
  first_downs_total: 0,
  fumbles: 0,
  interceptions: 0,
  turnovers: 0,
};

const ranks = Object.fromEntries(
  (Object.keys(zeroAggregate) as TeamAggregateStatKey[]).map(key => [key, 1]),
) as Record<TeamAggregateStatKey, number>;

const buildData = (): TeamStatsPageData => {
  const league = buildTestLeague('season');
  return {
    info: league.info,
    team: buildTestTeam({ gamesPlayed: 0 }),
    teams: ['Alpha Tech', 'Test State'],
    conferences: league.conferences,
    years: [2025],
    selectedYear: 2025,
    teamStats: {
      offense: { values: zeroAggregate, ranks },
      defense: { values: zeroAggregate, ranks },
    },
    playerStats: {
      passing: [
        {
          id: 2,
          first: 'Alex',
          last: 'Zebra',
          pos: 'qb',
          stats: {
            att: 10,
            cmp: 6,
            yards: 90,
            td: 1,
            int: 0,
            pct: 60,
            passer_rating: 100,
            adjusted_pass_yards_per_attempt: 9,
            yards_per_game: 90,
          },
        },
        {
          id: 1,
          first: 'Bob',
          last: 'Baker',
          pos: 'qb',
          stats: {
            att: 20,
            cmp: 14,
            yards: 200,
            td: 2,
            int: 1,
            pct: 70,
            passer_rating: 110,
            adjusted_pass_yards_per_attempt: 10,
            yards_per_game: 200,
          },
        },
      ],
      rushing: [],
      receiving: [],
      defense: [],
      kicking: [],
    },
  };
};

describe('TeamStats page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({
      data: buildData(),
      loading: false,
      error: null,
    });
  });

  it('renders the nested team and player statistic tabs, team choices, and player links', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/Test%20State/stats']}>
        <Routes>
          <Route path="/:teamName/stats" element={<TeamStats />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('Team Statistics');
    expect(markup).toContain('Player Statistics');
    expect(markup).toContain('aria-label="Statistics section"');
    expect(markup).toContain('aria-label="Team statistics category"');
    expect(markup).toContain('aria-label="Player statistics category"');
    expect(markup).toContain('id="team-statistics-panel"');
    expect(markup).toContain('id="player-statistics-panel"');
    expect(markup).toContain('Passing');
    expect(markup).toContain('Rushing');
    expect(markup).toContain('Receiving');
    expect(markup).toContain('Defense');
    expect(markup).toContain('Kicking');
    expect(markup).toContain('Team</label>');
    expect(markup).toContain('/players/1');
    expect(markup.indexOf('Bob Baker')).toBeLessThan(markup.indexOf('Alex Zebra'));
  });

  it('shows the preseason message while retaining zero-valued team statistics', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/Test%20State/stats']}>
        <Routes>
          <Route path="/:teamName/stats" element={<TeamStats />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('No games have been completed');
    expect(markup).toContain('Points / game');
    expect(markup).toContain('#1');
  });

  it('keeps user-team navbar branding while viewing another team', () => {
    const data = buildData();
    mockUseDomainData.mockReturnValue({
      data: {
        ...data,
        info: { ...data.info, team: 'Alabama' },
        team: buildTestTeam({ id: 2, name: 'Georgia', mascot: 'Bulldogs' }),
      },
      loading: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/Georgia/stats']}>
        <Routes>
          <Route path="/:teamName/stats" element={<TeamStats />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('src="/logos/teams/Alabama.png"');
    expect(markup).toContain('Georgia Bulldogs');
  });

  it('renders an archived season without a preseason message', () => {
    const data = buildData();
    mockUseDomainData.mockReturnValue({
      data: {
        ...data,
        selectedYear: 2024,
        years: [2025, 2024],
      },
      loading: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/Test%20State/stats/2024']}>
        <Routes>
          <Route path="/:teamName/stats/:year?" element={<TeamStats />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('value="2024"');
    expect(markup).toContain('Season</label>');
    expect(markup).not.toContain('No games have been completed');
  });
});
