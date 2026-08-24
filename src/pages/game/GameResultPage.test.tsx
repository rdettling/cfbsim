import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { GamePageData } from '../../types/pages';
import GameResultPage from './GameResultPage';

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

describe('GameResultPage', () => {
  it('keeps recap and drives while hiding unavailable stat tabs', () => {
    const league = buildTestLeague('season');
    const teamA = buildTestTeam({ id: 1, name: 'Away State' });
    const teamB = buildTestTeam({ id: 2, name: 'Home Tech' });
    const data = {
      info: league.info,
      playoffTeams: league.settings.playoffTeams,
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
        homeTeamId: 2,
        awayTeamId: 1,
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
        winnerId: 1,
        scoreA: 24,
        scoreB: 21,
        resultA: 'W',
        resultB: 'L',
        overtime: 0,
        story: null,
      },
      preview: { teamA: emptyPreview, teamB: emptyPreview },
      resultSummary: null,
      drives: [],
      previousMatchups: {
        rows: [],
        series: { teamAWins: 0, teamBWins: 0, ties: 0 },
      },
      detailUnavailable: true,
    } as GamePageData;

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <GameResultPage data={data} />
      </MemoryRouter>,
    );

    expect(markup).toContain('Recap');
    expect(markup).toContain('Drives');
    expect(markup).not.toContain('Team Stats');
    expect(markup).not.toContain('Box Score');
    expect(markup).toContain('No written recap is available');
  });
});
