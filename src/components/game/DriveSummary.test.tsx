import { describe, expect, it } from 'vitest';
import { buildTestPlayTiming } from '../../test/fixtures';
import { CLOCK_EVENT_LABELS, formatPlayTiming } from './DriveSummary';

describe('drive timing presentation', () => {
  it('formats regulation and overtime timing without inference', () => {
    expect(formatPlayTiming(buildTestPlayTiming())).toBe('Q1 15:00');
    expect(formatPlayTiming({ kind: 'overtime', period: 3, outOfBounds: false })).toBe('OT 3');
    expect(formatPlayTiming({
      kind: 'try',
      context: 'regulation',
      quarter: 4,
      secondsLeft: 12,
    })).toBe('Q4 0:12');
    expect(formatPlayTiming({ kind: 'try', context: 'overtime', period: 3 })).toBe('OT 3');
  });

  it('provides a compact label for every persisted clock event', () => {
    expect(CLOCK_EVENT_LABELS).toEqual({
      two_minute_timeout: 'Two-Minute Timeout',
      end_of_quarter: 'End of Quarter',
      halftime: 'Halftime',
      end_of_regulation: 'End of Regulation',
    });
  });
});
