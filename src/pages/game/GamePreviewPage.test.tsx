import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { GamePageData } from '../../types/pages';
import GamePreviewPage from './GamePreviewPage';

const emptyPreview = {
  gamesPlayed: 0,
  stats: {
    yards_per_game: 0,
    pass_yards_per_game: 0,
    pass_tds_per_game: 0,
    rush_yards_per_game: 0,
    turnovers_per_game: 0,
    points_per_game: 0,
  },
  ranks: {
    yards_per_game: 1,
    pass_yards_per_game: 1,
    pass_tds_per_game: 1,
    rush_yards_per_game: 1,
    turnovers_per_game: 1,
    points_per_game: 1,
  },
  topStarters: [],
  lastFiveGames: [],
};

describe('GamePreviewPage', () => {
  it('shows previous matchups above the retained mobile preview tabs', () => {
    const league = buildTestLeague('season');
    const teamA = buildTestTeam({ id: 1, name: 'Away State', abbreviation: 'AWY' });
    const teamB = buildTestTeam({ id: 2, name: 'Home Tech', abbreviation: 'HME' });
    const data = {
      info: league.info,
      team: teamA,
      conferences: league.conferences,
      game: {
        id: 10,
        label: 'Regular Season',
        base_label: 'Regular Season',
        name: 'Away State at Home Tech',
        weekPlayed: 4,
        year: 2026,
        teamA,
        teamB,
        homeTeamId: teamB.id,
        awayTeamId: teamA.id,
        neutralSite: false,
        venue: null,
        rankATOG: 8,
        rankBTOG: 12,
        spreadA: '+2.5',
        spreadB: '-2.5',
        moneylineA: '+120',
        moneylineB: '-140',
        winProbA: 0.45,
        winProbB: 0.55,
        winnerId: null,
        scoreA: 0,
        scoreB: 0,
        resultA: '',
        resultB: '',
        overtime: 0,
        story: null,
      },
      preview: { teamA: emptyPreview, teamB: emptyPreview },
      resultSummary: null,
      drives: [],
      previousMatchups: {
        rows: [{
          rowKey: 'simulated:44',
          source: 'simulated',
          gameId: 44,
          year: 2025,
          week: 8,
          label: 'Rivalry Game',
          site: 'teamB-home',
          teamAScore: 27,
          teamBScore: 24,
          winnerSide: 'teamA',
        }],
        series: { teamAWins: 1, teamBWins: 0, ties: 0 },
      },
      detailUnavailable: false,
    } as GamePageData;

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <GamePreviewPage data={data} />
      </MemoryRouter>,
    );

    expect(markup).toContain('Previous Matchups');
    expect(markup).toContain('Series · Away State 1–0');
    expect(markup).toContain('href="/game/44"');
    expect(markup).toContain('Matchup');
    expect(markup).toContain('Top Starters');
    expect(markup).toContain('Recent Form');
    expect(markup.indexOf('Previous Matchups')).toBeLessThan(markup.indexOf('role="tablist"'));
  });
});
