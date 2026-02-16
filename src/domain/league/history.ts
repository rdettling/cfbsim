import type { LeagueState } from '../../types/league';
import type { HistoryData } from '../../types/baseData';

const normalizeConferenceKey = (confName: string | null | undefined) =>
  confName && confName.length ? confName : 'Independent';

const getNextConfId = (confIndex: Record<string, number>) => {
  const ids = Object.values(confIndex);
  return ids.length ? Math.max(...ids) + 1 : 1;
};

export const updateHistoryForSeason = (
  league: LeagueState,
  historyData: HistoryData
) => {
  const year = league.info.currentYear;

  const confIndex = { ...historyData.conf_index };
  let nextConfId = getNextConfId(confIndex);

  const teams = { ...historyData.teams };
  league.teams.forEach(team => {
    const confName = normalizeConferenceKey(team.conference);
    if (!(confName in confIndex)) {
      confIndex[confName] = nextConfId;
      nextConfId += 1;
    }

    const confId = confIndex[confName];
    const entry = [
      year,
      confId,
      team.ranking ?? 0,
      team.totalWins ?? 0,
      team.totalLosses ?? 0,
      team.prestige ?? 0,
    ];

    const historyRows = teams[team.name] ? [...teams[team.name]] : [];
    const existingIndex = historyRows.findIndex(row => row[0] === year);
    if (existingIndex >= 0) {
      historyRows[existingIndex] = entry;
    } else {
      historyRows.push(entry);
    }
    teams[team.name] = historyRows;
  });

  const years = historyData.years.includes(year)
    ? historyData.years.slice()
    : [...historyData.years, year];
  years.sort((a, b) => b - a);

  return {
    ...historyData,
    conf_index: confIndex,
    teams,
    years,
  };
};
