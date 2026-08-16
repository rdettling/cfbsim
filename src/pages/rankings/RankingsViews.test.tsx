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
};

describe('rankings wins-above-average presentation', () => {
  it('shows cumulative wins above average on desktop', () => {
    const markup = renderToStaticMarkup(
      <RankingsDesktopTable
        teams={[rankedTeam]}
        hasUpcomingGames={false}
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
    expect(markup).toContain('Recent Result');
    expect(markup).not.toContain('Poll');
    expect(markup).not.toContain('Next Game');
    expect(markup).not.toContain('SOR/Game');
    expect(markup).not.toContain('SOR Rank');
  });

  it('shows cumulative wins above average on mobile', () => {
    const markup = renderToStaticMarkup(
      <RankingsMobileList
        teams={[rankedTeam]}
        hasUpcomingGames={false}
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

  it('shows the next game only on desktop while games remain', () => {
    const desktop = renderToStaticMarkup(
      <RankingsDesktopTable
        teams={[rankedTeam]}
        hasUpcomingGames
        onTeamClick={() => {}}
      />,
    );
    const mobile = renderToStaticMarkup(
      <RankingsMobileList
        teams={[rankedTeam]}
        hasUpcomingGames
        onTeamClick={() => {}}
      />,
    );

    expect(desktop).toContain('Next Game');
    expect(mobile).not.toContain('Next game');
  });
});
