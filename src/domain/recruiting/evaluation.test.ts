import { describe, expect, it } from 'vitest';
import type { HistoryData, TeamsData } from '../../types/baseData';
import type { PlayerRecord } from '../../types/db';
import { buildTestLeague, buildTestTeam } from '../../test/fixtures';
import { POSITION_ORDER, ROSTER } from '../rosterConfig';
import {
  buildClassScoreDistribution,
  buildCountDistribution,
  buildRecruitingSupplySummary,
  buildTop25ClassComposition,
  evaluateRecruitingBalance,
  pearsonCorrelation,
  RECRUITING_BALANCE_TARGETS,
  runRecruitingEvaluationSuite,
} from './evaluation';
import type { RecruitingEvaluationAggregate } from '../../types/recruitingEvaluation';

const names = {
  black: {
    first: [{ name: 'Alex', weight: 1 }],
    last: [{ name: 'Player', weight: 1 }],
  },
  white: {
    first: [{ name: 'Sam', weight: 1 }],
    last: [{ name: 'Tester', weight: 1 }],
  },
};
const teams = [
  buildTestTeam({
    id: 1,
    name: 'Low State',
    abbreviation: 'LOW',
    prestige: 2,
    floor: 1,
    ceiling: 5,
    ranking: 2,
  }),
  buildTestTeam({
    id: 2,
    name: 'High State',
    abbreviation: 'HGH',
    prestige: 6,
    floor: 3,
    ceiling: 7,
    ranking: 1,
    state: 'OS',
  }),
];

let playerId = 1;
const players: PlayerRecord[] = teams.flatMap(team => {
  let slot = 0;
  return POSITION_ORDER.flatMap(position =>
    Array.from({ length: ROSTER[position].total }, (_, index) => {
      const year = ['fr', 'so', 'jr', 'sr'][slot++ % 4] as
        PlayerRecord['year'];
      const freshman = 40 + team.prestige * 5 + (index % 3);
      const ratings = {
        fr: freshman,
        so: freshman + 3,
        jr: freshman + 6,
        sr: freshman + 8,
      };
      return {
        id: playerId++,
        teamId: team.id,
        first: 'Initial',
        last: String(playerId),
        year,
        pos: position,
        rating: ratings[year],
        rating_fr: ratings.fr,
        rating_so: ratings.so,
        rating_jr: ratings.jr,
        rating_sr: ratings.sr,
        stars: Math.max(1, Math.min(5, Math.round(team.prestige / 1.5))),
        development_trait: 3,
        starter: index < ROSTER[position].starters,
        active: true,
      };
    }),
  );
});
const history: HistoryData = {
  generated_at: 'test',
  years: [2025],
  conf_index: { Test: 1 },
  teams: Object.fromEntries(
    teams.map(team => [
      team.name,
      [[2025, 1, team.ranking, 0, 0, team.prestige]],
    ]),
  ),
};
const teamsData: TeamsData = {
  teams: Object.fromEntries(
    teams.map(team => [
      team.name,
      {
        mascot: team.mascot,
        abbreviation: team.abbreviation,
        ceiling: team.ceiling,
        floor: team.floor,
        colorPrimary: team.colorPrimary,
        colorSecondary: team.colorSecondary,
        city: team.city,
        state: team.state,
        stadium: team.stadium,
      },
    ]),
  ),
};
const input = {
  league: buildTestLeague('preseason', {
    teams,
    idCounters: {
      game: 1,
      drive: 1,
      play: 1,
      gameLog: 1,
      player: playerId,
    },
  }),
  players,
  names,
  states: { TS: 1, OS: 1 },
  history,
  teamsData,
  prestigeConfig: { 1: 50, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 50 },
  rootSeed: 1234,
  seedCount: 1,
  replaySeedCount: 1,
  seasonsPerSeed: 2,
  startYear: 2026,
};

