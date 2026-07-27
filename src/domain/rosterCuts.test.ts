import { describe, expect, it } from 'vitest';
import {
  buildTestPlayer,
  buildTestTeam,
} from '../test/fixtures';
import { buildRosterCutsPreview, applyRosterCuts, selectTeamRosterCuts } from './rosterCuts';
import { POSITION_ORDER, ROSTER } from './rosterConfig';

describe('roster cut selection', () => {
  it.each(POSITION_ORDER)(
    'enforces the configured %s limit at, below, and above the cap',
    position => {
      const limit = ROSTER[position].total;
      const players = Array.from(
        { length: limit + 1 },
        (_, index) =>
          buildTestPlayer({
            id: index + 1,
            pos: position,
            rating: 90 - index,
            rating_sr: 95 - index,
          }),
      );

      expect(
        selectTeamRosterCuts(players.slice(0, limit - 1), 1),
      ).toEqual([]);
      expect(
        selectTeamRosterCuts(players.slice(0, limit), 1),
      ).toEqual([]);
      expect(
        selectTeamRosterCuts(players, 1).map(player => player.id),
      ).toEqual([limit + 1]);
    },
  );

  it('uses senior rating, current rating, class seniority, and ascending ID in order', () => {
    const players = [
      buildTestPlayer({ id: 8, rating_sr: 99, rating: 60, year: 'fr' }),
      buildTestPlayer({ id: 7, rating_sr: 98, rating: 99, year: 'sr' }),
      buildTestPlayer({ id: 6, rating_sr: 90, rating: 90, year: 'sr' }),
      buildTestPlayer({ id: 2, rating_sr: 90, rating: 90, year: 'so' }),
      buildTestPlayer({ id: 3, rating_sr: 90, rating: 90, year: 'so' }),
      buildTestPlayer({ id: 4, rating_sr: 90, rating: 89, year: 'sr' }),
    ];

    expect(
      selectTeamRosterCuts(players, 1).map(player => player.id),
    ).toEqual([3, 4]);
  });

  it('ignores inactive players, other teams, and unconfigured positions', () => {
    const players = [
      ...Array.from({ length: ROSTER.qb.total + 1 }, (_, index) =>
        buildTestPlayer({ id: index + 1, rating_sr: 90 - index }),
      ),
      buildTestPlayer({ id: 20, active: false, rating_sr: 1 }),
      buildTestPlayer({ id: 21, teamId: 2, rating_sr: 1 }),
      buildTestPlayer({ id: 22, pos: 'ath', rating_sr: 1 }),
    ];

    expect(
      selectTeamRosterCuts(players, 1).map(player => player.id),
    ).toEqual([5]);
  });
});

describe('roster cuts preview and application', () => {
  it('returns ordered positions, exact cuts, and summary totals', () => {
    const players = [
      ...Array.from({ length: ROSTER.qb.total + 1 }, (_, index) =>
        buildTestPlayer({
          id: index + 1,
          pos: 'qb',
          rating: 85 - index,
          rating_sr: 90 - index,
        }),
      ),
      buildTestPlayer({ id: 20, pos: 'rb' }),
      buildTestPlayer({ id: 21, pos: 'ath' }),
      buildTestPlayer({ id: 22, active: false }),
      buildTestPlayer({ id: 23, teamId: 2 }),
    ];

    const preview = buildRosterCutsPreview(players, 1);

    expect(preview.positions.map(position => position.position)).toEqual(
      POSITION_ORDER,
    );
    expect(preview.positions[0]).toEqual({
      position: 'qb',
      activePlayers: 5,
      rosterLimit: 4,
      projectedCuts: 1,
      projectedPlayers: 4,
    });
    expect(preview.cuts).toEqual([
      {
        id: 5,
        first: 'Pat',
        last: 'Player',
        position: 'qb',
        currentClass: 'jr',
        currentRating: 81,
        seniorRating: 86,
      },
    ]);
    expect(preview.summary).toEqual({
      activePlayers: 7,
      projectedCuts: 1,
      projectedRosterSize: 6,
      positionsOverLimit: 1,
    });
  });

  it('returns a compliant empty-roster preview', () => {
    expect(buildRosterCutsPreview([], 1)).toEqual({
      cuts: [],
      positions: POSITION_ORDER.map(position => ({
        position,
        activePlayers: 0,
        rosterLimit: ROSTER[position].total,
        projectedCuts: 0,
        projectedPlayers: 0,
      })),
      summary: {
        activePlayers: 0,
        projectedCuts: 0,
        projectedRosterSize: 0,
        positionsOverLimit: 0,
      },
    });
  });

  it('applies exactly the shared selection for every team', () => {
    const teams = [
      buildTestTeam({ id: 1 }),
      buildTestTeam({ id: 2, name: 'Other State' }),
    ];
    const players = teams.flatMap((team, teamIndex) =>
      Array.from({ length: ROSTER.qb.total + 1 }, (_, index) =>
        buildTestPlayer({
          id: teamIndex * 10 + index + 1,
          teamId: team.id,
          rating_sr: 90 - index,
          starter: true,
        }),
      ),
    );
    const projectedIds = teams.flatMap(team =>
      selectTeamRosterCuts(players, team.id).map(player => player.id),
    );

    applyRosterCuts(teams, players);

    expect(
      players
        .filter(player => !player.active)
        .map(player => player.id),
    ).toEqual(projectedIds);
    expect(
      players.filter(player => !projectedIds.includes(player.id)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ active: true, starter: true }),
      ]),
    );
    projectedIds.forEach(id => {
      expect(players.find(player => player.id === id)).toMatchObject({
        active: false,
        starter: false,
      });
    });
  });
});
