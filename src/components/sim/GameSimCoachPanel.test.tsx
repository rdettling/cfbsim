import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GameSimCoachPanel from './GameSimCoachPanel';

const prompt = {
  side: 'offense' as const,
  type: 'scrimmage' as const,
  down: 2,
  yardsLeft: 6,
  fieldPosition: 42,
};

const baseProps = {
  phase: 'ready' as const,
  coachingEnabled: true,
  isGameComplete: false,
  decisionPrompt: prompt,
  onAdvance: vi.fn(),
  onDecision: vi.fn(),
  managementSide: 'offense' as const,
  selectedTempo: 'auto' as const,
  timeoutAfterPlay: false,
  canUseTimeout: true,
  canShowSpike: false,
  canShowKneel: false,
  onTempoChange: vi.fn(),
  onTimeoutChange: vi.fn(),
  onClose: vi.fn(),
  onViewGameSummary: vi.fn(),
};

describe('GameSimCoachPanel', () => {
  it('shows every offensive concept as an equal one-tap call', () => {
    const markup = renderToStaticMarkup(<GameSimCoachPanel {...baseProps} />);

    for (const label of [
      'Inside',
      'Outside',
      'Option',
      'Quick',
      'Intermediate',
      'Deep',
      'Screen',
      'Play Action',
    ]) expect(markup).toContain(label);
    expect(markup).not.toContain('2nd &amp; 6 · Own 42');
    expect(markup).toContain('aria-label="Current decision"');
    expect(markup).toContain('aria-label="Run play calls"');
    expect(markup).toContain('aria-label="Pass play calls"');
    expect(markup).toContain('aria-label="Game management"');
    expect(markup).not.toContain('>Game management<');
    expect(markup).toContain('aria-label="Simulation shortcuts"');
    expect(markup).toContain('aria-label="Simulation shortcut actions"');
    expect(markup).not.toContain('Call the next play');
    expect(markup).not.toContain('Let the simulator handle the selected scope.');
    expect(markup).not.toContain('Punt');
    expect(markup).toContain('Field Goal');
  });

  it('adds punts on fourth down while retaining the field-goal call', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel
        {...baseProps}
        decisionPrompt={{ ...prompt, down: 4 }}
      />,
    );

    expect(markup).toContain('Punt');
    expect(markup).toContain('Field Goal');
  });

  it('shows blind defensive intents without offensive concepts', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel
        {...baseProps}
        decisionPrompt={{ ...prompt, side: 'defense' }}
        managementSide="defense"
      />,
    );

    for (const label of ['Base', 'Loaded Box', 'Coverage', 'Pressure']) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain('Set the defensive intent');
    expect(markup).not.toContain('Play Action');
    expect(markup).not.toContain('Tempo');
  });

  it('shows kick and two-point concepts for an optional offensive try', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel
        {...baseProps}
        decisionPrompt={{ ...prompt, type: 'try', allowExtraPoint: true }}
        managementSide={null}
      />,
    );

    expect(markup).toContain('Kick Extra Point');
    expect(markup).toContain('Inside');
    expect(markup).toContain('Deep');
    expect(markup).not.toContain('Choose the try');
    expect(markup).not.toContain('Untimed down from the 3-yard line');
    expect(markup).not.toContain('Game management');
  });

  it('keeps management available when no defensive call is required', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel
        {...baseProps}
        decisionPrompt={null}
        managementSide="defense"
      />,
    );

    expect(markup).toContain('No call required');
    expect(markup).toContain('Timeout after play');
    expect(markup).not.toContain('The simulator is resolving this situation automatically.');
  });

  it('shows applicable spike and kneel controls with offensive tempo', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel
        {...baseProps}
        canShowSpike
        canShowKneel
      />,
    );

    expect(markup).toContain('aria-label="Offensive tempo"');
    expect(markup).toContain('aria-label="Clock action calls"');
    expect(markup).toContain('Spike');
    expect(markup).toContain('Kneel');
  });

  it('keeps calls mounted and disabled while advancing', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel {...baseProps} phase="advancing" />,
    );

    expect(markup).not.toContain('Call the next play');
    expect(markup).toContain('Inside');
    expect(markup).toContain('Simulating…');
    expect(markup).toContain('disabled');
  });

  it('announces finalization without restoring idle guidance', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel {...baseProps} phase="finalizing" />,
    );

    expect(markup).toContain('Saving final result…');
    expect(markup).not.toContain('Let the simulator handle the selected scope.');
  });

  it('shows only automatic controls for watch-only games', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel
        {...baseProps}
        coachingEnabled={false}
        decisionPrompt={null}
        managementSide={null}
      />,
    );

    expect(markup).toContain('Simulation controls');
    expect(markup).toContain('Sim Play');
    expect(markup).toContain('aria-label="Simulation shortcuts"');
    expect(markup).not.toContain('Call the next play');
    expect(markup).not.toContain('Game management');
    expect(markup).not.toContain('Choose how much of the game to simulate.');
  });

  it('preserves the stacked mobile section order in the shared markup', () => {
    const markup = renderToStaticMarkup(<GameSimCoachPanel {...baseProps} />);

    expect(markup.indexOf('aria-label="Current decision"')).toBeLessThan(
      markup.indexOf('aria-label="Game management"'),
    );
    expect(markup.indexOf('aria-label="Game management"')).toBeLessThan(
      markup.indexOf('aria-label="Simulation shortcuts"'),
    );
  });

  it('replaces inactive commands with the completed-game summary', () => {
    const markup = renderToStaticMarkup(
      <GameSimCoachPanel {...baseProps} phase="complete" isGameComplete />,
    );

    expect(markup).toContain('Game complete');
    expect(markup).toContain('The final result and game detail have been saved.');
    expect(markup).toContain('Game Summary');
    expect(markup).toContain('Close');
    expect(markup).not.toContain('Sim Play');
    expect(markup).not.toContain('Inside');
  });
});
