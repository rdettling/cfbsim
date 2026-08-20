import type { HistoryData, PrestigeConfig, TeamsData, NamesData } from '../../../src/types/baseData';
import type { PlayerRecord } from '../../../src/types/db';
import type { LeagueState } from '../../../src/types/league';
import type { RecruitingEvaluationRun, RecruitingEvaluationSeason, RecruitingEvaluationTeamYear } from './types';
import { updateHistoryForSeason } from '../../../src/domain/league/history';
import { applyPrestigeChanges, calculatePrestigeChanges } from '../../../src/domain/league/prestige';
import { buildRecruitingResults } from '../../../src/domain/league/recruitingResults';
import { applyProgression } from '../../../src/domain/roster';
import { applyRosterCutIds, assertFinalRosters, recommendRosterCuts } from '../../../src/domain/rosterCuts';
import { recalculateTeamRatings, setStarters } from '../../../src/domain/rosterRatings';
import { POSITION_ORDER } from '../../../src/domain/rosterConfig';
import { generateWalkOns } from '../../../src/domain/walkOns';
import { runAiRecruitingCycle } from './aiCycle';
import { calculateRecruitingClassScore } from '../../../src/domain/recruiting/classScoring';
import { RECRUITING, RECRUIT_STAR_COUNTS, type RecruitStarCounts } from '../../../src/domain/recruiting/config';
import { buildRecruitingContext } from '../../../src/domain/recruiting/context';
import { buildCommittedFreshmen } from '../../../src/domain/recruiting/freshmen';
import { generateProspectPool } from '../../../src/domain/recruiting/generation';
import { createSeededRandom } from '../../../src/domain/utils/random';
import { createTeamRecruitingStates } from '../../../src/domain/recruiting/state';
import {
  assertStarters,
  buildClassScoreDistribution,
  buildCountDistribution,
  buildPrestigeSummaries,
  buildRecruitingSupplySummary,
  buildTop25ClassComposition,
  countBy,
  evaluationChecksum,
  mean,
  pearsonCorrelation,
  round,
} from './evaluationMetrics';
export interface EvaluateRunInput {
  league: LeagueState;
  players: PlayerRecord[];
  names: NamesData;
  states: Record<string, number>;
  history: HistoryData;
  teamsData: TeamsData;
  prestigeConfig: PrestigeConfig;
  seed: number;
  seasons: number;
  startYear: number;
  recruitStarCounts?: RecruitStarCounts;
}

