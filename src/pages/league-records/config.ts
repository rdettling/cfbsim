import type { LeagueRecordProgram } from '../../domain/league/loaders/leagueRecords';

export type LeagueRecordsSortKey =
  | 'seasons'
  | 'wins'
  | 'losses'
  | 'winPercentage'
  | 'bestSeason'
  | 'bestFinalRank'
  | 'nationalTitles'
  | 'conferenceTitles'
  | 'playoffAppearances'
  | 'bowlWins'
  | 'awardWinners';

export type LeagueRecordsSortDirection = 'asc' | 'desc';

export interface LeagueRecordsColumn {
  key: LeagueRecordsSortKey;
  label: string;
  mobileLabel: string;
  group: 'Completed Seasons' | 'Dynasty Honors';
  width: number;
}

export const LEAGUE_RECORDS_COLUMNS: LeagueRecordsColumn[] = [
  { key: 'seasons', label: 'Seasons', mobileLabel: 'Seasons', group: 'Completed Seasons', width: 82 },
  { key: 'wins', label: 'Wins', mobileLabel: 'Wins', group: 'Completed Seasons', width: 72 },
  { key: 'losses', label: 'Losses', mobileLabel: 'Losses', group: 'Completed Seasons', width: 76 },
  { key: 'winPercentage', label: 'Win %', mobileLabel: 'Win percentage', group: 'Completed Seasons', width: 86 },
  { key: 'bestSeason', label: 'Best Season', mobileLabel: 'Best season', group: 'Completed Seasons', width: 160 },
  { key: 'bestFinalRank', label: 'Best Rank', mobileLabel: 'Best final rank', group: 'Completed Seasons', width: 96 },
  { key: 'nationalTitles', label: 'National Titles', mobileLabel: 'National titles', group: 'Dynasty Honors', width: 124 },
  { key: 'conferenceTitles', label: 'Conference Titles', mobileLabel: 'Conference titles', group: 'Dynasty Honors', width: 138 },
  { key: 'playoffAppearances', label: 'Playoff Apps', mobileLabel: 'Playoff appearances', group: 'Dynasty Honors', width: 116 },
  { key: 'bowlWins', label: 'Bowl Wins', mobileLabel: 'Bowl wins', group: 'Dynasty Honors', width: 96 },
  { key: 'awardWinners', label: 'Award Winners', mobileLabel: 'Award winners', group: 'Dynasty Honors', width: 122 },
];

export const getLeagueRecordsColumn = (key: LeagueRecordsSortKey) =>
  LEAGUE_RECORDS_COLUMNS.find(column => column.key === key)!;

export const getDefaultLeagueRecordsDirection = (
  key: LeagueRecordsSortKey,
): LeagueRecordsSortDirection => key === 'bestFinalRank' ? 'asc' : 'desc';

export const formatLeagueRecordValue = (
  program: LeagueRecordProgram,
  key: LeagueRecordsSortKey,
) => {
  if (key === 'winPercentage') {
    return program.winPercentage === null ? '—' : program.winPercentage.toFixed(3).replace(/^0/, '');
  }
  if (key === 'bestFinalRank') {
    return program.bestFinalRank === null ? '—' : `#${program.bestFinalRank}`;
  }
  if (key === 'bestSeason') {
    const season = program.bestSeason;
    if (!season) return '—';
    const rank = season.finalRank === null ? '' : ` · #${season.finalRank}`;
    return `${season.year} · ${season.wins}–${season.losses}${rank}`;
  }
  return program[key].toLocaleString();
};
