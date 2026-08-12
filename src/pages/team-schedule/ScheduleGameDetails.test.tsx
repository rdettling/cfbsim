import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { TeamScheduleGameRow } from '../../types/scheduleTypes';
import {
  ScheduleGameAction,
  ScheduleOpponent,
} from './ScheduleGameDetails';

const historicalGame = (
  overrides: Partial<TeamScheduleGameRow> = {},
): TeamScheduleGameRow => ({
  kind: 'game',
  source: 'historical',
  rowKey: 'historical:101',
  weekPlayed: 1,
  opponent: {
    name: 'Other State',
    rating: null,
    ranking: 12,
    record: null,
    canOpen: true,
  },
  result: 'W',
  score: '31-17',
  spread: null,
  moneyline: null,
  gameId: null,
  location: 'Home',
  venue: 'Historic Stadium',
  label: 'Conference: Test',
  ...overrides,
});

describe('historical schedule presentation', () => {
  it('renders a completed historical result without a game-detail link', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ScheduleGameAction game={historicalGame()} />
      </MemoryRouter>,
    );

    expect(markup).toContain('W 31-17');
    expect(markup).not.toContain('href="/game/');
  });

  it('retains game-detail links for simulated games', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ScheduleGameAction
          game={historicalGame({ source: 'simulated', gameId: '42' })}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('href="/game/42"');
  });

  it('renders unsupported opponents without an interactive team control', () => {
    const game = historicalGame({
      opponent: {
        name: 'Lower College',
        rating: null,
        ranking: 0,
        record: null,
        canOpen: false,
      },
    });
    const markup = renderToStaticMarkup(
      <ScheduleOpponent game={game} onClick={vi.fn()} />,
    );

    expect(markup).toContain('Lower College');
    expect(markup).not.toContain('View Lower College team information');
    expect(markup).not.toContain('Rating');
  });
});
