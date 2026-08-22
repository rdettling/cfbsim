import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import { PreviousMatchupsPanel } from './PreviousMatchupsPanel';

describe('PreviousMatchupsPanel', () => {
  it('shows the prior game away-left and home-right and links to the result', () => {
    const teamA = buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP' });
    const teamB = buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET' });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PreviousMatchupsPanel
          teamA={teamA}
          teamB={teamB}
          series={{ teamAWins: 3, teamBWins: 2, ties: 0 }}
          matchups={[{
            rowKey: 'simulated:44',
            source: 'simulated',
            gameId: 44,
            year: 2025,
            week: 8,
            label: 'Rivalry Game',
            site: 'teamA-home',
            teamAScore: 27,
            teamBScore: 24,
            winnerSide: 'teamA',
          }]}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Previous Matchups');
    expect(markup).toContain('Series · Alpha 3–2');
    expect(markup).toContain('2025 · Week 8');
    expect(markup).toContain('src="/logos/teams/Beta.png"');
    expect(markup).toContain('src="/logos/teams/Alpha.png"');
    expect(markup).toContain('Beta');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('>@<');
    expect(markup).toContain('away Beta 24 at home Alpha 27');
    expect(markup).toContain('href="/game/44"');
  });

  it('uses vs for a neutral historical meeting without linking to a game page', () => {
    const teamA = buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP' });
    const teamB = buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET' });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PreviousMatchupsPanel
          teamA={teamA}
          teamB={teamB}
          series={{ teamAWins: 0, teamBWins: 1, ties: 0 }}
          matchups={[{
            rowKey: 'historical:100',
            source: 'historical',
            gameId: null,
            year: 2024,
            week: 3,
            label: 'Historical Matchup',
            site: 'neutral',
            teamAScore: 21,
            teamBScore: 24,
            winnerSide: 'teamB',
          }]}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('2024 · Week 3');
    expect(markup).toContain('Historical Matchup');
    expect(markup).toContain('>vs<');
    expect(markup).toContain('Alpha 21 versus Beta 24, neutral site');
    expect(markup).not.toContain('href="/game/');
  });

  it('renders nothing when the teams have no prior meetings', () => {
    const teamA = buildTestTeam({ id: 1 });
    const teamB = buildTestTeam({ id: 2 });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PreviousMatchupsPanel
          teamA={teamA}
          teamB={teamB}
          series={{ teamAWins: 0, teamBWins: 0, ties: 0 }}
          matchups={[]}
        />
      </MemoryRouter>,
    );

    expect(markup).toBe('');
  });
});
