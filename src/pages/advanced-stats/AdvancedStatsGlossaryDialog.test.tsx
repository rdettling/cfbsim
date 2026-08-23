import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AdvancedStatsGlossaryContent,
  AdvancedStatsGlossaryDialog,
} from './AdvancedStatsGlossaryDialog';

describe('AdvancedStatsGlossaryDialog', () => {
  it('explains every ranking layer and detailed metric group', () => {
    const markup = renderToStaticMarkup(<AdvancedStatsGlossaryContent />);

    expect(markup).toContain('Official Poll Rank');
    expect(markup).toContain('Projected Poll Score');
    expect(markup).toContain('Résumé value');
    expect(markup).toContain('70% × winning');
    expect(markup).toContain('30%');
    expect(markup).toContain('Evidence Score =');
    expect(markup).toContain('Poll Score = prior');
    expect(markup).toContain('8+ games');
    expect(markup).toContain('0% prior');
    expect(markup).toContain('Performance Index');
    expect(markup).toContain('Offense metrics');
    expect(markup).toContain('Defense metrics');
    expect(markup).toContain('Successful-Play Yards');
  });

  it('does not render modal content while closed', () => {
    const markup = renderToStaticMarkup(
      <AdvancedStatsGlossaryDialog open={false} onClose={() => {}} />,
    );

    expect(markup).not.toContain('Advanced Statistics Glossary');
  });
});
