import { describe, expect, it } from 'vitest';
import { buildTestPlayer } from '../test/fixtures';
import { buildRecruitingProspect } from '../test/recruitingFixtures';
import {
  buildInitialRosterOrigins,
  buildPositionRanks,
  buildRecruitOrigin,
  buildWalkOnOrigins,
} from './playerOrigins';

describe('player origin construction', () => {
  it('ranks every position from the complete pool in national order', () => {
    const ranks = buildPositionRanks([
      buildRecruitingProspect({ id: 30, nationalRank: 3, position: 'qb' }),
      buildRecruitingProspect({ id: 10, nationalRank: 1, position: 'wr' }),
      buildRecruitingProspect({ id: 20, nationalRank: 2, position: 'qb' }),
      buildRecruitingProspect({ id: 40, nationalRank: 4, position: 'wr' }),
    ]);
    expect([...ranks.entries()]).toEqual([
      [10, 1],
      [20, 1],
      [30, 2],
      [40, 2],
    ]);
  });

  it('builds exact recruit, walk-on, and initial-roster facts', () => {
    const prospect = buildRecruitingProspect({
      id: 8,
      nationalRank: 12,
      committedTeamId: 2,
      committedRound: 4,
      state: 'CA',
      publicRatingMin: 71,
      publicRatingMax: 76,
    });
    expect(buildRecruitOrigin({
      playerId: 101,
      prospect: prospect as typeof prospect & { committedTeamId: number },
      acquisitionYear: 2027,
      positionRank: 3,
    })).toEqual({
      playerId: 101,
      kind: 'recruit',
      acquisitionYear: 2027,
      originalTeamId: 2,
      homeState: 'CA',
      nationalRank: 12,
      positionRank: 3,
      commitmentRound: 4,
      publicRatingMin: 71,
      publicRatingMax: 76,
    });
    const player = buildTestPlayer({ id: 102, teamId: 2, year: 'jr' });
    expect(buildWalkOnOrigins([player], 2027)[0]).toMatchObject({
      playerId: 102,
      kind: 'walk_on',
      acquisitionYear: 2027,
      originalTeamId: 2,
    });
    expect(buildInitialRosterOrigins([player], 2025)[0]).toMatchObject({
      playerId: 102,
      kind: 'initial_roster',
      acquisitionYear: 2025,
      originalTeamId: 2,
      classAtStart: 'jr',
    });
  });
});
