import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestLeague } from '../test/fixtures';
import AdvancedStats from './AdvancedStats';

const mockUseDomainData = vi.hoisted(() => vi.fn());

vi.mock('../domain/hooks', () => ({ useDomainData: mockUseDomainData }));

describe('AdvancedStats page', () => {
  beforeEach(() => {
    const league = buildTestLeague('season');
    mockUseDomainData.mockReturnValue({
      data: {
        info: league.info,
        team: league.teams[0],
        conferences: league.conferences,
        rows: [],
      },
      loading: false,
      error: null,
    });
  });

  it('keeps Glossary beside the heading and removes persistent explanation copy', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/stats/advanced']}>
        <AdvancedStats />
      </MemoryRouter>,
    );

    expect(markup).toContain('Advanced Statistics');
    expect(markup).toContain('Glossary');
    expect(markup).toContain('MuiButton-outlined');
    expect(markup.indexOf('Advanced Statistics')).toBeLessThan(markup.indexOf('Glossary'));
    expect(markup).not.toContain('describes completed-game play adjusted');
    expect(markup).not.toContain('season · Week');
    expect(markup).toContain('Performance');
    expect(markup).toContain('Poll');
    expect(markup).toContain('Offense');
    expect(markup).toContain('Defense');
  });
});
