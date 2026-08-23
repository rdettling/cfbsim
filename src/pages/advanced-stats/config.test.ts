import { describe, expect, it } from 'vitest';
import type { AdvancedTeamStatsRow } from '../../types/stats';
import {
  ADVANCED_STATS_MODES,
  DEFAULT_ADVANCED_METRIC,
  DEFAULT_ADVANCED_STATS_MODE,
  formatAdvancedMetric,
  sortAdvancedStatsRows,
} from './config';

const row = (
  teamId: number,
  pollRank: number,
  evidenceScore: number,
) => ({
  teamId,
  pollRank,
  evidenceScore,
  games: 2,
} as AdvancedTeamStatsRow);

describe('advanced statistics configuration', () => {
  it('defines the four views in product order with Performance as default', () => {
    expect(ADVANCED_STATS_MODES).toEqual([
      { value: 'performance', label: 'Performance' },
      { value: 'poll', label: 'Poll' },
      { value: 'offense', label: 'Offense' },
      { value: 'defense', label: 'Defense' },
    ]);
    expect(DEFAULT_ADVANCED_STATS_MODE).toBe('performance');
    expect(DEFAULT_ADVANCED_METRIC.poll).toBe('pollRank');
  });

  it('defaults Poll to official order and preserves official ranks when sorting components', () => {
    const rows = [row(1, 2, 80), row(2, 1, 70)];

    expect(sortAdvancedStatsRows(rows, 'poll', 'pollRank', 'asc')
      .map(entry => entry.teamId)).toEqual([2, 1]);
    expect(sortAdvancedStatsRows(rows, 'poll', 'evidenceScore', 'desc')
      .map(entry => [entry.teamId, entry.pollRank])).toEqual([[1, 2], [2, 1]]);
  });

  it('hides evidence metrics before games while retaining preseason poll inputs', () => {
    const preseason = {
      ...row(1, 1, 0),
      games: 0,
      pollScore: 90,
      teamScore: 90,
      teamRatingPriorWeight: 1,
    } as AdvancedTeamStatsRow;

    expect(formatAdvancedMetric(preseason, 'poll', 'pollScore')).toBe('90.0');
    expect(formatAdvancedMetric(preseason, 'poll', 'teamRatingPriorWeight')).toBe('100%');
    expect(formatAdvancedMetric(preseason, 'poll', 'evidenceScore')).toBe('—');
    expect(formatAdvancedMetric(preseason, 'poll', 'performanceIndex')).toBe('—');
  });
});
