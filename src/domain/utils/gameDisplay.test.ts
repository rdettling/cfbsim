import { describe, expect, it } from 'vitest';
import { formatNeutralSite } from './gameDisplay';

describe('neutral-site display', () => {
  it('prefers a named venue and retains the generic fallback', () => {
    expect(formatNeutralSite('Cotton Bowl')).toBe('Cotton Bowl');
    expect(formatNeutralSite(null)).toBe('Neutral Site');
    expect(formatNeutralSite(null, 'Neutral site')).toBe('Neutral site');
  });
});