describe('multi-season recruiting evaluation', () => {
  it('carries complete legal rosters forward reproducibly', () => {
    const sourceLeague = structuredClone(input.league);
    const sourcePlayers = structuredClone(input.players);
    const first = runRecruitingEvaluationSuite(input);
    const second = runRecruitingEvaluationSuite(input);
    const reordered = runRecruitingEvaluationSuite({
      ...input,
      league: {
        ...structuredClone(input.league),
        teams: [...input.league.teams].reverse(),
      },
      players: [...input.players].reverse(),
    });

    expect(first).toEqual(second);
    expect(reordered.checksum).toBe(first.checksum);
    expect(first.reproducibilityFailures).toBe(0);
    expect(first.structuralViolations).toEqual([]);
    expect(
      first.balanceViolations.every(violation =>
        Object.keys(RECRUITING_BALANCE_TARGETS).includes(violation.metric),
      ),
    ).toBe(true);
    expect(first.aggregate.steadyStateRatingSpreadChange).toBe(
      first.runs[0].seasons[1].ratingSpread -
        first.runs[0].seasons[0].ratingSpread,
    );
    expect(first.aggregate.meaningfulPursuits).toBe(
      first.runs[0].seasons.reduce(
        (sum, season) => sum + season.meaningfulPursuits,
        0,
      ),
    );
    expect(first.aggregate.meaningfulCompetitionRate).toBe(
      first.aggregate.meaningfullyPursuedProspects > 0
        ? first.aggregate.contestedMeaningfulProspects /
            first.aggregate.meaningfullyPursuedProspects
        : 0,
    );
    expect(first.aggregate.pursuitsAdmitted).toBe(
      first.runs[0].seasons.reduce(
        (sum, season) => sum + season.pursuitsAdmitted,
        0,
      ),
    );
    expect(first.runs[0].seasons).toHaveLength(2);
    first.runs[0].seasons.forEach(season => {
      expect(season.teams).toHaveLength(2);
      expect(season.teamsCompletingBaseCapacity).toBe(2);
      expect(season.structuralViolations).toEqual([]);
      expect(
        season.prestigePromotions +
          season.prestigeDemotions +
          season.prestigeUnchanged,
      ).toBe(2);
      season.teams.forEach(team => {
        expect(Math.abs(team.prestigeAfter - team.prestigeBefore)).toBeLessThanOrEqual(1);
      });
    });
    expect(input.league).toEqual(sourceLeague);
    expect(input.players).toEqual(sourcePlayers);
  }, 30_000);

  it('changes checksums for a different root seed', () => {
    const first = runRecruitingEvaluationSuite({
      ...input,
      seasonsPerSeed: 1,
    });
    const second = runRecruitingEvaluationSuite({
      ...input,
      rootSeed: input.rootSeed + 1,
      seasonsPerSeed: 1,
    });
    expect(second.checksum).not.toBe(first.checksum);
  }, 30_000);

  it('handles exact and degenerate correlations', () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBe(1);
    expect(pearsonCorrelation([1, 1], [2, 3])).toBe(0);
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it('accepts exact gate boundaries and returns stable metric violations', () => {
    const aggregate: RecruitingEvaluationAggregate = {
      signingDayShare: 0.35,
      baseCapacityCompletion: 0.985,
      teamsCompletingBaseCapacity: 1,
      teamBaseCapacityCompletionRate: 0.85,
      oversigningsPerTeamSeason: 2.5,
      teamsUsingAllFourOversigns: 0,
      teamsUsingAllFourOversignsRate: 0.3,
      walkOnsPerTeamSeason: 0.2,
      teamSeasonsUsingWalkOns: 0,
      teamSeasonsUsingWalkOnsRate: 0.15,
      meaningfulPursuits: 10,
      meaningfullyPursuedProspects: 8,
      contestedMeaningfulProspects: 2,
      meaningfulCompetitionRate: 0.25,
      pursuitsAdmitted: 10,
      fundableOpeningsUnfilled: 0,
      lowPrestigeEliteWins: 0,
      lowPrestigeEliteShare: 0.32,
      prestigeClassScoreCorrelation: 0.65,
      classScoreDistribution: buildClassScoreDistribution([]),
      classSizeDistribution: buildCountDistribution([]),
      supplyByStar: {},
      supplyByPosition: {},
      top25ClassComposition: {},
      ratingSpreadChange: -30,
      steadyStateRatingSpreadChange: -10,
      prestigeMobility: 1,
      prestigeMobilityRate: 0.2,
    };
    expect(evaluateRecruitingBalance(aggregate)).toEqual([]);
    [
      ['oversigningsPerTeamSeason', 1],
      ['prestigeClassScoreCorrelation', 0.35],
      ['prestigeMobilityRate', 0.05],
    ].forEach(([metric, value]) => {
      expect(
        evaluateRecruitingBalance({
          ...aggregate,
          [metric]: value,
        }),
      ).toEqual([]);
    });

    const outside = {
      ...aggregate,
      baseCapacityCompletion: 0.984999,
      teamBaseCapacityCompletionRate: 0.849999,
      oversigningsPerTeamSeason: 0.999999,
      teamsUsingAllFourOversignsRate: 0.300001,
      walkOnsPerTeamSeason: 0.200001,
      teamSeasonsUsingWalkOnsRate: 0.150001,
      prestigeClassScoreCorrelation: 0.349999,
      prestigeMobilityRate: 0.049999,
    };
    expect(
      evaluateRecruitingBalance(outside).map(violation => violation.code),
    ).toEqual([
      'BASE_CAPACITY_COMPLETION_BELOW_MINIMUM',
      'TEAM_BASE_CAPACITY_COMPLETION_RATE_BELOW_MINIMUM',
      'OVERSIGNINGS_PER_TEAM_SEASON_OUT_OF_RANGE',
      'ALL_FOUR_OVERSIGNS_RATE_ABOVE_MAXIMUM',
      'WALK_ONS_PER_TEAM_SEASON_ABOVE_MAXIMUM',
      'WALK_ON_TEAM_SEASON_RATE_ABOVE_MAXIMUM',
      'PRESTIGE_CLASS_SCORE_CORRELATION_OUT_OF_RANGE',
      'PRESTIGE_MOBILITY_RATE_OUT_OF_RANGE',
    ]);
    expect(
      evaluateRecruitingBalance({
        ...outside,
        signingDayShare: 0,
        prestigeClassScoreCorrelation: 0,
      }).every(violation => Number.isFinite(violation.actual)),
    ).toBe(true);
  });

  it('summarizes supply and class sizes with stable empty handling', () => {
    expect(buildCountDistribution([18, 20, 22])).toMatchObject({
      count: 3,
      minimum: 18,
      median: 20,
      maximum: 22,
      mean: 20,
    });
    expect(buildCountDistribution([])).toEqual({
      count: 0,
      minimum: 0,
      p10: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      maximum: 0,
      mean: 0,
    });
    expect(
      buildRecruitingSupplySummary(
        [
          { stars: 3, signed: true },
          { stars: 3, signed: false },
          { stars: 2, signed: false },
        ],
        [2, 3, 4],
        prospect => prospect.stars,
        prospect => prospect.signed,
      ),
    ).toEqual({
      2: { available: 1, signed: 0, unsigned: 1, signingRate: 0 },
      3: { available: 2, signed: 1, unsigned: 1, signingRate: 0.5 },
      4: { available: 0, signed: 0, unsigned: 0, signingRate: 0 },
    });
  });

  it('reports stable class-score distribution and tie diagnostics', () => {
    expect(buildClassScoreDistribution([10.01, 10.04, 20, 30])).toEqual({
      teams: 4,
      minimum: 10.01,
      p10: 10.01,
      p25: 10.04,
      median: 20,
      p75: 20,
      p90: 30,
      maximum: 30,
      mean: 17.5125,
      standardDeviation: 8.280264,
      exactDistinctScores: 4,
      displayedDistinctScores: 3,
      exactTieRate: 0,
      displayedTieRate: 0.25,
    });
    expect(buildClassScoreDistribution([]).teams).toBe(0);
  });

  it('reports top-25 composition and appearance rates by prestige', () => {
    expect(
      buildTop25ClassComposition([
        { classRank: 1, prestigeBefore: 7 },
        { classRank: 2, prestigeBefore: 7 },
        { classRank: 20, prestigeBefore: 3 },
        { classRank: 40, prestigeBefore: 3 },
      ]),
    ).toEqual({
      3: {
        eligibleTeamSeasons: 2,
        appearances: 1,
        compositionShare: 0.333333,
        appearanceRate: 0.5,
      },
      7: {
        eligibleTeamSeasons: 2,
        appearances: 2,
        compositionShare: 0.666667,
        appearanceRate: 1,
      },
    });
  });
});
