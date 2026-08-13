/// <reference types="node" />
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSeasonData } from '../src/domain/seasonDataValidation';
import type {
  HistoryData,
  SeasonIndexData,
  SeasonData,
} from '../src/types/baseData';
import { DATA_ROOT, readJson } from './data_files';

const getPrestige = (teamName: string, yearData: SeasonData) => {
  for (const conference of Object.values(yearData.conferences)) {
    if (teamName in conference.teams) return conference.teams[teamName];
  }
  return yearData.independents[teamName];
};

const getConference = (teamName: string, season: SeasonData) => {
  for (const [conferenceName, conference] of Object.entries(season.conferences)) {
    if (teamName in conference.teams) return conferenceName;
  }
  return 'Independent';
};

const getSeasonYears = async (dataRoot: string) =>
  (await readdir(join(dataRoot, 'seasons')))
    .filter(name => /^\d{4}\.json$/.test(name))
    .map(name => Number(name.slice(0, 4)))
    .sort((left, right) => right - left);

export const buildSeasonIndexData = async (
  dataRoot = DATA_ROOT,
): Promise<SeasonIndexData> => ({
  years: (await getSeasonYears(dataRoot)).map(String),
});

export const buildHistoryData = async (
  dataRoot = DATA_ROOT,
): Promise<HistoryData> => {
  const seasonYears = await getSeasonYears(dataRoot);
  const seasons = await Promise.all(seasonYears.map(async year =>
    validateSeasonData(
      await readJson<unknown>(join(dataRoot, 'seasons', `${year}.json`)),
      `seasons/${year}.json`,
      year,
    ),
  ));
  const completedSeasons = seasons.filter(
    (season): season is SeasonData & { results: NonNullable<SeasonData['results']> } =>
      season.results !== null,
  );
  const years = completedSeasons.map(season => season.year);
  const historyByTeam: HistoryData['teams'] = {};
  const confIndex = new Map<string, number>();

  const getConferenceId = (name: string) => {
    const key = name || 'Independent';
    const existing = confIndex.get(key);
    if (existing !== undefined) return existing;
    const id = confIndex.size;
    confIndex.set(key, id);
    return id;
  };

  for (const season of completedSeasons) {
    const orderedResults = Object.entries(season.results)
      .sort(([, left], [, right]) => left.rank - right.rank);
    for (const [teamName, result] of orderedResults) {
      const prestige = getPrestige(teamName, season);
      if (prestige === undefined) {
        throw new Error(
          `Season ${season.year}: ${teamName} is not in the topology.`,
        );
      }
      if (!historyByTeam[teamName]) historyByTeam[teamName] = [];
      historyByTeam[teamName].push([
        season.year,
        getConferenceId(getConference(teamName, season)),
        result.rank,
        result.wins,
        result.losses,
        prestige,
      ]);
    }
  }

  return {
    years,
    conf_index: Object.fromEntries(confIndex),
    teams: historyByTeam,
  };
};
