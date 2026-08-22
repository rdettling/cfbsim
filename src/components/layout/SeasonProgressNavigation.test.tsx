import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildSeasonCalendarModel } from './leagueCalendar';
import {
  SeasonProgressDesktop,
} from './SeasonProgressNavigation';
import { SeasonProgressMobile } from './SeasonProgressMobile';

const handlers = {
  advancing: false,
  disabled: false,
  onAdvanceToWeek: vi.fn(),
  onOpenSummary: vi.fn(),
};

describe('SeasonProgressNavigation', () => {
  it('renders every desktop week and the simple advancement menu', () => {
    const markup = renderToStaticMarkup(
      <SeasonProgressDesktop
        calendar={buildSeasonCalendarModel(2026, 4, 19)}
        {...handlers}
      />,
    );

    expect(markup).toContain('aria-label="Season progress"');
    expect(markup).toContain('aria-label="Week 4, current week"');
    expect(markup).toContain('aria-label="Sim to Week 19"');
    expect(markup).toContain('aria-label="Postseason"');
    expect(markup).toContain('Regular Season');
    expect(markup).toContain('Postseason');
    expect(markup).toContain('>Advance</button>');
    expect(markup).not.toContain('Advance to Week 5');
  });

  it('renders final-week and completed-season actions', () => {
    const finalWeek = renderToStaticMarkup(
      <SeasonProgressDesktop
        calendar={buildSeasonCalendarModel(2026, 16, 16)}
        {...handlers}
      />,
    );
    const complete = renderToStaticMarkup(
      <SeasonProgressDesktop
        calendar={buildSeasonCalendarModel(2026, 17, 16)}
        {...handlers}
      />,
    );

    expect(finalWeek).toContain('>Advance</button>');
    expect(finalWeek).not.toContain('Finish Season');
    expect(complete).toContain('Season Summary');
  });

  it('renders the compact mobile calendar summary', () => {
    const markup = renderToStaticMarkup(
      <SeasonProgressMobile
        calendar={buildSeasonCalendarModel(2026, 4, 19)}
        {...handlers}
      />,
    );

    expect(markup).toContain('2026 Season');
    expect(markup).toContain('Week 4 of 19');
    expect(markup).toContain('View weeks');
    expect(markup).toContain('Advance');
  });

  it('uses compact final-week and completed-season mobile actions', () => {
    const finalWeek = renderToStaticMarkup(
      <SeasonProgressMobile
        calendar={buildSeasonCalendarModel(2026, 16, 16)}
        {...handlers}
      />,
    );
    const complete = renderToStaticMarkup(
      <SeasonProgressMobile
        calendar={buildSeasonCalendarModel(2026, 17, 16)}
        {...handlers}
      />,
    );

    expect(finalWeek).toContain('Finish Season');
    expect(complete).toContain('Season complete');
    expect(complete).toContain('Summary');
  });
});
