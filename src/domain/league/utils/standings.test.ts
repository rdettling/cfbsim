import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import { sortStandingsTeams } from './standings';

const team = (
  name: string,
  overrides: Parameters<typeof buildTestTeam>[0],
) => buildTestTeam({ name, ...overrides });

describe('sortStandingsTeams', () => {
  it('orders postseason candidates by the canonical conference rules', () => {
    const teams = [
      team('lower percentage', { confWins: 5, confLosses: 3 }),
      team('more conference wins', { confWins: 4, confLosses: 2 }),
      team('fewer conference wins', { confWins: 2, confLosses: 1 }),
      team('highest percentage', { confWins: 7, confLosses: 1 }),
    ];

    expect(sortStandingsTeams(teams).map(entry => entry.name)).toEqual([
      'highest percentage',
      'more conference wins',
      'fewer conference wins',
      'lower percentage',
    ]);
  });

  it('uses fewer conference losses after percentage and conference wins', () => {
    const teams = [
      team('one loss', { confWins: 0, confLosses: 1 }),
      team('no losses', { confWins: 0, confLosses: 0 }),
    ];

    expect(sortStandingsTeams(teams)[0].name).toBe('no losses');
  });

  it('then uses total wins, total losses, and ranking in order', () => {
    const shared = { confWins: 4, confLosses: 2 };
    const teams = [
      team('ranking fallback', { ...shared, totalWins: 9, totalLosses: 3, ranking: 10 }),
      team('fewer total losses', { ...shared, totalWins: 9, totalLosses: 2, ranking: 20 }),
      team('more total wins', { ...shared, totalWins: 10, totalLosses: 4, ranking: 30 }),
      team('best ranking', { ...shared, totalWins: 9, totalLosses: 3, ranking: 5 }),
    ];

    expect(sortStandingsTeams(teams).map(entry => entry.name)).toEqual([
      'more total wins',
      'fewer total losses',
      'best ranking',
      'ranking fallback',
    ]);
  });
});
