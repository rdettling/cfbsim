export interface SeasonData {
  year: number;
  playoff: {
    teams: number;
    conf_champ_autobids: number;
    conf_champ_top_4: boolean;
  };
  conferences: Record<string, { games: number; teams: Record<string, number> }>;
  independents: Record<string, number>;
  results: Record<
    string,
    {
      rank: number;
      wins: number;
      losses: number;
    }
  > | null;
}

export interface SeasonIndexData {
  years: string[];
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

export type HistoryRow = [
  year: number,
  conferenceId: number,
  rank: number,
  wins: number,
  losses: number,
  prestige: number,
];

export interface HistoryData {
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

export interface WeightedNameEntry {
  name: string;
  weight: number;
}

export interface NamesData {
  profiles: Record<
    string,
    {
      first: WeightedNameEntry[];
      last: WeightedNameEntry[];
    }
  >;
  positionWeights: Record<string, Record<string, number>>;
}

export type StatesData = Record<string, number>;

export interface BettingOddsEntry {
  favSpread: string;
  udSpread: string;
  favWinProb: number;
  udWinProb: number;
  favMoneyline: string;
  udMoneyline: string;
}

export interface BettingOddsData {
  seed: number;
  test_simulations: number;
  max_diff: number;
  odds: Record<string, BettingOddsEntry>;
}
