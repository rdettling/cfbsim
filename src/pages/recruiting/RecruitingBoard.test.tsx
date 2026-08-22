import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RecruitingBoard } from './RecruitingBoard';

const renderBoard = (advanceLabel: string) => renderToStaticMarkup(
  <RecruitingBoard
    prospects={[]}
    allocations={{}}
    pointBudget={100}
    perProspectCap={25}
    userTeamId={1}
    meaningfulPursuitPoints={10}
    positionNeeds={[]}
    busy={false}
    editable
    onSelect={vi.fn()}
    onAllocationChange={vi.fn()}
    onRemove={vi.fn()}
    onAddRecruits={vi.fn()}
    onClear={vi.fn()}
    advanceLabel={advanceLabel}
    advanceDisabled={false}
    onAdvance={vi.fn()}
  />,
);

describe('RecruitingBoard', () => {
  it('keeps weekly advancement beside the board controls', () => {
    const markup = renderBoard('Advance Week');

    expect(markup).toContain('Clear Points');
    expect(markup).toContain('Advance Week');
  });

  it('uses the same local action for Signing Day', () => {
    expect(renderBoard('Resolve Signing Day')).toContain(
      'Resolve Signing Day',
    );
  });
});
