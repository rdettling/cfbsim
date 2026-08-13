import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SimMatchup } from '../../types/components';
import GameSimHeader from './GameSimHeader';

const matchup: SimMatchup = {
  awayTeam: { name: 'Alabama', ranking: 5, record: '0-0 (0-0)' },
  homeTeam: { name: 'Oklahoma', ranking: 14, record: '1-0 (0-0)' },
  awayScore: 0,
  homeScore: 0,
  currentScoreA: 0,
  currentScoreB: 0,
  awayIsTeamA: true,
  isAwayOnOffense: true,
  currentDriveNum: 0,
  quarter: 1,
  clockSecondsLeft: 900,
  inOvertime: false,
  overtimeCount: 0,
  awayTimeoutsRemaining: 3,
  homeTimeoutsRemaining: 2,
};

describe('GameSimHeader', () => {
  it('presents matchup, clock, timeouts, possession, and close action', () => {
    const markup = renderToStaticMarkup(
      <GameSimHeader matchup={matchup} isComplete={false} canClose onClose={vi.fn()} />,
    );

    expect(markup).toContain('#5 Alabama');
    expect(markup).toContain('#14 Oklahoma');
    expect(markup).toContain('0–0');
    expect(markup).toContain('Q1 · 15:00');
    expect(markup).toContain('aria-label="3 timeouts remaining"');
    expect(markup).toContain('aria-label="2 timeouts remaining"');
    expect(markup).toContain('alt="Possession"');
    expect(markup).toContain('aria-label="Close live simulation"');
  });

  it('shows a final state without live possession or timeout indicators', () => {
    const markup = renderToStaticMarkup(
      <GameSimHeader matchup={matchup} isComplete canClose onClose={vi.fn()} />,
    );

    expect(markup).toContain('Final');
    expect(markup).not.toContain('timeouts remaining');
    expect(markup).not.toContain('alt="Possession"');
  });
});
