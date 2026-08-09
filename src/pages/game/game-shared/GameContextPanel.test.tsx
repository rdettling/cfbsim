import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
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
      <MemoryRouter>
        <GameContextPanel
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          {...odds}
          dynastyContext={null}
          completed
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Pregame odds');
    expect(markup).not.toContain('Dynasty context');
  });

  it('includes optional dynasty series context and the last-meeting link', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <GameContextPanel
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          {...odds}
          completed={false}
          dynastyContext={{
            wins: 3,
            losses: 2,
            streak: 'Away State 2',
            callback: 'The rivalry resumes.',
            lastMeeting: {
              id: 44,
              year: 2025,
              opponent: 'Home Tech',
              result: 'W',
              score: '27-24',
              label: 'W 27-24 vs Home Tech',
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Matchup odds');
    expect(markup).toContain('Dynasty context');
    expect(markup).toContain('Series 3-2');
    expect(markup).toContain('href="/game/44"');
  });
});
