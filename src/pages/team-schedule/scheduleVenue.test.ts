import { describe, expect, it } from 'vitest';
import { getScheduleVenueLabel } from './scheduleVenue';

describe('getScheduleVenueLabel', () => {
  it.each([
    [{ location: 'Home' as const, venue: 'Home Stadium' }, 'Home'],
    [{ location: 'Away' as const, venue: 'Away Stadium' }, 'Away'],
    [{ location: 'Neutral' as const, venue: null }, 'Neutral'],
    [{ location: 'Neutral' as const, venue: 'Rose Bowl' }, 'Neutral (Rose Bowl)'],
    [{ location: undefined, venue: null }, '—'],
  ])('formats %o as %s', (game, expected) => {
    expect(getScheduleVenueLabel(game)).toBe(expected);
  });
});
