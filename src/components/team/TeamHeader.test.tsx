import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { TeamHeader } from './TeamHeader';

describe('TeamHeader season metrics', () => {
  it('uses season-specific metadata and omits an unavailable rating', () => {
    const markup = renderToStaticMarkup(
      <TeamHeader
        team={buildTestTeam()}
        metrics={{
          record: '9-4',
          rating: null,
          prestige: 5,
          ranking: 8,
          conference: 'Historic Conference',
        }}
      />,
    );

    expect(markup).toContain('#8 Test State Testers');
    expect(markup).toContain('9-4');
    expect(markup).toContain('Historic Conference');
    expect(markup).not.toContain('Rating');
  });
});
