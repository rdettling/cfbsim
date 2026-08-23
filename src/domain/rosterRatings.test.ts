import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../test/fixtures';
import {
  recalculateTeamRatings,
  recalculateTeamStrengths,
} from './rosterRatings';

const starterGroups = (
  teamId: number,
  ratings: Record<string, number[]>,
) => Object.entries(ratings).flatMap(([position, values], positionIndex) =>
  values.map((rating, playerIndex) => buildTestPlayer({
    id: teamId * 100 + positionIndex * 10 + playerIndex,
    teamId,
    pos: position,
    rating,
    starter: true,
  })));

const completeStarters = (
  teamId: number,
  overrides: Partial<Record<string, number[]>> = {},
) => starterGroups(teamId, {
  qb: [60],
  rb: [60, 60],
  wr: [60, 60, 60],
  te: [60],
  ol: [60, 60, 60, 60, 60],
  dl: [61, 61, 61, 61],
  lb: [61, 61, 61],
  cb: [62, 62],
  s: [61, 61],
  k: [1],
  p: [99],
  ...overrides,
});

describe('team ratings', () => {
  it('calculates deterministic position-group offense, defense, and overall ratings', () => {
    const team = buildTestTeam();
    recalculateTeamStrengths([team], completeStarters(team.id));

    expect(team).toMatchObject({
      offense: 44,
      defense: 45,
      // Exact raw starter quality combines to 60.52, which rounds to raw 61
      // before the curve maps it to 44.7.
      rating: 45,
    });
  });

  it('averages multiple starters before applying each position weight', () => {
    const team = buildTestTeam();
    const players = completeStarters(team.id, {
      qb: [90],
      rb: [100, 60],
      wr: [90, 70, 50],
      te: [60],
      ol: [70, 60, 50, 40, 30],
    });

    recalculateTeamStrengths([team], players);

    expect(team.offense).toBe(65);
  });

  it('preserves the player-scale endpoints for uniform lineups', () => {
    const minimum = buildTestTeam({ id: 1 });
    const maximum = buildTestTeam({ id: 2 });
    recalculateTeamStrengths(
      [minimum],
      completeStarters(minimum.id).map(player => ({ ...player, rating: 25 })),
    );
    recalculateTeamStrengths(
      [maximum],
      completeStarters(maximum.id).map(player => ({ ...player, rating: 99 })),
    );

    expect(minimum).toMatchObject({ offense: 25, defense: 25, rating: 25 });
    expect(maximum).toMatchObject({ offense: 99, defense: 99, rating: 99 });
  });

  it('is input-order invariant and ignores kicker and punter ratings', () => {
    const first = buildTestTeam();
    const second = buildTestTeam();
    const players = completeStarters(first.id);
    const changedSpecialists = players.map(player =>
      player.pos === 'k' || player.pos === 'p'
        ? { ...player, rating: 50 }
        : { ...player });

    recalculateTeamStrengths([first], players);
    recalculateTeamStrengths([second], changedSpecialists.reverse());

    expect({ offense: second.offense, defense: second.defense, rating: second.rating })
      .toEqual({ offense: first.offense, defense: first.defense, rating: first.rating });
  });

  it('fails when a required starting position group is missing', () => {
    const team = buildTestTeam({ name: 'Incomplete State' });
    const players = completeStarters(team.id)
      .filter(player => player.pos !== 'qb');

    expect(() => recalculateTeamStrengths([team], players)).toThrow(
      'Cannot calculate ratings for Incomplete State: missing starting QB.',
    );
  });

  it('orders preseason rankings by deterministic overall rating', () => {
    const stronger = buildTestTeam({ id: 1, name: 'Stronger', ranking: 2 });
    const weaker = buildTestTeam({ id: 2, name: 'Weaker', ranking: 1 });
    const players = [
      ...completeStarters(stronger.id, {
        qb: [90],
        rb: [90, 90],
        wr: [90, 90, 90],
        te: [90],
        ol: [90, 90, 90, 90, 90],
        dl: [90, 90, 90, 90],
        lb: [90, 90, 90],
        cb: [90, 90],
        s: [90, 90],
      }),
      ...completeStarters(weaker.id),
    ];

    recalculateTeamRatings([weaker, stronger], players);

    expect(stronger).toMatchObject({ ranking: 1, last_rank: 1 });
    expect(weaker).toMatchObject({ ranking: 2, last_rank: 2 });
    expect(stronger.poll_score).toBeCloseTo(
      ((stronger.rating - 25) / (99 - 25)) * 100,
    );
    expect(weaker.poll_score).toBeCloseTo(
      ((weaker.rating - 25) / (99 - 25)) * 100,
    );
    expect(stronger.poll_score).toBeLessThan(100);
  });
});
