import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import { buildRecruitingContext } from './context';

describe('recruiting context', () => {
  it('indexes active known-team players and sorted position depth', () => {
    const context = buildRecruitingContext(
      [buildTestTeam({ id: 1 }), buildTestTeam({ id: 2 })],
      [
        buildTestPlayer({ id: 1, teamId: 1, pos: 'qb', rating: 75 }),
        buildTestPlayer({ id: 2, teamId: 1, pos: 'qb', rating: 85 }),
        buildTestPlayer({ id: 3, teamId: 1, active: false }),
        buildTestPlayer({ id: 4, teamId: 99 }),
      ],
    );
    expect(context.teamCount).toBe(2);
    expect(context.rostersByTeamId.get(1)?.activeCount).toBe(2);
    expect(context.rostersByTeamId.get(1)?.positions.get('qb')).toEqual({
      count: 2,
      ratings: [85, 75],
    });
    expect(context.rostersByTeamId.get(2)?.activeCount).toBe(0);
    expect(context.rostersByTeamId.has(99)).toBe(false);
  });
});
