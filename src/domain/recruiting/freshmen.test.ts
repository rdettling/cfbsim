import { describe, expect, it } from 'vitest';
import { buildTestPlayer } from '../../test/fixtures';
import { buildRecruitingProspect } from '../../test/recruitingFixtures';
import { buildCommittedFreshmen } from './freshmen';

describe('committed freshman conversion', () => {
  it('is deterministic, collision-safe, and does not mutate its inputs', () => {
    const prospects = [
      buildRecruitingProspect({
        id: 2,
        nationalRank: 2,
        committedTeamId: 1,
        committedRound: 3,
      }),
      buildRecruitingProspect({
        id: 1,
        nationalRank: 1,
        committedTeamId: 2,
        committedRound: 'signing_day',
      }),
      buildRecruitingProspect({ id: 3, nationalRank: 3 }),
    ];
    const existingPlayers = [buildTestPlayer({ id: 10 })];
    const before = structuredClone({ prospects, existingPlayers });

    const result = buildCommittedFreshmen({
      prospects,
      existingPlayers,
      nextPlayerId: 5,
      acquisitionYear: 2026,
    });

    expect(result.players.map(player => [player.id, player.teamId])).toEqual([
      [11, 2],
      [12, 1],
    ]);
    expect(result.players[0]).toMatchObject({
      year: 'fr',
      rating: 70,
      starter: false,
    });
    expect(result.nextPlayerId).toBe(13);
    expect(result.origins).toEqual([
      expect.objectContaining({
        playerId: 11,
        kind: 'recruit',
        acquisitionYear: 2026,
        originalTeamId: 2,
        nationalRank: 1,
        positionRank: 1,
        commitmentRound: 'signing_day',
      }),
      expect.objectContaining({
        playerId: 12,
        kind: 'recruit',
        acquisitionYear: 2026,
        originalTeamId: 1,
        nationalRank: 2,
        positionRank: 2,
        commitmentRound: 3,
      }),
    ]);
    expect({ prospects, existingPlayers }).toEqual(before);
  });
});
