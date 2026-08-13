import useMediaQuery from '@mui/material/useMediaQuery';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameSimWorkspace from './GameSimWorkspace';

vi.mock('@mui/material/useMediaQuery', () => ({ default: vi.fn() }));

const baseProps = {
  onViewChange: vi.fn(),
  field: <div>Field graphic</div>,
  drives: <div>Drive history</div>,
  coachPanel: <div>Coach panel</div>,
  situationLabel: '1st & 10 at OWN 25',
  driveNumber: 1,
  lastPlayText: '',
};

describe('GameSimWorkspace', () => {
  beforeEach(() => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
  });

  it('shows the mobile tabs and opening Field panel state', () => {
    const markup = renderToStaticMarkup(
      <GameSimWorkspace {...baseProps} activeView="field" />,
    );

    expect(markup).toContain('aria-label="Live simulation views"');
    expect(markup).toContain(
      'id="live-sim-field-panel" role="tabpanel" aria-labelledby="live-sim-field-tab"',
    );
    expect(markup).toContain(
      'id="live-sim-drives-panel" role="tabpanel" aria-labelledby="live-sim-drives-tab" hidden=""',
    );
    expect(markup).toContain('Field graphic');
    expect(markup).toContain('aria-label="Current game status"');
    expect(markup).toContain('1st &amp; 10 at OWN 25');
    expect(markup).toContain('Previous play:');
    expect(markup).toContain('No plays yet');
    expect(markup).toContain('Drive 1');
    expect(markup).toContain('Coach panel');
  });

  it('shows the current situation and previous play in the compact field status box', () => {
    const markup = renderToStaticMarkup(
      <GameSimWorkspace
        {...baseProps}
        activeView="field"
        situationLabel="3rd & 4 at OPP 36"
        driveNumber={3}
        lastPlayText="Seven-yard completion"
      />,
    );

    expect(markup).toContain('3rd &amp; 4 at OPP 36');
    expect(markup).toContain('Previous play:');
    expect(markup).toContain('Seven-yard completion');
    expect(markup).toContain('Drive 3');
  });

  it('selects the mobile Drives panel without showing the Field panel', () => {
    const markup = renderToStaticMarkup(
      <GameSimWorkspace {...baseProps} activeView="drives" lastPlayText="Four-yard run" />,
    );

    expect(markup).toContain(
      'id="live-sim-field-panel" role="tabpanel" aria-labelledby="live-sim-field-tab" hidden=""',
    );
    expect(markup).toContain(
      'id="live-sim-drives-panel" role="tabpanel" aria-labelledby="live-sim-drives-tab"',
    );
    expect(markup).toContain('aria-label="Drive history" tabindex="0"');
    expect(markup).toContain('Drive history');
    expect(markup).toContain('aria-label="Coaching controls"');
    expect(markup).toContain('display:none');
  });

  it('shows Field, Drives, and controls together without desktop tabs', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    const markup = renderToStaticMarkup(
      <GameSimWorkspace {...baseProps} activeView="field" />,
    );

    expect(markup).not.toContain('aria-label="Live simulation views"');
    expect(markup).toContain('id="live-sim-field-panel" role="region" aria-label="Field"');
    expect(markup).toContain('id="live-sim-drives-panel" role="region" aria-label="Drives"');
    expect(markup).toContain('Field graphic');
    expect(markup).toContain('Drive history');
    expect(markup).toContain('Coach panel');
    expect(markup).toContain('<h2');
    expect(markup).toContain('>Drives</h2>');
    expect(markup).not.toContain('hidden=""');
  });

  it('keeps the empty drive state inside the labeled desktop rail', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    const markup = renderToStaticMarkup(
      <GameSimWorkspace
        {...baseProps}
        activeView="field"
        drives={<div>No drives yet</div>}
      />,
    );

    expect(markup).toContain('role="region" aria-label="Drives"');
    expect(markup).toContain('No drives yet');
  });

  it('shows narrow controls only with Field, except for completed-game actions', () => {
    const fieldMarkup = renderToStaticMarkup(
      <GameSimWorkspace {...baseProps} activeView="field" />,
    );
    expect(fieldMarkup).toContain('display:block');

    const drivesMarkup = renderToStaticMarkup(
      <GameSimWorkspace {...baseProps} activeView="drives" />,
    );
    expect(drivesMarkup).toContain('display:none');

    const completedMarkup = renderToStaticMarkup(
      <GameSimWorkspace {...baseProps} activeView="drives" showCoachPanelOnDrives />,
    );
    expect(completedMarkup).toContain('display:block');
  });
});
