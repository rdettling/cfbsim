import { describe, expect, it } from 'vitest';
import { normalizeRivalriesData } from './rivalryData';

const teams = new Set(['Texas', 'Oklahoma', 'Army', 'Navy']);

describe('rivalry data normalization', () => {
  it('normalizes campus, generic-neutral, and named-venue rivalries', () => {
    expect(normalizeRivalriesData({
      rivalries: [
        { teams: ['Texas', 'Oklahoma'], week: 6, name: 'Red River Showdown' },
        { teams: ['Army', 'Navy'], site: { type: 'neutral' } },
      ],
    }, teams)).toEqual({
      rivalries: [
        {
          teamA: 'Texas',
          teamB: 'Oklahoma',
          week: 6,
          name: 'Red River Showdown',
          neutralSite: false,
          venue: null,
        },
        {
          teamA: 'Army',
          teamB: 'Navy',
          week: null,
          name: null,
          neutralSite: true,
          venue: null,
        },
      ],
    });

    expect(normalizeRivalriesData({
      rivalries: [{
        teams: ['Texas', 'Oklahoma'],
        site: { type: 'neutral', venue: 'Cotton Bowl' },
      }],
    }, teams).rivalries[0]).toMatchObject({
      neutralSite: true,
      venue: 'Cotton Bowl',
    });
  });

  it.each([
    ['unexpected root key', { rivalries: [], extra: true }],
    ['tuple entry', { rivalries: [['Texas', 'Oklahoma', 6]] }],
    ['unexpected entry key', { rivalries: [{ teams: ['Texas', 'Oklahoma'], extra: true }] }],
    ['missing opponent', { rivalries: [{ teams: ['Texas'] }] }],
    ['same team twice', { rivalries: [{ teams: ['Texas', 'Texas'] }] }],
    ['unknown team', { rivalries: [{ teams: ['Texas', 'Unknown'] }] }],
    ['empty name', { rivalries: [{ teams: ['Texas', 'Oklahoma'], name: '' }] }],
    ['week zero', { rivalries: [{ teams: ['Texas', 'Oklahoma'], week: 0 }] }],
    ['week fifteen', { rivalries: [{ teams: ['Texas', 'Oklahoma'], week: 15 }] }],
    ['fractional week', { rivalries: [{ teams: ['Texas', 'Oklahoma'], week: 6.5 }] }],
    ['invalid site type', { rivalries: [{ teams: ['Texas', 'Oklahoma'], site: { type: 'campus' } }] }],
    ['unexpected site key', { rivalries: [{ teams: ['Texas', 'Oklahoma'], site: { type: 'neutral', city: 'Dallas' } }] }],
    ['empty venue', { rivalries: [{ teams: ['Texas', 'Oklahoma'], site: { type: 'neutral', venue: '' } }] }],
    ['duplicate pair', { rivalries: [
      { teams: ['Texas', 'Oklahoma'] },
      { teams: ['Oklahoma', 'Texas'] },
    ] }],
  ])('rejects %s', (_label, value) => {
    expect(() => normalizeRivalriesData(value, teams)).toThrow();
  });
});
