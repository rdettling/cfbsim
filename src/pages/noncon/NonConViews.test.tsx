import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RivalryPlanWarning, ScheduleGame } from '../../types/domain';
import type { EligibleNonConOpponent } from '../../types/league';
import { NonConSchedulePanel } from './NonConSchedulePanel';
import { OpponentBrowser } from './OpponentBrowser';
import { PendingRivalriesPanel } from './PendingRivalriesPanel';

const openGame = (weekPlayed: number): ScheduleGame => ({
  weekPlayed,
  opponent: null,
  result: '',
  score: '',
  spread: '',
  moneyline: '',
  id: '',
  venue: null,
});

const scheduledGame: ScheduleGame = {
  ...openGame(2),
  id: '22',
  opponent: {
    name: 'West State',
    rating: 88,
    ranking: 9,
    record: '8-2',
  },
  label: 'State Trophy',
  location: 'Neutral',
  venue: 'Test Bowl',
};

const rivalryOpponent: EligibleNonConOpponent = {
  name: 'West State',
  conference: 'West',
  ranking: 9,
  record: '8-2',
  rating: 88,
  rivalry: { name: 'State Trophy' },
  site: {
    kind: 'fixed',
    location: 'Neutral',
    venue: 'Test Bowl',
  },
};

const ordinaryOpponent: EligibleNonConOpponent = {
  name: 'East Tech',
  conference: 'East',
  ranking: 0,
  record: '5-5',
  rating: 75,
  rivalry: null,
  site: { kind: 'selectable' },
};

const noOp = () => undefined;

describe('non-conference scheduling views', () => {
  it('renders compact selected, scheduled, and auto-fill schedule states', () => {
    const markup = renderToStaticMarkup(
      <NonConSchedulePanel
        schedule={[openGame(1), scheduledGame, openGame(3)]}
        remainingManualGames={1}
        selectedWeek={1}
        onSchedule={noOp}
        onTeamClick={noOp}
        onRemoveGame={noOp}
        removingItemKey={null}
      />,
    );

    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain('>Selected<');
    expect(markup).toContain('West State');
    expect(markup).toContain('State Trophy');
    expect(markup).toContain('Neutral · Test Bowl');
    expect(markup).toContain('>Remove<');
  });

  it('uses automatic-fill rows after manual capacity is exhausted', () => {
    const markup = renderToStaticMarkup(
      <NonConSchedulePanel
        schedule={[openGame(1)]}
        remainingManualGames={0}
        selectedWeek={null}
        onSchedule={noOp}
        onTeamClick={noOp}
        onRemoveGame={noOp}
        removingItemKey={null}
      />,
    );

    expect(markup).toContain('Automatic fill');
    expect(markup).toContain('Auto-fill');
    expect(markup).not.toContain('>Choose<');
  });

  it('filters opponent details by conference and shows resolved site context', () => {
    const markup = renderToStaticMarkup(
      <OpponentBrowser
        week={4}
        opponents={[
          rivalryOpponent,
          ordinaryOpponent,
        ]}
        query="West"
        loading={false}
        loadError={null}
        saveError={null}
        savingRequest={null}
        onQueryChange={noOp}
        onRetry={noOp}
        onSchedule={noOp}
      />,
    );

    expect(markup).not.toContain('Week 4 opponents');
    expect(markup).not.toContain('2 available');
    expect(markup).toContain('West State');
    expect(markup).toContain('West · 8-2 · 88 OVR');
    expect(markup).toContain('State Trophy · Neutral · Test Bowl');
    expect(markup).not.toContain('East Tech');
    expect(markup).toContain('>Schedule<');
  });

  it('shows separate home and away actions and the active saving action', () => {
    const available = renderToStaticMarkup(
      <OpponentBrowser
        week={4}
        opponents={[ordinaryOpponent]}
        query=""
        loading={false}
        loadError={null}
        saveError={null}
        savingRequest={null}
        onQueryChange={noOp}
        onRetry={noOp}
        onSchedule={noOp}
      />,
    );
    const savingAway = renderToStaticMarkup(
      <OpponentBrowser
        week={4}
        opponents={[ordinaryOpponent]}
        query=""
        loading={false}
        loadError={null}
        saveError={null}
        savingRequest={{
          opponentName: ordinaryOpponent.name,
          site: { kind: 'manual', location: 'Away' },
        }}
        onQueryChange={noOp}
        onRetry={noOp}
        onSchedule={noOp}
      />,
    );

    expect(available).not.toContain('Choose Home or Away');
    expect(available).toContain('>Home<');
    expect(available).toContain('>Away<');
    expect(savingAway).toContain('>Home<');
    expect(savingAway).toContain('>Scheduling…<');
  });

  it('renders fixed no-selection, retryable error, and save-error states', () => {
    const noSelection = renderToStaticMarkup(
      <OpponentBrowser
        week={null}
        opponents={[]}
        query=""
        loading={false}
        loadError={null}
        saveError={null}
        savingRequest={null}
        onQueryChange={noOp}
        onRetry={noOp}
        onSchedule={noOp}
      />,
    );
    const failed = renderToStaticMarkup(
      <OpponentBrowser
        week={5}
        opponents={[]}
        query=""
        loading={false}
        loadError="Candidates failed"
        saveError="Scheduling failed"
        savingRequest={null}
        onQueryChange={noOp}
        onRetry={noOp}
        onSchedule={noOp}
      />,
    );

    expect(noSelection).toContain('Choose an open week');
    expect(failed).toContain('Candidates failed');
    expect(failed).toContain('>Retry<');
    expect(failed).toContain('Scheduling failed');
  });

  it('shows rivalry warnings, site status, and an explicit decline action', () => {
    const warning: RivalryPlanWarning = {
      code: 'omitted_rivalry',
      teamA: 'East State',
      teamB: 'West State',
      name: 'State Trophy',
      message: 'This rivalry cannot be guaranteed.',
    };
    const markup = renderToStaticMarkup(
      <PendingRivalriesPanel
        userTeam="East State"
        rivalries={[{
          id: 1,
          teamA: 'East State',
          teamB: 'West State',
          name: 'State Trophy',
          homeTeam: 'West State',
          awayTeam: 'East State',
          neutralSite: false,
          venue: null,
        }]}
        warnings={[warning]}
        onTeamClick={noOp}
        onRemove={noOp}
        removingItemKey={null}
      />,
    );

    expect(markup).toContain('This rivalry cannot be guaranteed.');
    expect(markup).toContain('West State logo');
    expect(markup.indexOf('West State')).toBeLessThan(markup.indexOf('State Trophy'));
    expect(markup).toContain('Week TBD · Away');
    expect(markup).toContain('>Decline<');
  });
});
