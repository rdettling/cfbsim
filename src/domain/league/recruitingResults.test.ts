import { describe, expect, it } from 'vitest';
import { buildTestPlayer, buildTestTeam } from '../../test/fixtures';
import { buildRecruitingResults } from './recruitingResults';

describe('buildRecruitingResults', () => {
  it('preserves the class-score formula and normalizes rankings', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Alpha' }),
      buildTestTeam({ id: 2, name: 'Beta' }),
      buildTestTeam({ id: 3, name: 'Charlie' }),
    ];
    const players = [
      buildTestPlayer({
        id: 1,
        teamId: 1,
        year: 'fr',
        stars: 5,
        rating: 90,
      }),
      buildTestPlayer({
        id: 2,
        teamId: 1,
        year: 'fr',
        stars: 4,
        rating: 80,
      }),
      buildTestPlayer({
        id: 3,
        teamId: 2,
        year: 'fr',
        stars: 5,
        rating: 88,
      }),
      buildTestPlayer({
        id: 4,
        teamId: 3,
        year: 'fr',
        stars: 4,
        rating: 84,
      }),
      buildTestPlayer({
        id: 5,
        teamId: 3,
        year: 'fr',
        stars: 4,
        rating: 82,
      }),
    ];

    const result = buildRecruitingResults(teams, players, 1);

    expect(
      result.teamRankings.map(team => ({
        name: team.teamName,
        rank: team.rank,
        score: team.classScore,
      })),
    ).toEqual([
      { name: 'Beta', rank: 1, score: 100 },
      { name: 'Alpha', rank: 2, score: 55.6 },
      { name: 'Charlie', rank: 3, score: 0 },
    ]);
    expect(result.userTeam?.teamName).toBe('Alpha');
  });

  it('returns complete team and national player metrics', () => {
    const team = buildTestTeam();
    const players = [
      buildTestPlayer({
        id: 1,
        year: 'fr',
        pos: 'wr',
        rating: 91,
        stars: 5,
      }),
      buildTestPlayer({
        id: 2,
        year: 'fr',
        pos: 'qb',
        rating: 79,
        stars: 4,
      }),
    ];

    const result = buildRecruitingResults([team], players, team.id);

    expect(result.teamRankings[0]).toMatchObject({
      rank: 1,
      totalRecruits: 2,
      averageRating: 85,
      averageStars: 4.5,
      starCounts: {
        five: 1,
        four: 1,
        three: 0,
        two: 0,
        one: 0,
      },
      classScore: 100,
    });
    expect(result.playerRankings.map(player => player.rank)).toEqual([1, 2]);
    expect(result.positions).toEqual(['qb', 'wr']);
    expect(result.summary).toEqual({
      totalRecruits: 2,
      averageRating: 85,
      highestRating: 91,
    });
  });

  it('sorts ties deterministically and excludes ineligible players', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Zulu' }),
      buildTestTeam({ id: 2, name: 'Alpha' }),
      buildTestTeam({ id: 3, name: 'Gamma' }),
    ];
    const players = [
      buildTestPlayer({
        id: 4,
        teamId: 1,
        first: 'Zed',
        last: 'Same',
        year: 'fr',
        rating: 80,
        stars: 4,
      }),
      buildTestPlayer({
        id: 3,
        teamId: 2,
        first: 'Amy',
        last: 'Same',
        year: 'fr',
        rating: 80,
        stars: 4,
      }),
      buildTestPlayer({
        id: 2,
        teamId: 3,
        year: 'fr',
        rating: 80,
        stars: 3,
      }),
      buildTestPlayer({ id: 5, year: 'so', rating: 99 }),
      buildTestPlayer({ id: 6, year: 'fr', active: false, rating: 99 }),
      buildTestPlayer({ id: 7, teamId: 999, year: 'fr', rating: 99 }),
    ];

    const result = buildRecruitingResults(teams, players, 999);

    expect(result.playerRankings.map(player => player.id)).toEqual([3, 4, 2]);
    expect(result.teamRankings.map(team => team.teamName)).toEqual([
      'Alpha',
      'Zulu',
      'Gamma',
    ]);
    expect(result.userTeam).toBeNull();
  });

  it('returns a zeroed result for an empty class', () => {
    expect(buildRecruitingResults([buildTestTeam()], [], 1)).toEqual({
      teamRankings: [],
      playerRankings: [],
      positions: [],
      userTeam: null,
      summary: {
        totalRecruits: 0,
        averageRating: 0,
        highestRating: 0,
      },
    });
  });
});
