import { describe, expect, it } from 'vitest';
import {
  buildTestPlayer,
  buildTestTeam,
} from '../test/fixtures';
import {
  applyRosterCutIds,
  assertFinalRosters,
  buildRosterCutsPreview,
  recommendRosterCuts,
  validateRosterCutSelection,
} from './rosterCuts';
import {
  FINAL_ROSTER_SIZE,
  POSITION_ORDER,
  ROSTER,
} from './rosterConfig';

const buildCompliantRoster = (
  teamId = 1,
  startId = 1,
) => {
  let id = startId;
  return POSITION_ORDER.flatMap(position =>
    Array.from({ length: ROSTER[position].total }, (_, index) =>
      buildTestPlayer({
        id: id++,
        teamId,
        pos: position,
        year: index % 3 === 0 ? 'so' : index % 3 === 1 ? 'jr' : 'sr',
        rating: 70 + index,
        rating_sr: 78 + index,
        starter: false,
      }),
    ),
  );
};

describe('exact roster cut selection', () => {
  it('prefers the largest soft surplus and reaches the configured size', () => {
    const base = buildCompliantRoster();
    const extras = [
      buildTestPlayer({
        id: 100,
        pos: 'qb',
        year: 'sr',
        rating: 55,
        rating_sr: 60,
      }),
      buildTestPlayer({
        id: 101,
        pos: 'qb',
        year: 'jr',
        rating: 50,
        rating_sr: 59,
      }),
      buildTestPlayer({
        id: 102,
        pos: 'rb',
        year: 'sr',
        rating: 40,
        rating_sr: 50,
      }),
    ];

    const cuts = recommendRosterCuts({
      players: [...base, ...extras],
      teamId: 1,
      year: 2026,
      seed: 9,
      selectedCutIds: [],
    });

    expect(cuts).toHaveLength(3);
    expect(cuts.map(player => player.pos)).toEqual(['qb', 'rb', 'qb']);
    expect(cuts[1].id).toBe(102);
  });

  it('protects underclassmen with an observable senior-value estimate', () => {
    const players = [
      ...buildCompliantRoster(),
      buildTestPlayer({
        id: 100,
        pos: 'qb',
        year: 'so',
        rating: 60,
        rating_sr: 40,
      }),
      buildTestPlayer({
        id: 101,
        pos: 'qb',
        year: 'jr',
        rating: 62,
        rating_sr: 99,
      }),
      buildTestPlayer({
        id: 102,
        pos: 'qb',
        year: 'sr',
        rating: 63,
        rating_sr: 99,
      }),
    ];
    const input = {
      players,
      teamId: 1,
      year: 2026,
      seed: 5,
      selectedCutIds: [],
    };

    expect(recommendRosterCuts(input).map(player => player.id)).toEqual([
      102,
      101,
      100,
    ]);

    const differentHiddenRatings = players.map(player =>
      player.id >= 100
        ? {
            ...player,
            rating_sr: player.id === 100 ? 99 : 40,
          }
        : player,
    );
    expect(
      recommendRosterCuts({
        ...input,
        players: differentHiddenRatings,
      }).map(player => player.id),
    ).toEqual([102, 101, 100]);
  });

  it('protects freshmen and preserves starter minima', () => {
    const roster = buildCompliantRoster();
    const freshman = buildTestPlayer({
      id: 100,
      pos: 'qb',
      year: 'fr',
      rating: 30,
      rating_sr: 40,
    });
    const cut = recommendRosterCuts({
      players: [...roster, freshman],
      teamId: 1,
      year: 2026,
      seed: 1,
      selectedCutIds: [],
    });
    expect(cut).toHaveLength(1);
    expect(cut[0].year).not.toBe('fr');

    const onlyReturningPunter = roster.find(
      player => player.pos === 'p' && player.year !== 'fr',
    )!;
    const protectedPosition = roster.map(player =>
      player.pos === 'p' && player.id !== onlyReturningPunter.id
        ? { ...player, active: false }
        : player,
    );
    expect(() =>
      validateRosterCutSelection(
        [
          ...protectedPosition,
          buildTestPlayer({ id: 100, pos: 'rb' }),
          buildTestPlayer({ id: 101, pos: 'rb' }),
        ],
        1,
        [onlyReturningPunter.id],
      ),
    ).toThrow(/starter minimum/);
  });

  it('validates partial selections and rejects duplicate or excess cuts', () => {
    const players = [
      ...buildCompliantRoster(),
      buildTestPlayer({ id: 100, pos: 'qb' }),
      buildTestPlayer({ id: 101, pos: 'rb' }),
    ];
    expect(
      validateRosterCutSelection(players, 1, [100]),
    ).toMatchObject({ requiredCuts: 2 });
    expect(() =>
      validateRosterCutSelection(players, 1, [100, 100]),
    ).toThrow(/duplicate/i);
    expect(() =>
      validateRosterCutSelection(players, 1, [100, 101, 1]),
    ).toThrow(/requires only 2/);
    expect(() =>
      validateRosterCutSelection(players, 1, [100], true),
    ).toThrow(/requires 2 cuts/);
  });

  it('accounts for persisted selections in the loader preview', () => {
    const players = [
      ...buildCompliantRoster(),
      buildTestPlayer({ id: 100, pos: 'qb', rating_sr: 40 }),
      buildTestPlayer({ id: 101, pos: 'rb', rating_sr: 41 }),
    ];
    const preview = buildRosterCutsPreview({
      players,
      teamId: 1,
      year: 2026,
      seed: 10,
      selectedCutIds: [100],
    });
    expect(preview.selectedCutIds).toEqual([100]);
    expect(preview.recommendedCutIds).toHaveLength(1);
    expect(preview.summary).toMatchObject({
      activePlayers: FINAL_ROSTER_SIZE + 2,
      requiredCuts: 2,
      selectedCuts: 1,
      remainingCuts: 1,
      projectedRosterSize: FINAL_ROSTER_SIZE,
    });
    expect(preview.players.find(player => player.id === 100)?.selected).toBe(true);
  });

  it('applies cuts without mutating protected players and validates final rosters', () => {
    const teams = [
      buildTestTeam({ id: 1 }),
      buildTestTeam({ id: 2, name: 'Other State' }),
    ];
    const players = teams.flatMap((team, index) => [
      ...buildCompliantRoster(team.id, index * 200 + 1),
      buildTestPlayer({
        id: index * 200 + 100,
        teamId: team.id,
        pos: 'qb',
      }),
    ]);
    const cuts = teams.flatMap(team =>
      recommendRosterCuts({
        players,
        teamId: team.id,
        year: 2026,
        seed: 3,
        selectedCutIds: [],
      }).map(player => player.id),
    );
    applyRosterCutIds(players, cuts);
    expect(() => assertFinalRosters(teams, players)).not.toThrow();
    expect(players.filter(player => player.active)).toHaveLength(
      FINAL_ROSTER_SIZE * teams.length,
    );
  });

  it('is deterministic across player ordering and does not mutate inputs', () => {
    const players = [
      ...buildCompliantRoster(),
      ...Array.from({ length: 4 }, (_, index) =>
        buildTestPlayer({
          id: 100 + index,
          pos: 'qb',
          year: 'sr',
          rating: 40,
          rating_sr: 45,
        }),
      ),
    ];
    const before = structuredClone(players);
    const input = {
      players,
      teamId: 1,
      year: 2026,
      seed: 123,
      selectedCutIds: [],
    };
    const first = recommendRosterCuts(input).map(player => player.id);
    const reordered = recommendRosterCuts({
      ...input,
      players: [...players].reverse(),
    }).map(player => player.id);
    expect(reordered).toEqual(first);
    expect(players).toEqual(before);
  });
});
