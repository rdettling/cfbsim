import { describe, expect, it } from 'vitest';
import type { WeightedNameData } from '../types/recruiting';
import { buildTestPlayer, buildTestTeam } from '../test/fixtures';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from './rosterConfig';
import { generateWalkOns } from './walkOns';

const names: WeightedNameData = {
  black: {
    first: [{ name: 'Pat', weight: 1 }],
    last: [{ name: 'Walkon', weight: 1 }],
  },
  white: {
    first: [{ name: 'Sam', weight: 1 }],
    last: [{ name: 'Tryout', weight: 1 }],
  },
};

const buildRoster = (count: number) => {
  let id = 1;
  return POSITION_ORDER.flatMap(position =>
    Array.from(
      {
        length: Math.min(
          ROSTER[position].total,
          Math.max(0, count - (id - 1)),
        ),
      },
      () =>
        buildTestPlayer({
          id: id++,
          pos: position,
          starter: false,
        }),
    ),
  ).slice(0, count);
};

describe('walk-on generation', () => {
  it('fills starter shortages before soft positional deficits', () => {
    const players = buildRoster(FINAL_ROSTER_SIZE).filter(
      player => player.pos !== 'p',
    );
    const result = generateWalkOns({
      teams: [buildTestTeam()],
      players,
      names,
      year: 2026,
      seed: 42,
      nextPlayerId: 100,
    });
    expect(players.length + result.players.length).toBe(FINAL_ROSTER_SIZE);
    expect(result.players[0].pos).toBe('p');
    expect(result.players.every(player => player.year === 'fr')).toBe(true);
    expect(result.players.every(player => player.stars === 1)).toBe(true);
  });

  it('is deterministic and independent of team/player input ordering', () => {
    const teams = [
      buildTestTeam({ id: 1 }),
      buildTestTeam({ id: 2, name: 'Other State' }),
    ];
    const players = teams.flatMap((team, index) =>
      buildRoster(60).map(player => ({
        ...player,
        id: player.id + index * 100,
        teamId: team.id,
      })),
    );
    const input = {
      teams,
      players,
      names,
      year: 2026,
      seed: 99,
      nextPlayerId: 200,
    };
    const first = generateWalkOns(input);
    const reordered = generateWalkOns({
      ...input,
      teams: [...teams].reverse(),
      players: [...players].reverse(),
    });
    expect(reordered).toEqual(first);
    expect(players).toEqual(input.players);
  });

  it('rejects stale player counters and full rosters with starter shortages', () => {
    const players = buildRoster(60);
    expect(() =>
      generateWalkOns({
        teams: [buildTestTeam()],
        players,
        names,
        year: 2026,
        seed: 1,
        nextPlayerId: 1,
      }),
    ).toThrow(/counter/);

    const invalid = buildRoster(FINAL_ROSTER_SIZE).map(player => ({
      ...player,
      pos: player.pos === 'p' ? 'qb' : player.pos,
    }));
    expect(() =>
      generateWalkOns({
        teams: [buildTestTeam()],
        players: invalid,
        names,
        year: 2026,
        seed: 1,
        nextPlayerId: 100,
      }),
    ).toThrow(/starter minimum/);
  });

  it('rejects malformed name data instead of using generator fallbacks', () => {
    expect(() =>
      generateWalkOns({
        teams: [buildTestTeam()],
        players: buildRoster(60),
        names: {
          black: { first: [], last: [] },
          white: names.white,
        },
        year: 2026,
        seed: 1,
        nextPlayerId: 100,
      }),
    ).toThrow(/name category black/);
  });
});
