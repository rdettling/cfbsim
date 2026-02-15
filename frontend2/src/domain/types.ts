export interface Conference {
  id: number;
  confName: string;
  confFullName: string;
  confGames: number;
  info: string;
  championship: null | any;
  teams: Team[];
}

export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  confGames: number;
  confLimit: number;
  nonConfGames: number;
  nonConfLimit: number;
  prestige: number;
  prestige_change?: number;
  ceiling: number;
  floor: number;
  mascot: string;
  ranking: number;
  offense: number;
  defense: number;
  colorPrimary: string;
  colorSecondary: string;
  conference: string;
  confName?: string;
  confWins: number;
  confLosses: number;
  nonConfWins: number;
  nonConfLosses: number;
  rating: number;
  totalWins: number;
  totalLosses: number;
  gamesPlayed: number;
  record: string;
  movement: number;
  poll_score: number;
  strength_of_record: number;
  last_rank?: number;
  last_game: ScheduleGame | null;
  next_game: ScheduleGame | null;
}

export interface Info {
  currentWeek: number;
  currentYear: number;
  stage: string;
  team: string;
  lastWeek: number;
  colorPrimary?: string;
  colorSecondary?: string;
}

export interface ScheduleGame {
  weekPlayed: number;
  opponent: {
    name: string;
    rating: number;
    ranking: number;
    record: string;
  } | null;
  label?: string;
  result: string;
  score: string;
  spread: string;
  moneyline: string;
  id: string;
  location?: 'Home' | 'Away' | 'Neutral';
}
