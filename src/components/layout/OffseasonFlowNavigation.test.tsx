import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  OffseasonFlowDesktop,
  OffseasonFlowMobile,
} from './OffseasonFlowNavigation';
import type { OffseasonCalendarModel } from './leagueCalendar';
import { buildOffseasonFlowModel } from './leagueCalendar';

const calendar: OffseasonCalendarModel = {
  kind: 'offseason',
  year: 2027,
  currentStage: 'recruiting',
  currentPosition: 3,
  steps: buildOffseasonFlowModel('recruiting'),
};

const baseProps = {
  calendar,
  advancing: false,
  disabled: false,
  onSelectStage: vi.fn(),
  onStartSeason: vi.fn(),
};

describe('OffseasonFlowNavigation', () => {
  it('renders every desktop stage and the destination-season action', () => {
    const markup = renderToStaticMarkup(
      <OffseasonFlowDesktop {...baseProps} />,
    );

    expect(markup).toContain('aria-label="Offseason stages"');
    expect(markup).toContain('aria-label="Recruiting"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('aria-label="Sim to Results"');
    expect(markup).toContain('aria-label="Sim to Scheduling"');
    expect(markup).toContain('Start 2027 Season');
  });

  it('renders the compact mobile summary and stage-drawer trigger', () => {
    const markup = renderToStaticMarkup(
      <OffseasonFlowMobile {...baseProps} />,
    );

    expect(markup).toContain('2027 Offseason · 4 of 7');
    expect(markup).toContain('Recruiting');
    expect(markup).toContain('View stages');
    expect(markup).toContain('Start 2027 Season');
  });
});
