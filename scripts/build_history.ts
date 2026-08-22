/// <reference types="node" />
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSeasonData } from '../src/domain/seasonDataValidation';
import {
  validatePrestigeConfig,
  validateTeamsData,
} from '../src/domain/baseDataValidation';
import { calculateStartingPrestiges } from '../src/domain/league/prestige';
import type {
  HistoryData,
  SeasonIndexData,
  SeasonData,
} from '../src/types/baseData';
import { DATA_ROOT, readJson } from './data_files';

const getSeasonTeamNames = (season: SeasonData) => [
  ...Object.values(season.conferences).flatMap(conference => conference.teams),
  ...season.independents,
];

const getConference = (teamName: string, season: SeasonData) => {
  for (const [conferenceName, conference] of Object.entries(season.conferences)) {
    if (conference.teams.includes(teamName)) return conferenceName;
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
    for (const teamName of Object.keys(season.results)) {
      getConferenceId(getConference(teamName, season));
    }
  }

  const [teamsData, prestigeConfig] = await Promise.all([
    readJson<unknown>(join(dataRoot, 'teams.json')).then(value =>
      validateTeamsData(value, 'teams.json')),
    readJson<unknown>(join(dataRoot, 'prestige_config.json')).then(value =>
      validatePrestigeConfig(value, 'prestige_config.json')),
  ]);

  for (const season of completedSeasons.slice().reverse()) {
    const prestigeByTeam = calculateStartingPrestiges({
      year: season.year,
      teamNames: getSeasonTeamNames(season),
      historyData: {
        years: completedSeasons
          .map(candidate => candidate.year)
          .filter(year => year < season.year),
        conf_index: Object.fromEntries(confIndex),
        teams: historyByTeam,
      },
      teamsData,
      prestigeConfig,
    });
    const orderedResults = Object.entries(season.results)
      .sort(([, left], [, right]) => left.rank - right.rank);
    for (const [teamName, result] of orderedResults) {
      const prestige = prestigeByTeam[teamName];
      if (prestige === undefined) {
        throw new Error(
          `Season ${season.year}: calculated Prestige is missing for ${teamName}.`,
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

  Object.values(historyByTeam).forEach(rows =>
    rows.sort(([leftYear], [rightYear]) => rightYear - leftYear));
  const orderedHistoryByTeam: HistoryData['teams'] = {};
  for (const season of completedSeasons) {
    Object.entries(season.results)
      .sort(([, left], [, right]) => left.rank - right.rank)
      .forEach(([teamName]) => {
        if (!orderedHistoryByTeam[teamName]) {
          orderedHistoryByTeam[teamName] = historyByTeam[teamName];
        }
      });
  }

  return {
    years,
    conf_index: Object.fromEntries(confIndex),
    teams: orderedHistoryByTeam,
  };
};
