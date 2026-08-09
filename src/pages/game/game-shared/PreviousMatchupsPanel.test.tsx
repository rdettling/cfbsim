import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../../test/fixtures';
import { PreviousMatchupsPanel } from './PreviousMatchupsPanel';

describe('PreviousMatchupsPanel', () => {
  it('shows recent meetings in the current away-home order and links to the result', () => {
    const teamA = buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP' });
    const teamB = buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET' });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PreviousMatchupsPanel
          teamA={teamA}
          teamB={teamB}
          awayTeamId={teamB.id}
          matchups={[{
            id: 44,
            year: 2025,
            week: 8,
            label: 'Rivalry Game',
            teamAScore: 27,
            teamBScore: 24,
            winnerId: teamA.id,
          }]}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Previous Matchups');
    expect(markup).toContain('2025 · Week 8');
    expect(markup).toContain('BET');
    expect(markup).toContain('ALP');
    expect(markup).toContain('href="/game/44"');
  });

  it('renders nothing when the teams have no prior meetings', () => {
    const teamA = buildTestTeam({ id: 1 });
    const teamB = buildTestTeam({ id: 2 });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PreviousMatchupsPanel
          teamA={teamA}
          teamB={teamB}
          awayTeamId={teamA.id}
          matchups={[]}
        />
      </MemoryRouter>,
    );

    expect(markup).toBe('');
  });
});
