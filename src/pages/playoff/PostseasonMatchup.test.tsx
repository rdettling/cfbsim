import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PlayoffMatchup } from '../../types/postseason';
import { PostseasonMatchup } from './PostseasonMatchup';

const matchup: PlayoffMatchup = {
  team1: 'Favorite State',
  team2: 'Underdog Tech',
  seed1: 5,
  seed2: 12,
  spread1: '-7',
  spread2: null,
  score1: null,
  score2: null,
  winner: null,
};

describe('PostseasonMatchup', () => {
  it('renders the spread beside only the favorite', () => {
    const markup = renderToStaticMarkup(
      <PostseasonMatchup
        matchup={matchup}
        onGameClick={vi.fn()}
        onTeamClick={vi.fn()}
      />,
    );

    expect(markup).toContain('Favorite State');
    expect(markup).toContain('-7');
    expect(markup).not.toContain('+7');
  });

  it('keeps a completed matchup focused on its final score', () => {
    const markup = renderToStaticMarkup(
      <PostseasonMatchup
        matchup={{
          ...matchup,
          score1: 31,
          score2: 24,
          winner: matchup.team1,
        }}
        onGameClick={vi.fn()}
        onTeamClick={vi.fn()}
      />,
    );

    expect(markup).not.toContain('-7');
    expect(markup).toContain('31');
    expect(markup).toContain('24');
  });
});
