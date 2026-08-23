import { readFileSync } from 'node:fs';
import type {
  HistoricalGamesSeason,
  SeasonData,
} from '../../../src/types/baseData';

export const SEASON_BALANCE_REFERENCE_YEARS = [
  2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2025,
] as const;

export const SEASON_BALANCE_MODERN_REFERENCE_YEARS = [
  2022, 2023, 2025,
] as const;

const MINIMUM_FBS_GAMES = 8;
const SIMULATED_FBS_GAMES = 12;

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export interface SeasonBalanceHistoricalSeason {
  year: number;
  averageFbsGames: number;
  undefeatedTeams: number;
  oneLossOrBetterTeams: number;
  top5AverageLosses: number;
  top10AverageLosses: number;
  top25AverageLosses: number;
  top5TwelveGameEquivalentLosses: number;
  top10TwelveGameEquivalentLosses: number;
  top25TwelveGameEquivalentLosses: number;
}

export interface SeasonBalanceHistoricalPeriod {
  years: number[];
  seasons: number;
  averageFbsGames: number;
  meanUndefeatedTeams: number;
  meanOneLossOrBetterTeams: number;
  top5AverageLosses: number;
  top10AverageLosses: number;
  top25AverageLosses: number;
  top5TwelveGameEquivalentLosses: number;
  top10TwelveGameEquivalentLosses: number;
  top25TwelveGameEquivalentLosses: number;
}

export interface SeasonBalanceHistoricalReference {
  methodology: {
    minimumFbsGames: 8;
    simulatedFbsGames: 12;
    recordScope: 'completed regular-season FBS-vs-FBS games';
    rankedCohort: 'bundled final ranking';
    twelveGameEquivalent: 'each ranked team losses * 12 / FBS games';
  };
  all: SeasonBalanceHistoricalPeriod;
  modern: SeasonBalanceHistoricalPeriod;
  bySeason: SeasonBalanceHistoricalSeason[];
}

const loadHistoricalSeason = (year: number): SeasonBalanceHistoricalSeason => {
  const season = readJson<SeasonData>(`../../../public/data/seasons/${year}.json`);
  const historical = readJson<HistoricalGamesSeason>(
    `../../../public/data/historical-games/${year}.json`,
  );
  if (!season.results) throw new Error(`Season ${year} is missing final results.`);
  const fbsTeams = new Set([
    ...Object.values(season.conferences).flatMap(conference => conference.teams),
    ...season.independents,
  ]);
  const records = new Map(
    [...fbsTeams].map(team => [team, { games: 0, losses: 0 }]),
  );
  historical.games.forEach(game => {
    if (
      game.seasonType !== 'regular' ||
      !fbsTeams.has(game.homeTeam) ||
      !fbsTeams.has(game.awayTeam)
    ) return;
    const home = records.get(game.homeTeam)!;
    const away = records.get(game.awayTeam)!;
    home.games += 1;
    away.games += 1;
    if (game.homeScore > game.awayScore) away.losses += 1;
    else home.losses += 1;
  });
  const eligible = [...records.entries()]
    .filter(([, record]) => record.games >= MINIMUM_FBS_GAMES);
  const ranked = Object.entries(season.results)
    .sort((left, right) => left[1].rank - right[1].rank);
  const rankedRecords = (count: number) => ranked.slice(0, count).map(([team]) => {
    const record = records.get(team);
    if (!record?.games) {
      throw new Error(`Season ${year} final ranking contains team without FBS games: ${team}.`);
    }
    return record;
  });
  const rankedLossAverage = (count: number) => mean(
    rankedRecords(count).map(record => record.losses),
  );
  const twelveGameEquivalent = (count: number) => mean(
    rankedRecords(count).map(record =>
      record.losses * SIMULATED_FBS_GAMES / record.games),
  );
  return {
    year,
    averageFbsGames: round(mean(eligible.map(([, record]) => record.games))),
    undefeatedTeams: eligible.filter(([, record]) => record.losses === 0).length,
    oneLossOrBetterTeams: eligible.filter(([, record]) => record.losses <= 1).length,
    top5AverageLosses: round(rankedLossAverage(5)),
    top10AverageLosses: round(rankedLossAverage(10)),
    top25AverageLosses: round(rankedLossAverage(25)),
    top5TwelveGameEquivalentLosses: round(twelveGameEquivalent(5)),
    top10TwelveGameEquivalentLosses: round(twelveGameEquivalent(10)),
    top25TwelveGameEquivalentLosses: round(twelveGameEquivalent(25)),
  };
};

const summarize = (
  rows: SeasonBalanceHistoricalSeason[],
): SeasonBalanceHistoricalPeriod => ({
  years: rows.map(row => row.year),
  seasons: rows.length,
  averageFbsGames: round(mean(rows.map(row => row.averageFbsGames))),
  meanUndefeatedTeams: round(mean(rows.map(row => row.undefeatedTeams))),
  meanOneLossOrBetterTeams: round(mean(rows.map(row => row.oneLossOrBetterTeams))),
  top5AverageLosses: round(mean(rows.map(row => row.top5AverageLosses))),
  top10AverageLosses: round(mean(rows.map(row => row.top10AverageLosses))),
  top25AverageLosses: round(mean(rows.map(row => row.top25AverageLosses))),
  top5TwelveGameEquivalentLosses: round(mean(
    rows.map(row => row.top5TwelveGameEquivalentLosses),
  )),
  top10TwelveGameEquivalentLosses: round(mean(
    rows.map(row => row.top10TwelveGameEquivalentLosses),
  )),
  top25TwelveGameEquivalentLosses: round(mean(
    rows.map(row => row.top25TwelveGameEquivalentLosses),
  )),
});

export const loadSeasonBalanceHistoricalReference = (): SeasonBalanceHistoricalReference => {
  const bySeason = SEASON_BALANCE_REFERENCE_YEARS.map(loadHistoricalSeason);
  const modernYears = new Set<number>(SEASON_BALANCE_MODERN_REFERENCE_YEARS);
  return {
    methodology: {
      minimumFbsGames: MINIMUM_FBS_GAMES,
      simulatedFbsGames: SIMULATED_FBS_GAMES,
      recordScope: 'completed regular-season FBS-vs-FBS games',
      rankedCohort: 'bundled final ranking',
      twelveGameEquivalent: 'each ranked team losses * 12 / FBS games',
    },
    all: summarize(bySeason),
    modern: summarize(bySeason.filter(row => modernYears.has(row.year))),
    bySeason,
  };
};
