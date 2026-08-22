import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { RankingsDesktopTable } from './RankingsDesktopTable';
import { RankingsMobileList } from './RankingsMobileList';

const rankedTeam = {
  ...buildTestTeam({
    strength_of_record: 6.3,
    strength_of_record_avg: 0.45,
  }),
  isPlayoffTeam: true,
  last_week: null,
  current_week: null,
};

describe('rankings wins-above-average presentation', () => {
  it('shows cumulative wins above average on desktop', () => {
    const markup = renderToStaticMarkup(
      <RankingsDesktopTable
        teams={[rankedTeam]}
        onTeamClick={() => {}}
      />,
    );

    expect(markup).toContain('Wins Above Average');
    expect(markup).toContain('Explain Wins Above Average');
    expect(markup).toContain(
      'An estimate of how many more or fewer games a team won than an average team would against the same opponents at the same locations.',
    );
    expect(markup).toContain('6.3');
    expect(markup).toContain('Playoff');
    expect(markup).toContain('Movement');
    expect(markup).toContain('Last Week');
    expect(markup).toContain('This Week');
    expect(markup).not.toContain('Poll');
    expect(markup).not.toContain('Recent Result');
    expect(markup).not.toContain('Next Game');
    expect(markup).not.toContain('SOR/Game');
    expect(markup).not.toContain('SOR Rank');
  });

  it('shows cumulative wins above average on mobile', () => {
    const markup = renderToStaticMarkup(
      <RankingsMobileList
        teams={[rankedTeam]}
        onTeamClick={() => {}}
      />,
    );

    expect(markup).toContain('Wins above');
    expect(markup).toContain('average');
    expect(markup).not.toContain('Explain Wins Above Average');
    expect(markup).toContain('6.3');
    expect(markup).toContain('Playoff');
    expect(markup).not.toContain('Recent result');
    expect(markup).not.toContain('Poll score');
    expect(markup).not.toContain('Next game');
    expect(markup).not.toContain('Strength of record per game');
    expect(markup).not.toContain('SOR rank');
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
