import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import { GameContextPanel } from './GameContextPanel';

const awayTeam = buildTestTeam({ id: 1, name: 'Away State', abbreviation: 'AWY' });
const homeTeam = buildTestTeam({ id: 2, name: 'Home Tech', abbreviation: 'HME' });
const odds = {
  awaySide: { spread: '+3.5', moneyline: '+140', winProb: 0.42 },
  homeSide: { spread: '-3.5', moneyline: '-160', winProb: 0.58 },
};

describe('GameContextPanel', () => {
  it('labels completed-game lines as pregame odds', () => {
    const markup = renderToStaticMarkup(
      <GameContextPanel
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        {...odds}
        completed
      />,
    );

    expect(markup).toContain('Pregame odds');
    expect(markup).not.toContain('Dynasty context');
  });

  it('shows matchup odds without a separate dynasty context section', () => {
    const markup = renderToStaticMarkup(
      <GameContextPanel
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        {...odds}
        completed={false}
      />,
    );

    expect(markup).toContain('Matchup odds');
    expect(markup).not.toContain('Dynasty context');
    expect(markup).not.toContain('Last meeting');
  });
});
