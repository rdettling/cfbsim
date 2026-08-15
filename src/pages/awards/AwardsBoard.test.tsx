import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type {
  AwardDisplayEntry,
  AwardDisplayPlacement,
  AwardGroup,
} from '../../types/awards';
import {
  AwardsBoard,
  AwardStandings,
  getNextExpandedAward,
} from './AwardsBoard';

const placement = (
  key: AwardDisplayPlacement['key'],
  id: number,
  first: string,
  score: number | null,
): AwardDisplayPlacement => ({
  key,
  player: {
    id,
    first,
    last: 'Player',
    position: 'qb',
    teamName: 'Test State',
  },
  score,
  statLine: `${id}000 passing yards`,
});

const emptyPlacement = (key: AwardDisplayPlacement['key']): AwardDisplayPlacement => ({
  key,
  player: null,
  score: null,
  statLine: null,
});

const award = (
  categorySlug: string,
  categoryName: string,
  group: AwardGroup,
  placements: AwardDisplayPlacement[],
): AwardDisplayEntry => ({
  categorySlug,
  categoryName,
  categoryDescription: `${categoryName} description.`,
  group,
  placements,
});

const renderBoard = (
  awards: AwardDisplayEntry[],
  mode: 'live' | 'final',
  emptyTitle?: string,
) => renderToStaticMarkup(
  <MemoryRouter>
    <AwardsBoard
      awards={awards}
      mode={mode}
      onTeamClick={() => undefined}
      emptyTitle={emptyTitle}
    />
  </MemoryRouter>,
);

const renderStandings = (
  placements: AwardDisplayPlacement[],
  mode: 'live' | 'final',
) => renderToStaticMarkup(
  <MemoryRouter>
    <AwardStandings
      id="test-standings"
      placements={placements}
      mode={mode}
      onTeamClick={() => undefined}
    />
  </MemoryRouter>,
);

describe('AwardsBoard', () => {
  it('renders grouped live leaders as a collapsed board', () => {
    const markup = renderBoard([
      award('heisman', 'Heisman Trophy', 'overall', [
        placement('first', 1, 'First', 300),
        placement('second', 2, 'Second', 200),
        placement('third', 3, 'Third', 100),
      ]),
      award('davey_obrien', "Davey O'Brien Award", 'offense', [
        placement('first', 4, 'Fourth', 250),
      ]),
    ], 'live');

    expect(markup).toContain('aria-label="Awards board"');
    expect(markup).toContain('Overall');
    expect(markup).toContain('Offense');
    expect(markup).toContain('First Player');
    expect(markup).toContain('1000 passing yards');
    expect(markup).toContain('View race');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('Second Player');
    expect(markup).not.toContain('300.0');
  });

  it('keeps all twelve empty award rows visible in canonical groups', () => {
    const markup = renderBoard([
      award('heisman', 'Heisman Trophy', 'overall', [emptyPlacement('first')]),
      award('maxwell', 'Maxwell Award', 'overall', [emptyPlacement('first')]),
      award('davey_obrien', "Davey O'Brien Award", 'offense', [emptyPlacement('first')]),
      award('doak_walker', 'Doak Walker Award', 'offense', [emptyPlacement('first')]),
      award('biletnikoff', 'Biletnikoff Award', 'offense', [emptyPlacement('first')]),
      award('mackey', 'John Mackey Award', 'offense', [emptyPlacement('first')]),
      award('bednarik', 'Bednarik Award', 'defense', [emptyPlacement('first')]),
      award('nagurski', 'Bronko Nagurski Trophy', 'defense', [emptyPlacement('first')]),
      award('ted_hendricks', 'Ted Hendricks Award', 'defense', [emptyPlacement('first')]),
      award('butkus', 'Butkus Award', 'defense', [emptyPlacement('first')]),
      award('thorpe', 'Thorpe Award', 'defense', [emptyPlacement('first')]),
      award('lou_groza', 'Lou Groza Award', 'specialTeams', [emptyPlacement('first')]),
    ], 'live');

    expect(markup).toContain('Overall');
    expect(markup).toContain('Offense');
    expect(markup).toContain('Defense');
    expect(markup).toContain('Special Teams');
    expect(markup.match(/No leader yet/g)).toHaveLength(12);
    expect(markup).not.toContain('View race');
  });

  it('renders full live standings with scores and missing placements', () => {
    const markup = renderStandings([
      placement('first', 1, 'First', 300),
      placement('second', 2, 'Second', 200),
      emptyPlacement('third'),
    ], 'live');

    expect(markup).toContain('Leader');
    expect(markup).toContain('Second');
    expect(markup).toContain('Third');
    expect(markup).toContain('First Player');
    expect(markup).toContain('300.0');
    expect(markup).toContain('No eligible candidate yet');
  });

  it('uses final placement labels for finalized standings', () => {
    const markup = renderStandings([
      placement('first', 1, 'Winner', 300),
      placement('second', 2, 'Runner', 200),
      placement('third', 3, 'Third', 100),
    ], 'final');

    expect(markup).toContain('Winner');
    expect(markup).toContain('Second');
    expect(markup).toContain('Third');
  });

  it('renders archived winners without disclosure controls or scores', () => {
    const markup = renderBoard([
      award('heisman', 'Heisman Trophy', 'overall', [
        placement('first', 1, 'Archived', null),
      ]),
    ], 'final');

    expect(markup).toContain('Archived Player');
    expect(markup).not.toContain('View finalists');
    expect(markup).not.toContain('Score');
  });

  it('keeps only one award expanded and collapses the selected award on repeat', () => {
    expect(getNextExpandedAward(null, 'heisman')).toBe('heisman');
    expect(getNextExpandedAward('heisman', 'bednarik')).toBe('bednarik');
    expect(getNextExpandedAward('bednarik', 'bednarik')).toBeNull();
  });

  it('renders a contextual empty collection state', () => {
    expect(renderBoard([], 'final', 'No award winners archived')).toContain(
      'No award winners archived',
    );
  });
});
