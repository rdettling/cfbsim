import type { LeagueState } from '../../types/league';
import type {
  HistoryData,
  PrestigeConfig,
  TeamsData,
} from '../../types/baseData';
import { PRESTIGE_WINDOW_SEASONS } from '../../constants/prestige';

export interface PrestigeFinishObservation {
  year: number;
  rank: number;
  teamCount: number;
}

export interface PrestigeProgramInput {
  id: number;
  name: string;
  currentPrestige: number;
  floor: number;
  ceiling: number;
  observations: PrestigeFinishObservation[];
}

export interface PrestigeWindowMetrics {
  score: number | null;
  averageRank: number | null;
  seasons: number;
}

export interface PrestigeProgramEvaluation extends PrestigeWindowMetrics {
  id: number;
  name: string;
  currentPrestige: number;
  rawTargetPrestige: number;
  targetPrestige: number;
  change: number;
}

export interface PrestigeChangeEvaluation {
  currentPrestige: number;
  targetPrestige: number;
  change: number;
  before: PrestigeWindowMetrics;
  after: PrestigeWindowMetrics;
}

export type PrestigeChanges = Record<string, PrestigeChangeEvaluation>;

const PRESTIGE_TIERS_DESCENDING = [7, 6, 5, 4, 3, 2, 1] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const normalizePrestigeFinish = (rank: number, teamCount: number) => {
  if (teamCount <= 1) return 100;
  return (100 * (teamCount - rank)) / (teamCount - 1);
};

const calculateWindowMetrics = (
  observations: PrestigeFinishObservation[],
): PrestigeWindowMetrics => {
  if (!observations.length) {
    return { score: null, averageRank: null, seasons: 0 };
  }
  return {
    score:
      observations.reduce(
        (sum, observation) =>
          sum + normalizePrestigeFinish(observation.rank, observation.teamCount),
        0,
      ) / observations.length,
    averageRank:
      observations.reduce((sum, observation) => sum + observation.rank, 0) /
      observations.length,
    seasons: observations.length,
  };
};

const latestRank = (observations: PrestigeFinishObservation[]) =>
  observations.reduce(
    (latest, observation) =>
      observation.year > latest.year ? observation : latest,
    { year: Number.NEGATIVE_INFINITY, rank: Number.POSITIVE_INFINITY, teamCount: 0 },
  ).rank;

export const evaluatePrestigePrograms = (
  programs: PrestigeProgramInput[],
  prestigeConfig: PrestigeConfig,
): PrestigeProgramEvaluation[] => {
  const evaluated = programs.map(program => ({
    ...program,
    ...calculateWindowMetrics(program.observations),
    latestRank: latestRank(program.observations),
    rawTargetPrestige: 1,
  }));
  evaluated.sort(
    (left, right) =>
      (right.score ?? Number.NEGATIVE_INFINITY) -
        (left.score ?? Number.NEGATIVE_INFINITY) ||
      left.latestRank - right.latestRank ||
      left.name.localeCompare(right.name),
  );

  let start = 0;
  let cumulativePercentage = 0;
  PRESTIGE_TIERS_DESCENDING.forEach((tier, index) => {
    cumulativePercentage += prestigeConfig[String(tier)] ?? 0;
    const end = index === PRESTIGE_TIERS_DESCENDING.length - 1
      ? evaluated.length
      : Math.round((cumulativePercentage / 100) * evaluated.length);
    for (let position = start; position < end; position += 1) {
      evaluated[position].rawTargetPrestige = tier;
    }
    start = end;
  });

  return evaluated.map(program => {
    const boundedCurrent = clamp(
      program.currentPrestige,
      program.floor,
      program.ceiling,
    );
    const targetPrestige = program.seasons
      ? clamp(program.rawTargetPrestige, program.floor, program.ceiling)
      : boundedCurrent;
    return {
      id: program.id,
      name: program.name,
      currentPrestige: program.currentPrestige,
      rawTargetPrestige: program.rawTargetPrestige,
      targetPrestige,
      change: targetPrestige - program.currentPrestige,
      score: program.score,
      averageRank: program.averageRank,
      seasons: program.seasons,
    };
  });
};

const buildHistoricalTeamCounts = (historyData: HistoryData) => {
  const teamsByYear = new Map<number, Set<string>>();
  Object.entries(historyData.teams).forEach(([teamName, rows]) => {
    rows.forEach(([year]) => {
      const teams = teamsByYear.get(year) ?? new Set<string>();
      teams.add(teamName);
      teamsByYear.set(year, teams);
    });
  });
  return new Map(
    [...teamsByYear].map(([year, teams]) => [year, teams.size]),
  );
};

