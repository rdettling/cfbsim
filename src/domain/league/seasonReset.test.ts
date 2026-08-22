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

  it('clears the frozen resume snapshot for the next season', async () => {
    const league = buildTestLeague('summary');
    league.resumeSnapshot = { year: 2025 } as typeof league.resumeSnapshot;

    await prepareSeasonReset(league, {
      rivalries: { rivalries: [] },
      odds: { oddsMap: {}, maxDiff: 100 },
    });

    expect(league.resumeSnapshot).toBeNull();
  });

  it('clears conference championships and final standings for the next season', async () => {
    const league = buildTestLeague('summary');
    const conference = league.conferences[0];
    conference.championship = 99;
    conference.finalStandings = {
      year: league.info.currentYear,
      entries: [{
        teamId: conference.teams[0].id,
        pollRank: conference.teams[0].ranking,
        resolvedBy: 'poll_rank',
      }],
    };

    await prepareSeasonReset(league, {
      rivalries: { rivalries: [] },
      odds: { oddsMap: {}, maxDiff: 100 },
    });

    expect(conference.championship).toBeNull();
    expect(conference.finalStandings).toBeNull();
  });
});
