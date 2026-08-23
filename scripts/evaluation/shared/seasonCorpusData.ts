import { readFileSync } from 'node:fs';
import type {
  ConferencesData,
  HistoryData,
  NamesData,
  PrestigeConfig,
  SeasonData,
  TeamsData,
} from '../../../src/types/baseData';
import { normalizeRivalriesData } from '../../../src/domain/rivalryData';
import type { SeasonCorpusData } from './seasonCorpus';

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

export const loadSeasonCorpusData = (year = 2026): SeasonCorpusData => {
  const teamsData = readJson<TeamsData>('../../../public/data/teams.json');
  return {
    yearData: readJson<SeasonData>(`../../../public/data/seasons/${year}.json`),
    teamsData,
    conferencesData: readJson<ConferencesData>('../../../public/data/conferences.json'),
    historyData: readJson<HistoryData>('../../../public/data/history.json'),
    prestigeConfig: readJson<PrestigeConfig>('../../../public/data/prestige_config.json'),
    names: readJson<NamesData>('../../../public/data/names.json'),
    states: readJson<Record<string, number>>('../../../public/data/states.json'),
    rivalries: normalizeRivalriesData(
      readJson<unknown>('../../../public/data/rivalries.json'),
      new Set(Object.keys(teamsData.teams)),
    ),
    bettingOdds: readJson<unknown>('../../../public/data/betting_odds.json'),
  };
};