export const runRecruitingEvaluation = ({
  league: sourceLeague,
  players: sourcePlayers,
  names,
  states,
  history: sourceHistory,
  teamsData,
  prestigeConfig,
  seed,
  seasons,
  startYear,
  recruitStarCounts = RECRUIT_STAR_COUNTS,
}: EvaluateRunInput): RecruitingEvaluationRun => {
  const league = structuredClone(sourceLeague);
  const players = structuredClone(sourcePlayers);
  let history = structuredClone(sourceHistory);
  const initialPrestige = new Map(
    league.teams.map(team => [team.id, team.prestige]),
  );
  const seasonReports: RecruitingEvaluationSeason[] = [];
  let nextPlayerId = Math.max(
    league.idCounters.player,
    ...players.map(player => player.id + 1),
  );

  for (let offset = 0; offset < seasons; offset += 1) {
    const year = startYear + offset;
    league.info.currentYear = year;
    applyProgression(players);
    const yearSeed = createSeededRandom(seed)
      .fork(`recruiting-year:${year}`)
      .int(0, 0xffff_ffff);
    const context = buildRecruitingContext(league.teams, players);
    const initialState = {
      year,
      round: 1 as const,
      status: 'active' as const,
      seed: yearSeed,
      prospects: generateProspectPool({
        teams: league.teams,
        returningPlayers: players,
        names,
        states,
        year,
        seed: yearSeed,
        starCounts: recruitStarCounts,
      }),
      teams: createTeamRecruitingStates(league.teams, context),
    };
    const cycle = runAiRecruitingCycle(initialState, context);
    const committedProspectIds = cycle.commitments.map(
      commitment => commitment.prospectId,
    );
    if (
      new Set(committedProspectIds).size !== committedProspectIds.length
    ) {
      throw new Error('Evaluation produced a duplicate prospect commitment.');
    }
    cycle.state.teams.forEach(team => {
      if (team.commitmentIds.length > team.oversignCapacity) {
        throw new Error(
          `Team ${team.teamId} exceeded its signing capacity in evaluation.`,
        );
      }
    });
    const converted = buildCommittedFreshmen({
      prospects: cycle.state.prospects,
      existingPlayers: players,
      nextPlayerId,
      acquisitionYear: year,
    });
    if (converted.players.length !== committedProspectIds.length) {
      throw new Error(
        'Evaluation freshman conversion did not match the committed class.',
      );
    }
    players.push(...converted.players);
    nextPlayerId = converted.nextPlayerId;
    if (new Set(players.map(player => player.id)).size !== players.length) {
      throw new Error('Evaluation produced duplicate player IDs.');
    }
    if (
      nextPlayerId <=
      players.reduce((highest, player) => Math.max(highest, player.id), 0)
    ) {
      throw new Error('Evaluation player ID cursor did not advance.');
    }
    const classResults = buildRecruitingResults(
      league.teams,
      cycle.state.prospects,
      league.teams[0].id,
    );
    const classByTeam = new Map(
      classResults.teamRankings.map(result => [result.teamId, result]),
    );
    const prestigeBefore = new Map(
      league.teams.map(team => [team.id, team.prestige]),
    );
    const publicByTeam = new Map<number, number[]>();
    cycle.state.prospects.forEach(prospect => {
      if (prospect.committedTeamId === null) return;
      const values = publicByTeam.get(prospect.committedTeamId) ?? [];
      values.push((prospect.publicRatingMin + prospect.publicRatingMax) / 2);
      publicByTeam.set(prospect.committedTeamId, values);
    });

    const walkOns = generateWalkOns({
      teams: league.teams,
      players,
      names,
      year,
      seed: yearSeed,
      nextPlayerId,
    });
    players.push(...walkOns.players);
    nextPlayerId = walkOns.nextPlayerId;
    const cuts = league.teams.flatMap(team =>
      recommendRosterCuts({
        players,
        teamId: team.id,
        year,
        seed: yearSeed,
        selectedCutIds: [],
      }),
    );
    const arrivingFreshmen = new Set(
      [...converted.players, ...walkOns.players].map(player => player.id),
    );
    if (cuts.some(player => arrivingFreshmen.has(player.id))) {
      throw new Error('Evaluation attempted to cut an arriving freshman.');
    }
    applyRosterCutIds(
      players,
      cuts.map(player => player.id),
    );
    assertFinalRosters(league.teams, players);
    setStarters(league.teams, players);
    assertStarters(league, players);
    recalculateTeamRatings(
      league.teams,
      players,
      createSeededRandom(yearSeed)
        .fork(`roster-finalization:${year}`)
        .fork('team-ratings'),
    );

    calculatePrestigeChanges(league, history, teamsData, prestigeConfig);
    history = updateHistoryForSeason(league, history);
    applyPrestigeChanges(league);
    const prestigeAfter = new Map(
      league.teams.map(team => [team.id, team.prestige]),
    );
    const aiTeams = new Map(
      cycle.report.teams.map(team => [team.teamId, team]),
    );
    const teams: RecruitingEvaluationTeamYear[] = league.teams
      .map(team => {
        const recruiting = aiTeams.get(team.id)!;
        const classResult = classByTeam.get(team.id);
        const teamWalkOns = walkOns.players.filter(
          player => player.teamId === team.id,
        );
        const teamCuts = cuts.filter(player => player.teamId === team.id);
        return {
          teamId: team.id,
          teamName: team.name,
          prestigeBefore: prestigeBefore.get(team.id)!,
          prestigeAfter: prestigeAfter.get(team.id)!,
          classRank: classResult?.rank ?? league.teams.length + 1,
          classScore: classResult?.classScore ?? 0,
          classScoreExact: classResult
            ? round(calculateRecruitingClassScore(classResult.recruits))
            : 0,
          signed: recruiting.signings,
          baseCapacity: recruiting.baseCapacity,
          baseSignings: recruiting.baseSignings,
          oversignings: recruiting.oversignings,
          walkOns: teamWalkOns.length,
          cuts: teamCuts.length,
          averagePublicRating: round(mean(publicByTeam.get(team.id) ?? [])),
          stars: classResult
            ? {
                1: classResult.starCounts.one,
                2: classResult.starCounts.two,
                3: classResult.starCounts.three,
                4: classResult.starCounts.four,
                5: classResult.starCounts.five,
              }
            : ({} as Record<number, number>),
          rosterRating: team.rating,
        };
      })
      .sort((left, right) => left.teamId - right.teamId);

    const elite = cycle.state.prospects.filter(
      prospect => prospect.committedTeamId !== null && prospect.stars >= 4,
    );
    const ratingValues = teams.map(team => team.rosterRating);
    const totalBase = teams.reduce((sum, team) => sum + team.baseCapacity, 0);
    const totalBaseSignings = teams.reduce(
      (sum, team) => sum + team.baseSignings,
      0,
    );
    const totalCommitments = Object.values(
      cycle.report.commitmentsByRound,
    ).reduce((sum, count) => sum + count, 0);
    const seasonWithoutChecksum = {
      year,
      seed: yearSeed,
      commitmentsByRound: cycle.report.commitmentsByRound,
      signingDayShare:
        totalCommitments > 0
          ? cycle.report.commitmentsByRound.signing_day / totalCommitments
          : 0,
      averageBudgetUse: round(cycle.report.averageBudgetUse),
      targetsLost: cycle.report.targetsLost,
      targetsAdded: cycle.report.targetsAdded,
      targetsRemoved: cycle.report.targetsRemoved,
      meaningfulPursuits: cycle.report.meaningfulPursuits,
      meaningfullyPursuedProspects:
        cycle.report.meaningfullyPursuedProspects,
      contestedMeaningfulProspects:
        cycle.report.contestedMeaningfulProspects,
      meaningfulCompetitionRate: round(
        cycle.report.meaningfulCompetitionRate,
      ),
      pursuitsAdmitted: cycle.report.pursuitsAdmitted,
      fundableOpeningsUnfilled:
        cycle.report.fundableOpeningsUnfilled,
      baseCapacityCompletion: totalBase
        ? round(totalBaseSignings / totalBase)
        : 1,
      teamsCompletingBaseCapacity: teams.filter(
        team => team.baseSignings === team.baseCapacity,
      ).length,
      teamBaseCapacityCompletionRate: round(
        teams.filter(team => team.baseSignings === team.baseCapacity).length /
          Math.max(1, teams.length),
      ),
      oversignings: teams.reduce(
        (sum, team) => sum + team.oversignings,
        0,
      ),
      teamsUsingAllFourOversigns: teams.filter(
        team => team.oversignings === RECRUITING.oversignAllowance,
      ).length,
      lowPrestigeEliteWins: elite.filter(
        prospect =>
          (prestigeBefore.get(prospect.committedTeamId!) ?? 7) <= 3,
      ).length,
      lowPrestigeEliteShare: elite.length
        ? round(
            elite.filter(
              prospect =>
                (prestigeBefore.get(prospect.committedTeamId!) ?? 7) <= 3,
            ).length / elite.length,
          )
        : 0,
      prestigeClassScoreCorrelation: pearsonCorrelation(
        teams.map(team => team.prestigeBefore),
        teams.map(team => team.classScore),
      ),
      classScoreDistribution: buildClassScoreDistribution(
        teams.map(team => team.classScoreExact),
      ),
      classSizeDistribution: buildCountDistribution(
        teams.map(team => team.signed),
      ),
      supplyByStar: buildRecruitingSupplySummary(
        cycle.state.prospects,
        [2, 3, 4, 5],
        prospect => prospect.stars,
        prospect => prospect.committedTeamId !== null,
      ),
      supplyByPosition: buildRecruitingSupplySummary(
        cycle.state.prospects,
        POSITION_ORDER,
        prospect => prospect.position,
        prospect => prospect.committedTeamId !== null,
      ),
      top25ClassComposition: buildTop25ClassComposition(teams),
      walkOnsByPosition: countBy(walkOns.players, player => player.pos),
      walkOnsByPrestige: countBy(
        walkOns.players,
        player => String(prestigeBefore.get(player.teamId) ?? 0),
      ),
      cutsByPosition: countBy(cuts, player => player.pos),
      cutsByClass: countBy(cuts, player => player.year),
      averageCutRating: round(mean(cuts.map(player => player.rating))),
      averageCutSeniorRating: round(
        mean(cuts.map(player => player.rating_sr)),
      ),
      teamsOversigningWithoutCuts: teams.filter(
        team => team.oversignings > 0 && team.cuts === 0,
      ).length,
      ratingSpread:
        ratingValues.length
          ? Math.max(...ratingValues) - Math.min(...ratingValues)
          : 0,
      prestigePromotions: teams.filter(
        team => team.prestigeAfter > team.prestigeBefore,
      ).length,
      prestigeDemotions: teams.filter(
        team => team.prestigeAfter < team.prestigeBefore,
      ).length,
      prestigeUnchanged: teams.filter(
        team => team.prestigeAfter === team.prestigeBefore,
      ).length,
      structuralViolations: [] as string[],
      warnings: [
        ...(cycle.report.signingDayShare > 0.9
          ? ['SIGNING_DAY_CONCENTRATION']
          : []),
        ...(teams.every(
          team => team.oversignings === RECRUITING.oversignAllowance,
        )
          ? ['UNIVERSAL_MAX_OVERSIGNING']
          : []),
        ...(walkOns.players.length > league.teams.length
          ? ['EXCESSIVE_WALK_ON_DEPENDENCE']
          : []),
      ],
      prestigeSummaries: buildPrestigeSummaries(teams),
      teams,
    };
    seasonReports.push({
      ...seasonWithoutChecksum,
      checksum: evaluationChecksum(seasonWithoutChecksum),
    });
  }

  const endingRatings = league.teams
    .sort((left, right) => left.id - right.id)
    .map(team => team.rating);
  const initialPrestiges = league.teams
    .sort((left, right) => left.id - right.id)
    .map(team => initialPrestige.get(team.id) ?? team.prestige);
  const firstSpread = seasonReports[0]?.ratingSpread ?? 0;
  const lastSpread =
    seasonReports[seasonReports.length - 1]?.ratingSpread ?? 0;
  const structuralViolations = seasonReports.flatMap(
    season => season.structuralViolations,
  );
  const resultWithoutChecksum = {
    seed,
    startYear,
    endYear: startYear + seasons - 1,
    seasons: seasonReports,
    initialPrestigeEndingRatingCorrelation: pearsonCorrelation(
      initialPrestiges,
      endingRatings,
    ),
    ratingSpreadChange: lastSpread - firstSpread,
    prestigeMobility: seasonReports.reduce(
      (sum, season) =>
        sum + season.prestigePromotions + season.prestigeDemotions,
      0,
    ),
    structuralViolations,
  };
  return {
    ...resultWithoutChecksum,
    checksum: evaluationChecksum(resultWithoutChecksum),
  };
};
