import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../test/fixtures';
import type { LeagueHistoryPageData } from '../types/pages';
import LeagueHistory from './LeagueHistory';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

const buildData = (): LeagueHistoryPageData => {
  const league = buildTestLeague('season');
  const champion = buildTestTeam();
  const runnerUp = buildTestTeam({ id: 2, name: 'Other State', abbreviation: 'OTH' });
  const toHistoryTeam = (team: typeof champion, ranking: number, record: string) => ({
    id: team.id,
    name: team.name,
    conference: 'Test Conference',
    record,
    ranking,
    rating: team.rating,
    prestige: team.prestige,
  });
  const championHistory = toHistoryTeam(champion, 1, '15-0 (8-0)');
  const runnerUpHistory = toHistoryTeam(runnerUp, 2, '13-2 (7-1)');
  return {
    info: league.info,
    team: champion,
    conferences: league.conferences,
    playoffTeams: league.settings.playoffTeams,
    years: [2025],
    season: {
      year: 2025,
      playoff: {
        teams: 2,
        autobids: 0,
        conferenceChampionsReceiveTopSeeds: false,
        bracket: {
          championship: {
            id: 'championship',
            game_id: 1,
            team1: champion.name,
            team2: runnerUp.name,
            seed1: 1,
            seed2: 2,
            spread1: null,
            spread2: null,
            score1: 31,
            score2: 24,
            winner: champion.name,
          },
        },
      },
      championship: {
        gameId: 1,
        champion: championHistory,
        runnerUp: runnerUpHistory,
        championScore: 31,
        runnerUpScore: 24,
      },
      userTeam: {
        ...championHistory,
        accomplishments: [{ type: 'national_champion', label: 'National Champion' }],
      },
      finalRankings: [championHistory, runnerUpHistory],
      conferenceChampions: [{
        conferenceName: 'Test Conference',
        team: championHistory,
        championshipGameId: 2,
      }],
      bowls: [{
        gameId: 3,
        name: 'Rose Bowl',
        status: 'final',
        tier: 'ny6',
        teams: [
          {
            name: champion.name,
            conference: championHistory.conference,
            isConferenceChampion: true,
            ranking: 1,
            record: championHistory.record,
            spread: null,
            score: 31,
            isWinner: true,
          },
          {
            name: runnerUp.name,
            conference: runnerUpHistory.conference,
            isConferenceChampion: false,
            ranking: 2,
            record: runnerUpHistory.record,
            spread: null,
            score: 24,
            isWinner: false,
          },
        ],
      }],
      awards: [{
        categorySlug: 'heisman',
        categoryName: 'Heisman Trophy',
        categoryDescription: 'Most outstanding overall player',
        group: 'overall',
        placements: [{
          key: 'first',
          player: {
            id: 1,
            first: 'Pat',
            last: 'Player',
            position: 'qb',
            teamName: champion.name,
          },
          score: null,
          statLine: '280/400, 4200 pass yds, 40 TD',
        }],
      }],
    },
  };
};

const renderPage = (entry = '/league/history/2025') => renderToStaticMarkup(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/league/history/:year" element={<LeagueHistory />} />
    </Routes>
  </MemoryRouter>,
);

describe('LeagueHistory page', () => {
  beforeEach(() => {
    mockUseDomainData.mockReturnValue({ data: buildData(), loading: false, error: null });
  });

  it('renders a populated season overview and all section tabs', () => {
    const markup = renderPage();

    expect(markup).toContain('League History');
    expect(markup).toContain('National Champion');
    expect(markup).toContain('Test State');
    expect(markup).toContain('Other State');
    expect(markup).toContain('Final Top 25');
    expect(markup).toContain('Conference Champions');
    expect(markup).toContain('aria-label="League history sections"');
    expect(markup).toContain('Overview');
    expect(markup).toContain('Playoff');
    expect(markup).toContain('Bowls');
    expect(markup).toContain('Awards');
    expect(markup).toContain('href="/game/1"');
  });

  it('explains when completed seasons become available', () => {
    mockUseDomainData.mockReturnValue({
      data: { ...buildData(), years: [], season: null },
      loading: false,
      error: null,
    });

    const markup = renderPage();
    expect(markup).toContain('No completed seasons in League History');
    expect(markup).toContain('after you advance out of Season Summary');
  });

  it('opens archived awards directly from the tab query', () => {
    const markup = renderPage('/league/history/2025?tab=awards');

    expect(markup).toContain('Heisman Trophy');
    expect(markup).toContain('Awards board');
    expect(markup).toContain('Overall');
    expect(markup).toContain('Pat Player');
    expect(markup).toContain('href="/players/1"');
    expect(markup).toContain('Test State');
    expect(markup).toContain('280/400, 4200 pass yds, 40 TD');
    expect(markup).toContain('QB');
    expect(markup).not.toContain('View finalists');
    expect(markup).not.toContain('Score');
  });

  it('opens archived bowls with the shared result presentation', () => {
    const markup = renderPage('/league/history/2025?tab=bowls');

    expect(markup).toContain('Final');
    expect(markup).not.toContain('final result');
    expect(markup).toContain('Open Rose Bowl');
    expect(markup).toContain('Test State winner');
    expect(markup).toContain('Conference champ');
    expect(markup).not.toContain('>-3<');
  });
});
