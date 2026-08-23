import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerStarRating } from './PlayerStarRating';

describe('PlayerStarRating', () => {
  it('renders an accessible five-slot meter', () => {
    const markup = renderToStaticMarkup(
      <PlayerStarRating label="Recruiting" value={4} />,
    );

    expect(markup).toContain('aria-label="Recruiting 4 out of 5"');
    expect(markup.match(/src="\/logos\/star\.png"/g)).toHaveLength(5);
  });

  it('clamps values to the supported zero-to-five range', () => {
    const markup = renderToStaticMarkup(
      <>
        <PlayerStarRating label="High" value={8} />
        <PlayerStarRating label="Low" value={-2} />
      </>,
    );

    expect(markup).toContain('aria-label="High 5 out of 5"');
    expect(markup).toContain('aria-label="Low 0 out of 5"');
  });
});