export const calculateStartingPrestiges = ({
  year,
  teamNames,
  historyData,
  teamsData,
  prestigeConfig,
}: {
  year: number;
  teamNames: string[];
  historyData: HistoryData;
  teamsData: TeamsData;
  prestigeConfig: PrestigeConfig;
}): Record<string, number> => {
  const historicalTeamCounts = buildHistoricalTeamCounts(historyData);
  const evaluations = evaluatePrestigePrograms(
    teamNames.map((name, index) => {
      const metadata = teamsData.teams[name];
      if (!metadata) throw new Error(`${name} is missing program metadata.`);
      const observations = (historyData.teams[name] ?? [])
        .filter(([observationYear, , rank]) =>
          observationYear >= year - PRESTIGE_WINDOW_SEASONS &&
          observationYear < year &&
          rank > 0
        )
        .map(([observationYear, , rank]) => ({
          year: observationYear,
          rank,
          teamCount: historicalTeamCounts.get(observationYear) ?? teamNames.length,
        }));
      return {
        id: index + 1,
        name,
        currentPrestige: Math.round((metadata.floor + metadata.ceiling) / 2),
        floor: metadata.floor,
        ceiling: metadata.ceiling,
        observations,
      };
    }),
    prestigeConfig,
  );
  return Object.fromEntries(
    evaluations.map(evaluation => [evaluation.name, evaluation.targetPrestige]),
  );
};

const collectObservations = (
  league: LeagueState,
  historyData: HistoryData,
  historicalTeamCounts: Map<number, number>,
  startYear: number,
  endYear: number,
) =>
  new Map(
    league.teams.map(team => {
      const observations = (historyData.teams[team.name] ?? [])
        .filter(([year, , rank]) =>
          year >= startYear &&
          year <= endYear &&
          year !== league.info.currentYear &&
          rank > 0
        )
        .map(([year, , rank]) => ({
          year,
          rank,
          teamCount: historicalTeamCounts.get(year) ?? league.teams.length,
        }));
      if (
        league.info.currentYear >= startYear &&
        league.info.currentYear <= endYear &&
        team.ranking > 0
      ) {
        observations.push({
          year: league.info.currentYear,
          rank: team.ranking,
          teamCount: league.teams.length,
        });
      }
      return [team.name, observations] as const;
    }),
  );

export const calculatePrestigeChanges = (
  league: LeagueState,
  historyData: HistoryData,
  prestigeConfig: PrestigeConfig,
): PrestigeChanges => {
  const currentYear = league.info.currentYear;
  const historicalTeamCounts = buildHistoricalTeamCounts(historyData);
  const beforeObservations = collectObservations(
    league,
    historyData,
    historicalTeamCounts,
    currentYear - PRESTIGE_WINDOW_SEASONS,
    currentYear - 1,
  );
  const afterObservations = collectObservations(
    league,
    historyData,
    historicalTeamCounts,
    currentYear - (PRESTIGE_WINDOW_SEASONS - 1),
    currentYear,
  );
  const beforeMetrics = new Map(
    league.teams.map(team => [
      team.name,
      calculateWindowMetrics(beforeObservations.get(team.name) ?? []),
    ]),
  );
  const after = evaluatePrestigePrograms(
    league.teams.map(team => ({
      id: team.id,
      name: team.name,
      currentPrestige: team.prestige,
      floor: team.floor,
      ceiling: team.ceiling,
      observations: afterObservations.get(team.name) ?? [],
    })),
    prestigeConfig,
  );

  return Object.fromEntries(
    after.map(program => [
      program.name,
      {
        currentPrestige: program.currentPrestige,
        targetPrestige: program.targetPrestige,
        change: program.change,
        before: beforeMetrics.get(program.name) ?? {
          score: null,
          averageRank: null,
          seasons: 0,
        },
        after: {
          score: program.score,
          averageRank: program.averageRank,
          seasons: program.seasons,
        },
      },
    ]),
  );
};

export const applyPrestigeChanges = (
  league: LeagueState,
  changes: PrestigeChanges,
) => {
  league.teams.forEach(team => {
    const evaluation = changes[team.name];
    if (evaluation) team.prestige = evaluation.targetPrestige;
  });
};
