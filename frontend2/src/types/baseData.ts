export interface YearData {
  playoff: {
    teams: number;
    conf_champ_autobids?: number;
    conf_champ_top_4?: boolean;
  };
  conferences: Record<string, { games: number; teams: Record<string, number> }>;
  Independent?: Record<string, number>;
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
      city?: string;
      state?: string;
      stadium?: string;
    }
  >;
}

export type ConferencesData = Record<string, string>;

export interface RatingsData {
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

export interface HistoryData {
  generated_at: string;
  years: number[];
  conf_index: Record<string, number>;
  teams: Record<string, number[][]>;
}
