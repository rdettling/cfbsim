import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import GameMatchupHeader from './GameMatchupHeader';

const away = buildTestTeam({ id: 1, name: 'Away State', record: '8-2' });
const home = buildTestTeam({ id: 2, name: 'Home Tech', record: '9-1' });
const game = {
  label: 'Rivalry Game',
  weekPlayed: 12,
  year: 2026,
  venue: null,
};

describe('GameMatchupHeader', () => {
  it('uses the shared scheduled masthead for a preview', () => {
    const markup = renderToStaticMarkup(
      <GameMatchupHeader
        game={game}
        away={{ team: away, rank: 12 }}
        home={{ team: home, rank: 4 }}
        neutral={false}
        mode="preview"
        onTeamClick={() => undefined}
      />,
    );

    expect(markup).toContain('Scheduled');
    expect(markup).toContain('Away State');
    expect(markup).toContain('Home Tech');
    expect(markup).toContain('Rivalry Game');
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it('shows overtime, scores, and stronger winner typography for a result', () => {
    const markup = renderToStaticMarkup(
      <GameMatchupHeader
        game={game}
        away={{ team: away, rank: 12, score: 31, winner: true }}
        home={{ team: home, rank: 4, score: 28, winner: false }}
        neutral={false}
        mode="result"
        overtime={2}
        onTeamClick={() => undefined}
      />,
    );

    expect(markup).toContain('Final · 2OT');
    expect(markup).toContain('aria-label="Away State score 31"');
    expect(markup).toContain('aria-label="Home Tech score 28"');
    expect(markup).toContain('font-weight:800');
  });

  it('keeps regulation status and long team names in the compact identity rows', () => {
    const longAway = buildTestTeam({
      id: 3,
      name: 'A Very Long University Team Name',
      record: '10-1',
    });
    const markup = renderToStaticMarkup(
      <GameMatchupHeader
        game={game}
        away={{ team: longAway, rank: 1, score: 42, winner: true }}
        home={{ team: home, rank: 4, score: 17, winner: false }}
        neutral={false}
        mode="result"
        overtime={0}
        onTeamClick={() => undefined}
      />,
    );

    expect(markup).toContain('>Final<');
    expect(markup).toContain('A Very Long University Team Name');
    expect(markup).toContain('text-overflow:ellipsis');
  });
});
