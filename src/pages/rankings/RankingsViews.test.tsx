import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { RankingsDesktopTable } from './RankingsDesktopTable';
import { RankingsMobileList } from './RankingsMobileList';

const rankedTeam = {
  ...buildTestTeam({
    poll_score: 92.46,
    wins_over_expectation: 6.3,
    wins_over_expectation_per_game: 0.45,
  }),
  isPlayoffTeam: true,
  last_week: null,
  current_week: null,
};

describe('rankings poll-score presentation', () => {
  it('shows the authoritative poll score on desktop', () => {
    const markup = renderToStaticMarkup(
      <RankingsDesktopTable
        teams={[rankedTeam]}
        onTeamClick={() => {}}
      />,
    );

    expect(markup).toContain('Poll Score');
    expect(markup).toContain('Explain Poll Score');
    expect(markup).toContain(
      '72.2% Résumé Score and 27.8% opponent-adjusted Performance Index',
    );
    expect(markup).toContain('previous rank never affects the score');
    expect(markup).toContain('92.5');
    expect(markup).toContain('Playoff');
    expect(markup).toContain('Movement');
    expect(markup).toContain('Last Week');
    expect(markup).toContain('This Week');
    expect(markup).not.toContain('Wins Above Average');
    expect(markup).not.toContain('Recent Result');
    expect(markup).not.toContain('Next Game');
    expect(markup).not.toContain('WOE/Game');
    expect(markup).not.toContain('WOE Rank');
  });

  it('shows the authoritative poll score on mobile', () => {
    const markup = renderToStaticMarkup(
      <RankingsMobileList
        teams={[rankedTeam]}
        onTeamClick={() => {}}
      />,
    );

    expect(markup).toContain('Poll score');
    expect(markup).not.toContain('Explain Poll Score');
    expect(markup).toContain('92.5');
    expect(markup).toContain('Playoff');
    expect(markup).not.toContain('Recent result');
    expect(markup).not.toContain('Wins above');
    expect(markup).not.toContain('Next game');
    expect(markup).not.toContain('Wins Over Expectation per game');
    expect(markup).not.toContain('Wins Over Expectation rank');
  });

  it('shows the fixed weekly game columns only on desktop', () => {
    const desktop = renderToStaticMarkup(
      <RankingsDesktopTable
        teams={[rankedTeam]}
        onTeamClick={() => {}}
      />,
    );
    const mobile = renderToStaticMarkup(
      <RankingsMobileList
        teams={[rankedTeam]}
        onTeamClick={() => {}}
      />,
    );

    expect(desktop).toContain('Last Week');
    expect(desktop).toContain('This Week');
    expect(mobile).not.toContain('Last Week');
    expect(mobile).not.toContain('This Week');
  });
});
