import { describe, expect, it } from 'vitest';
import { buildTestTeam } from '../../test/fixtures';
import { buildRecruitingProspect } from '../../test/recruitingFixtures';
import {
  calculateRecruitingClassScore,
  displayRecruitingClassScore,
} from '../recruiting/classScoring';
import { buildRecruitingResults } from './recruitingResults';

describe('buildRecruitingResults', () => {
  it('ranks star-only class scores without season normalization', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Alpha' }),
      buildTestTeam({ id: 2, name: 'Beta' }),
      buildTestTeam({ id: 3, name: 'Charlie' }),
    ];
    const prospects = [
      buildRecruitingProspect({
        id: 1,
        nationalRank: 1,
        committedTeamId: 1,
        stars: 5,
      }),
      buildRecruitingProspect({
        id: 2,
        nationalRank: 2,
        committedTeamId: 1,
        stars: 4,
      }),
      buildRecruitingProspect({
        id: 3,
        nationalRank: 3,
        committedTeamId: 2,
        stars: 5,
      }),
      buildRecruitingProspect({
        id: 4,
        nationalRank: 4,
        committedTeamId: 3,
        stars: 4,
      }),
      buildRecruitingProspect({
        id: 5,
        nationalRank: 5,
        committedTeamId: 3,
        stars: 4,
      }),
    ];

    const result = buildRecruitingResults(teams, prospects, 1);

    expect(
      result.teamRankings.map(team => ({
        name: team.teamName,
        rank: team.rank,
        score: team.classScore,
      })),
    ).toEqual([
      {
        name: 'Alpha',
        rank: 1,
        score: displayRecruitingClassScore(
          calculateRecruitingClassScore([{ stars: 5 }, { stars: 4 }]),
        ),
      },
      {
        name: 'Charlie',
        rank: 2,
        score: displayRecruitingClassScore(
          calculateRecruitingClassScore([{ stars: 4 }, { stars: 4 }]),
        ),
      },
      { name: 'Beta', rank: 3, score: 25 },
    ]);
    expect(result.userTeam?.teamName).toBe('Alpha');
  });

  it('returns star metrics and preserves public national ranks', () => {
    const team = buildTestTeam();
    const prospects = [
      buildRecruitingProspect({
        id: 1,
        nationalRank: 3,
        committedTeamId: team.id,
        position: 'wr',
        stars: 5,
      }),
      buildRecruitingProspect({
        id: 2,
        nationalRank: 11,
        committedTeamId: team.id,
        position: 'qb',
        stars: 4,
      }),
    ];

    const result = buildRecruitingResults([team], prospects, team.id);

    expect(result.teamRankings[0]).toMatchObject({
      rank: 1,
      totalRecruits: 2,
      averageStars: 4.5,
      starCounts: {
        five: 1,
        four: 1,
        three: 0,
        two: 0,
        one: 0,
      },
    });
    expect(result.playerRankings.map(player => player.rank)).toEqual([3, 11]);
    expect(result.positions).toEqual(['qb', 'wr']);
    expect(result.summary).toEqual({
      totalRecruits: 2,
    });
    expect(result.playerRankings[0]).not.toHaveProperty('rating');
  });

  it('scores identical star profiles equally and sorts exact ties by team name', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Zulu' }),
      buildTestTeam({ id: 2, name: 'Alpha' }),
    ];
    const prospects = [
      buildRecruitingProspect({
        id: 4,
        nationalRank: 20,
        committedTeamId: 1,
        stars: 4,
      }),
      buildRecruitingProspect({
        id: 3,
        nationalRank: 10,
        committedTeamId: 1,
        stars: 3,
      }),
      buildRecruitingProspect({
        id: 2,
        nationalRank: 2,
        committedTeamId: 2,
        stars: 3,
      }),
      buildRecruitingProspect({
        id: 1,
        nationalRank: 1,
        committedTeamId: 2,
        stars: 4,
      }),
    ];

    const result = buildRecruitingResults(teams, prospects, 999);

    expect(result.teamRankings.map(team => team.teamName)).toEqual([
      'Alpha',
      'Zulu',
    ]);
    expect(result.teamRankings[0].classScore).toBe(
      result.teamRankings[1].classScore,
    );
    expect(result.playerRankings.map(player => player.rank)).toEqual([
      1,
      2,
      10,
      20,
    ]);
    expect(result.userTeam).toBeNull();
  });

  it('ranks by the unrounded score when displayed scores match', () => {
    const teams = [
      buildTestTeam({ id: 1, name: 'Five Star' }),
      buildTestTeam({ id: 2, name: 'Depth' }),
    ];
    const result = buildRecruitingResults(
      teams,
      [
        buildRecruitingProspect({
          id: 1,
          nationalRank: 1,
          committedTeamId: 1,
          stars: 5,
        }),
        buildRecruitingProspect({
          id: 2,
          nationalRank: 2,
          committedTeamId: 2,
          stars: 4,
        }),
        buildRecruitingProspect({
          id: 3,
          nationalRank: 3,
          committedTeamId: 2,
          stars: 3,
        }),
      ],
      1,
    );

    expect(result.teamRankings.map(team => team.teamName)).toEqual([
      'Five Star',
      'Depth',
    ]);
    expect(result.teamRankings.map(team => team.classScore)).toEqual([
      25,
      25,
    ]);
  });

  it('excludes uncommitted prospects and commitments to unknown teams', () => {
    const team = buildTestTeam();
    const result = buildRecruitingResults(
      [team],
      [
        buildRecruitingProspect({ id: 1, committedTeamId: null }),
        buildRecruitingProspect({ id: 2, committedTeamId: 999 }),
      ],
      team.id,
    );

    expect(result).toEqual({
      teamRankings: [],
      playerRankings: [],
      positions: [],
      userTeam: null,
      summary: {
        totalRecruits: 0,
      },
    });
  });
});
