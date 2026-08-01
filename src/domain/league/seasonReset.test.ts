import { describe, expect, it } from 'vitest';
import { buildTestLeague } from '../../test/fixtures';
import { prepareSeasonReset } from './seasonReset';

describe('season reset rivalry choices', () => {
  it('clears declined rivalries before preparing the next preseason', async () => {
    const league = buildTestLeague('summary', {
      declinedRivalries: ['Alpha::Beta'],
    });

    await prepareSeasonReset(league, {
      rivalries: { rivalries: [] },
      odds: { oddsMap: {}, maxDiff: 100 },
    });

    expect(league.declinedRivalries).toEqual([]);
  });
});
