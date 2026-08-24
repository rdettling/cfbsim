import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import type { StandingsPageData } from '../../types/pages';
import { StandingsCommandBar } from './StandingsCommandBar';
import { StandingsDesktopTable } from './StandingsDesktopTable';
import { StandingsMobileList } from './StandingsMobileList';

const alpha = buildTestTeam({ id: 1, name: 'Alpha', abbreviation: 'ALP' });
const beta = buildTestTeam({ id: 2, name: 'Beta', abbreviation: 'BET' });
const conference = {
  ...buildTestLeague('season').conferences[0],
  teams: [alpha, beta],
};
const standingTeam: StandingsPageData['teams'][number] = {
  ...alpha,
  totalWins: 9,
  totalLosses: 1,
  confWins: 7,
  confLosses: 1,
  tiebreaker: 'head_to_head',
  last_game: null,
  next_game: null,
};

describe('standings presentation', () => {
  it('exposes the full tiebreak label in the desktop view', () => {
    const desktop = renderToStaticMarkup(
      <StandingsDesktopTable
        teams={[standingTeam]}
        isIndependent={false}
        onTeamClick={vi.fn()}
      />,
    );
    expect(desktop).toContain('H2H');
    expect(desktop).toContain('aria-label="Tiebreak: Head-to-head"');
    expect(desktop).not.toContain(`>${standingTeam.confName}<`);
  });

  it('shows only position, team, overall record, and conference record in each mobile row', () => {
    const mobile = renderToStaticMarkup(
      <StandingsMobileList
        teams={[standingTeam]}
        isIndependent={false}
        onTeamClick={vi.fn()}
      />,
    );

    expect(mobile).toContain('aria-label="Conference rank 1"');
    expect(mobile).toContain('aria-label="Overall record 9-1"');
    expect(mobile).toContain('aria-label="Conference record 7-1"');
    expect(mobile).not.toContain('Tiebreak');
    expect(mobile).not.toContain('Last week');
    expect(mobile).not.toContain('This week');
  });

  it('renders projected, scheduled, and completed championship states distinctly', () => {
    const projected: NonNullable<StandingsPageData['championship']> = {
      status: 'projected',
      gameId: null,
      teamA: alpha,
      teamB: beta,
      winnerId: null,
      scoreA: null,
      scoreB: null,
      spreadA: '-4.5',
      spreadB: '+4.5',
    };
    const complete: NonNullable<StandingsPageData['championship']> = {
      ...projected,
      status: 'complete',
      gameId: 10,
      winnerId: alpha.id,
      scoreA: 24,
      scoreB: 17,
    };
    const scheduled: NonNullable<StandingsPageData['championship']> = {
      ...projected,
      status: 'scheduled',
      gameId: 10,
    };

    const data = (championship: NonNullable<StandingsPageData['championship']>): StandingsPageData => ({
      info: buildTestLeague('season').info,
      playoffTeams: buildTestLeague('season').settings.playoffTeams,
      team: alpha,
      conference: 'Test Conference',
      teams: [standingTeam, { ...standingTeam, ...beta, tiebreaker: null }],
      championship,
      conferences: [conference],
    });
    const projectedMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <StandingsCommandBar
          data={data(projected)}
          onConferenceChange={vi.fn()}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );
    const completeMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <StandingsCommandBar
          data={data(complete)}
          onConferenceChange={vi.fn()}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );
    const scheduledMarkup = renderToStaticMarkup(
      <MemoryRouter>
        <StandingsCommandBar
          data={data(scheduled)}
          onConferenceChange={vi.fn()}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(projectedMarkup).toContain('Test Conference Standings');
    expect(projectedMarkup).toContain('Projected CCG');
    expect(projectedMarkup).toContain('Current standings · Neutral site');
    expect(projectedMarkup).toContain('−4.5');
    expect(projectedMarkup).toContain('aria-label="Alpha favored by 4.5 points on a neutral field"');
    expect(projectedMarkup).toContain('aria-label="Select conference standings"');
    expect(projectedMarkup).not.toContain('>Game<');
    expect(scheduledMarkup).toContain('Week 15 CCG');
    expect(scheduledMarkup).toContain('Scheduled · Neutral site');
    expect(scheduledMarkup).toContain('−4.5');
    expect(scheduledMarkup).toContain('>Game<');
    expect(scheduledMarkup).not.toContain('Champion');
    expect(completeMarkup).toContain('Champion');
    expect(completeMarkup).toContain('CCG Final');
    expect(completeMarkup).toContain('>Game<');
  });

  it('renders an independent command bar without a championship region', () => {
    const independent = buildTestTeam({
      ...alpha,
      conference: 'Independent',
      confName: 'Independent',
    });
    const data: StandingsPageData = {
      info: buildTestLeague('season').info,
      playoffTeams: buildTestLeague('season').settings.playoffTeams,
      team: independent,
      conference: 'Independent',
      teams: [{ ...standingTeam, ...independent, tiebreaker: null }],
      championship: null,
      conferences: [conference],
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <StandingsCommandBar
          data={data}
          onConferenceChange={vi.fn()}
          onTeamClick={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain('Independent Standings');
    expect(markup).not.toContain('aria-label="Conference championship"');
  });
});
