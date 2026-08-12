export interface YearData {
  playoff: {
    teams: number;
    conf_champ_autobids: number;
    conf_champ_top_4: boolean;
  };
  conferences: Record<string, { games: number; teams: Record<string, number> }>;
  independents: Record<string, number>;
}

export interface TeamsData {
  teams: Record<
    string,
    {
      mascot: string;
      abbreviation: string;
      ceiling: number;
      floor: number;
      colorPrimary: string;
      colorSecondary: string;
      city: string;
      state: string;
      stadium: string;
    }
  >;
}

export type ConferencesData = Record<string, string>;

export interface SeasonResultsData {
  year: number;
  total_teams: number;
  teams: Array<{
    team: string;
    conference: string;
    rank: number;
    wins: number;
    losses: number;
  }>;
}

export type HistoryRow = [
  year: number,
  conferenceId: number,
  rank: number,
  wins: number,
  losses: number,
  prestige: number,
];

export interface HistoryData {
  generated_at: string;
  years: number[];
  conf_index: Record<string, number>;
  teams: Record<string, HistoryRow[]>;
}

export type HistoricalGameSeasonType = 'regular' | 'postseason';

export interface HistoricalGame {
  sourceId: number;
  year: number;
  weekPlayed: number;
  seasonType: HistoricalGameSeasonType;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeRank: number;
  awayRank: number;
  neutralSite: boolean;
  venue: string | null;
  name: string | null;
  label: string;
}

export interface HistoricalGamesIndex {
  generated_at: string;
  source: 'CollegeFootballData.com';
  years: number[];
}

export interface HistoricalGamesSeason {
  year: number;
  games: HistoricalGame[];
}

export interface HistoricalTeamGame {
  sourceId: number;
  year: number;
  weekPlayed: number;
  opponent: string;
  teamScore: number;
  opponentScore: number;
  label: string;
}

export interface HistoricalGamesForTeam {
  team: string;
  games: HistoricalTeamGame[];
}

export type PrestigeConfig = Record<string, number>;
