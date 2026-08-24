import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BowlGameEntry, BowlTeamEntry } from '../../types/postseason';
import { PostseasonBowlView } from './PostseasonBowlView';

const team = (overrides: Partial<BowlTeamEntry> = {}): BowlTeamEntry => ({
  name: 'Test State',
  conference: 'Big 12',
  isConferenceChampion: false,
  ranking: 12,
  record: '10-2 (7-2)',
  spread: '-7',
  score: null,
  isWinner: false,
  ...overrides,
});

const bowl = (overrides: Partial<BowlGameEntry> = {}): BowlGameEntry => ({
  gameId: 1,
  name: 'Alamo Bowl',
  status: 'scheduled',
  tier: 'other',
  teams: [
    team(),
    team({
      name: 'Other Tech',
      conference: 'ACC',
      ranking: 18,
      record: '9-3 (6-2)',
      spread: null,
    }),
  ],
  ...overrides,
});

const projected = (
  name: string,
  tier: BowlGameEntry['tier'],
  rankA: number,
  rankB: number,
) => bowl({
  gameId: null,
  name,
  status: 'projected',
  tier,
  teams: [team({ ranking: rankA }), team({ name: 'Other Tech', ranking: rankB })],
});

const renderView = (games: BowlGameEntry[]) =>
  renderToStaticMarkup(
    <PostseasonBowlView
      games={games}
      onGameClick={vi.fn()}
      onTeamClick={vi.fn()}
    />,
  );

describe('PostseasonBowlView', () => {
  it('lists folded playoff games first and orders each remaining tier by its best-ranked team', () => {
    const markup = renderView([
      projected('Texas Bowl', 'other', 3, 30),
      projected('Rose Bowl', 'ny6', 12, 18),
      projected('Alamo Bowl', 'other', 20, 25),
      projected('Playoff Semifinal', 'playoff', 2, 3),
      projected('Sugar Bowl', 'ny6', 5, 8),
    ]);

    expect(markup.indexOf('Playoff Semifinal')).toBeLessThan(markup.indexOf('Sugar Bowl'));
    expect(markup.indexOf('Sugar Bowl')).toBeLessThan(markup.indexOf('Rose Bowl'));
    expect(markup.indexOf('Rose Bowl')).toBeLessThan(markup.indexOf('Texas Bowl'));
    expect(markup.indexOf('Texas Bowl')).toBeLessThan(markup.indexOf('Alamo Bowl'));
    expect(markup).not.toContain('New Year’s Six');
    expect(markup).not.toContain('Other Bowls');
    expect(markup).not.toContain('Open Alamo Bowl');
    expect(markup).not.toContain('View game');
  });

  it('presents mixed scheduled and final games with links, scores, and winner context', () => {
    const markup = renderView([
      bowl(),
      bowl({
        gameId: 2,
        name: 'Rose Bowl',
        status: 'final',
        tier: 'ny6',
        teams: [
          team({ isConferenceChampion: true, spread: null, score: 31, isWinner: true }),
          team({ name: 'Other Tech', spread: null, score: 24 }),
        ],
      }),
    ]);

    expect(markup).toContain('Open Alamo Bowl');
    expect(markup).toContain('Open Rose Bowl');
    expect(markup).toContain('Test State winner');
    expect(markup).toContain('Conference champ');
    expect(markup).toContain('31');
    expect(markup).toContain('24');
    expect(markup).toContain('Final');
    expect(markup).toContain('Scheduled');
    expect(markup).toContain('>-7<');
    expect(markup).not.toContain('>VS<');
  });

  it('shows final status on each archived result without a slate summary', () => {
    const finalBowl = (name: string, winnerIndex: 0 | 1) => bowl({
      name,
      status: 'final',
      teams: [
        team({ spread: null, score: 28, isWinner: winnerIndex === 0 }),
        team({ name: 'Other Tech', spread: null, score: 21, isWinner: winnerIndex === 1 }),
      ],
    });
    const markup = renderView([
      finalBowl('Alamo Bowl', 0),
      finalBowl('Citrus Bowl', 1),
    ]);

    expect(markup.match(/Final/g)).toHaveLength(2);
    expect(markup).not.toContain('final results');
    expect(markup).not.toContain('>-7<');
  });

  it('retains the explicit empty state', () => {
    const markup = renderView([]);

    expect(markup).toContain('No bowl slate available');
    expect(markup).toContain('Bowl matchups will appear when eligible teams are available.');
  });
});
