import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdvancedTeamStatsRow } from '../../types/stats';
import { AdvancedStatsDesktopTable } from './AdvancedStatsDesktopTable';
import { AdvancedStatsMobileList } from './AdvancedStatsMobileList';
import { PollCalculationBreakdown } from './PollCalculationBreakdown';

const row: AdvancedTeamStatsRow = {
  teamId: 1,
  teamName: 'Test State',
  record: '2-0 (1-0)',
  games: 2,
  pollRank: 4,
  pollScore: 91.87,
  projectedPollScore: 91.87,
  pollScoreMatchesProjection: true,
  pollRankOverrideReason: null,
  performanceIndex: 72.34,
  offensePerformance: 74.56,
  defensePerformance: 70.12,
  teamRating: 96,
  teamScore: 95.95,
  teamRatingPriorWeight: 0.8,
  teamScoreContribution: 76.76,
  evidenceScoreContribution: 15.11,
  resumeScore: 76.8,
  evidenceScore: 75.56,
  offense: {
    successRate: 0.456,
    standardDownSuccessRate: 0.48,
    passingDownSuccessRate: 0.4,
    explosivePlayRate: 0.123,
    successfulPlayYards: 11.2,
    pointsPerOpportunity: 5.25,
    havocRate: 0.08,
    averageStartingFieldPosition: 30.2,
    lineYardsPerCarry: 3.75,
    stuffRate: 0.14,
  },
  defense: {
    successRate: 0.33,
    standardDownSuccessRate: 0.35,
    passingDownSuccessRate: 0.29,
    explosivePlayRate: 0.08,
    successfulPlayYards: 8.7,
    pointsPerOpportunity: 3.2,
    havocRate: 0.16,
    averageStartingFieldPosition: 27.1,
    lineYardsPerCarry: 2.8,
    stuffRate: 0.23,
  },
};

const props = {
  rows: [row],
  mode: 'offense' as const,
  sortKey: 'successRate' as const,
  sortDirection: 'desc' as const,
  onSort: () => {},
  onTeamClick: () => {},
};

describe('advanced statistics views', () => {
  it('keeps the Performance view focused on performance and rating context', () => {
    const markup = renderToStaticMarkup(<AdvancedStatsDesktopTable
      {...props}
      mode="performance"
      sortKey="performanceIndex"
    />);

    expect(markup).toContain('Performance');
    expect(markup).toContain('Team Rating');
    expect(markup).toContain('72.3');
    expect(markup).toContain('96.0');
    expect(markup).not.toContain('Confidence');
    expect(markup).not.toContain('>Games<');
    expect(markup).not.toContain('Résumé');
  });

  it('renders official poll rank and every ranking component on desktop', () => {
    const markup = renderToStaticMarkup(<AdvancedStatsDesktopTable
      {...props}
      mode="poll"
      sortKey="pollRank"
      sortDirection="asc"
    />);

    expect(markup).toContain('Poll Rank');
    expect(markup).toContain('Poll Score');
    expect(markup).toContain('Rating Prior');
    expect(markup).toContain('Team Score');
    expect(markup).toContain('Evidence');
    expect(markup).toContain('Résumé');
    expect(markup).toContain('Show Test State poll calculation');
    expect(markup).toContain('91.9');
    expect(markup).toContain('80%');
  });

  it('renders sortable definitions and formatted offense metrics on desktop', () => {
    const markup = renderToStaticMarkup(<AdvancedStatsDesktopTable {...props} />);

    expect(markup).toContain('Success');
    expect(markup).toContain('45.6%');
    expect(markup).toContain('5.25');
    expect(markup).toContain('Test State');
    expect(markup).toContain('Plays gaining 50% of needed yards');
  });

  it('renders the selected metric and expansion control on mobile', () => {
    const markup = renderToStaticMarkup(<AdvancedStatsMobileList {...props} />);

    expect(markup).toContain('45.6%');
    expect(markup).toContain('Success Rate');
    expect(markup).toContain('Show Test State advanced statistics');
  });

  it('shows exact published and projected poll equations', () => {
    const published = renderToStaticMarkup(<PollCalculationBreakdown row={row} />);
    const stale = renderToStaticMarkup(<PollCalculationBreakdown row={{
      ...row,
      pollScore: 93,
      pollScoreMatchesProjection: false,
    }} />);

    expect(published).toContain('Published poll calculation');
    expect(published).toContain('72.2%');
    expect(published).toContain('27.8%');
    expect(published).toContain('80%');
    expect(stale).toContain('Current poll projection');
    expect(stale).toContain('remains 93.0 until rankings publish again');
  });

  it('uses only the Team Score equation before games', () => {
    const preseason = renderToStaticMarkup(<PollCalculationBreakdown row={{
      ...row,
      games: 0,
      pollScore: row.teamScore,
      projectedPollScore: row.teamScore,
      pollScoreMatchesProjection: true,
      teamRatingPriorWeight: 1,
      teamScoreContribution: row.teamScore,
      evidenceScoreContribution: 0,
    }} />);

    expect(preseason).toContain('100% × Team Score 96.0');
    expect(preseason).not.toContain('Evidence Score 75.6 =');
  });

  it('labels playoff-selection overrides in compact and expanded Poll presentation', () => {
    const override = {
      ...row,
      pollRankOverrideReason: 'playoff_selection' as const,
    };
    const desktop = renderToStaticMarkup(<AdvancedStatsDesktopTable
      {...props}
      rows={[override]}
      mode="poll"
      sortKey="pollRank"
      sortDirection="asc"
    />);
    const mobile = renderToStaticMarkup(<AdvancedStatsMobileList
      {...props}
      rows={[override]}
      mode="poll"
      sortKey="pollRank"
      sortDirection="asc"
    />);
    const calculation = renderToStaticMarkup(
      <PollCalculationBreakdown row={override} />,
    );

    expect(desktop).toContain('Playoff');
    expect(mobile).toContain('Playoff selection rank override');
    expect(calculation).toContain('Official rank No. 4 differs from Poll Score order');
  });

  it('labels championship placement separately', () => {
    const markup = renderToStaticMarkup(<PollCalculationBreakdown row={{
      ...row,
      pollRankOverrideReason: 'championship_placement',
    }} />);

    expect(markup).toContain('Championship placement rank override');
    expect(markup).toContain('championship placement controls the final rank');
  });
});
