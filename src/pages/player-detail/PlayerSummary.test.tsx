import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTestPlayer } from '../../test/fixtures';
import { PlayerSummary } from './PlayerSummary';

const player = {
  ...buildTestPlayer({ rating: 91, stars: 4, development_trait: 4 }),
  team: 'Test State',
};

const renderSummary = (options: {
  awards?: Array<{ slug: string; name: string }>;
  starter?: boolean;
} = {}) =>
  renderToStaticMarkup(
    <PlayerSummary
      player={{ ...player, starter: options.starter ?? true }}
      awards={options.awards ?? []}
      origin={{
        playerId: 1,
        acquisitionYear: 2027,
        originalTeamId: 2,
        originalTeam: 'Original University',
        kind: 'initial_roster',
        classAtStart: 'so',
      }}
      teamColor="#123456"
      onTeamClick={() => undefined}
    />,
  );

describe('PlayerSummary', () => {
  it('composes identity, starter status, ratings, OVR, and no awards rail', () => {
    const markup = renderSummary();

    expect(markup).toContain(`${player.first} ${player.last}`);
    expect(markup).toContain('Test State');
    expect(markup).toContain('Starter');
    expect(markup).toContain('aria-label="Recruiting 4 out of 5"');
    expect(markup).toContain('aria-label="Development 4 out of 5"');
    expect(markup).toContain('aria-label="Overall rating 91"');
    expect(markup).toContain('>OVR<');
    expect(markup).toContain('aria-labelledby="player-name-heading"');
    expect(markup).not.toContain('aria-label="Player awards"');
  });

  it('shows backup status and a single award', () => {
    const markup = renderSummary({
      starter: false,
      awards: [{ slug: 'maxwell', name: 'Maxwell Award' }],
    });

    expect(markup).toContain('Backup');
    expect(markup).toContain('aria-label="Player awards"');
    expect(markup).toContain('Maxwell Award');
  });

  it('shows multiple awards in one labeled rail', () => {
    const markup = renderSummary({
      awards: [
        { slug: 'heisman', name: 'Heisman Trophy' },
        { slug: 'maxwell', name: 'Maxwell Award' },
      ],
    });

    expect(markup).toContain('aria-label="Player awards"');
    expect(markup).toContain('Heisman Trophy');
    expect(markup).toContain('Maxwell Award');
  });
});
