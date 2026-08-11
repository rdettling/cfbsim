import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GameControls from './GameControls';

const prompt = {
  side: 'offense' as const,
  type: 'scrimmage' as const,
  down: 2,
  yardsLeft: 6,
  fieldPosition: 42,
};

const managementProps = {
  managementSide: 'offense' as const,
  selectedTempo: 'auto' as const,
  timeoutAfterPlay: false,
  canUseTimeout: true,
  canShowSpike: false,
  canShowKneel: false,
  onTempoChange: vi.fn(),
  onTimeoutChange: vi.fn(),
};

describe('GameControls', () => {
  it('shows every offensive concept in compact run and pass groups', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        phase="ready"
        decisionPrompt={prompt}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

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
    expect(markup).not.toContain('Punt');
    expect(markup).not.toContain('Field Goal');
  });

  it('adds special-teams calls only for fourth down', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        phase="ready"
        decisionPrompt={{ ...prompt, type: 'fourth_down', down: 4 }}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

    expect(markup).toContain('Punt');
    expect(markup).toContain('Field Goal');
  });

  it('shows defensive intents without revealing an offensive concept', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        phase="ready"
        decisionPrompt={{ ...prompt, side: 'defense' }}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

    for (const label of ['Base', 'Loaded Box', 'Coverage', 'Pressure']) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain('Play Action');
    expect(markup).not.toContain('Punt');
  });

  it('shows kick and two-point concepts for an optional offensive try', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        phase="ready"
        decisionPrompt={{ ...prompt, type: 'try', allowExtraPoint: true }}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

    expect(markup).toContain('Kick');
    expect(markup).toContain('Inside');
    expect(markup).toContain('Deep');
    expect(markup).toContain('Untimed down from the 3-yard line');
    expect(markup).not.toContain('Tempo');
  });

  it('hides kick and reveals only defensive intent for a mandatory try', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        managementSide={null}
        phase="ready"
        decisionPrompt={{
          ...prompt,
          type: 'try',
          side: 'defense',
          allowExtraPoint: false,
        }}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

    expect(markup).not.toContain('Kick');
    expect(markup).toContain('Defend the two-point try');
    expect(markup).toContain('Coverage');
    expect(markup).not.toContain('Play Action');
  });

  it('hides calls and disables automatic controls while advancing', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        phase="advancing"
        decisionPrompt={prompt}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

    expect(markup).not.toContain('Call the next play');
    expect(markup).toContain('disabled');
    expect(markup).toContain('Simulating');
  });

  it('shows persistent tempo, timeout intent, and contextual clock actions', () => {
    const markup = renderToStaticMarkup(
      <GameControls
        {...managementProps}
        selectedTempo="hurry_up"
        timeoutAfterPlay
        canShowSpike
        canShowKneel
        phase="ready"
        decisionPrompt={prompt}
        onAdvance={vi.fn()}
        onDecision={vi.fn()}
      />,
    );

    for (const label of ['Auto', 'Normal', 'Hurry', 'Chew', 'Spike', 'Kneel']) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('Timeout armed');
  });
});
