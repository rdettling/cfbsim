import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerPageData } from '../../types/pages';
import { PlayerOriginSummary } from './PlayerOriginSummary';

const originBase = {
  playerId: 1,
  acquisitionYear: 2027,
  originalTeamId: 2,
  originalTeam: 'Original University',
};

const renderOrigin = (origin: PlayerPageData['origin']) =>
  renderToStaticMarkup(
    <PlayerOriginSummary origin={origin} onTeamClick={() => undefined} />,
  );

const expectTeamLink = (markup: string) => {
  expect(markup).toMatch(/<button[^>]*>Original University<\/button>/);
};

describe('PlayerOriginSummary', () => {
  it('shows every recruit-origin field and commitment label', () => {
    const markup = renderOrigin({
      ...originBase,
      kind: 'recruit',
      homeState: 'TX',
      nationalRank: 18,
      positionRank: 3,
      commitmentRound: 'signing_day',
      publicRatingMin: 84,
      publicRatingMax: 89,
    });

    expect(markup).toContain('2027 recruiting class');
    expect(markup).toContain('#18 national');
    expect(markup).toContain('#3 at position');
    expect(markup).toContain('From TX');
    expect(markup).toContain('Signed with');
    expect(markup).toContain('Signing Day');
    expect(markup).toContain('Public scouting range');
    expect(markup).toContain('84–89');
    expectTeamLink(markup);

    const roundMarkup = renderOrigin({
      ...originBase,
      kind: 'recruit',
      homeState: 'TX',
      nationalRank: 18,
      positionRank: 3,
      commitmentRound: 3,
      publicRatingMin: 84,
      publicRatingMax: 89,
    });
    expect(roundMarkup).toContain('Round 3');
  });

  it('shows every walk-on origin field', () => {
    const markup = renderOrigin({ ...originBase, kind: 'walk_on' });

    expect(markup).toContain('Walk-on');
    expect(markup).toContain('Joined');
    expect(markup).toContain('2027');
    expectTeamLink(markup);
  });

  it('shows every initial-roster origin field', () => {
    const markup = renderOrigin({
      ...originBase,
      kind: 'initial_roster',
      classAtStart: 'so',
    });

    expect(markup).toContain('Initial dynasty roster');
    expect(markup).toContain('Sophomore at');
    expect(markup).toContain('2027');
    expectTeamLink(markup);
  });

  it('shows every program-entry origin field', () => {
    const markup = renderOrigin({
      ...originBase,
      kind: 'program_entry',
      classAtEntry: 'jr',
    });

    expect(markup).toContain('Program entry roster');
    expect(markup).toContain('Junior when');
    expect(markup).toContain('joined in');
    expect(markup).toContain('2027');
    expectTeamLink(markup);
  });
});
