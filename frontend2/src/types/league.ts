import type { Conference, Info, ScheduleGame, Team, Settings, PreviewData } from './domain';

export interface LaunchProps {
  years: string[];
  info: Info | null;
  preview: PreviewData | null;
  selected_year?: string | null;
}

export interface NonConData {
  info: Info;
  team: Team;
  schedule: ScheduleGame[];
  pending_rivalries: Array<{
    id: number;
    teamA: string;
    teamB: string;
    name: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
  }>;
  conferences: Conference[];
}

export interface PlayoffState {
  seeds: number[];
  left_r1_1?: number;
  left_r1_2?: number;
  right_r1_1?: number;
  right_r1_2?: number;
  left_quarter_1?: number;
  left_quarter_2?: number;
  right_quarter_1?: number;
  right_quarter_2?: number;
  left_semi?: number;
  right_semi?: number;
  natty?: number;
}

export interface LeagueState {
  info: Info;
  teams: Team[];
  conferences: Conference[];
  pending_rivalries: NonConData['pending_rivalries'];
  scheduleBuilt?: boolean;
  simInitialized?: boolean;
  settings?: Settings;
  playoff?: PlayoffState;
  idCounters?: {
    game: number;
    drive: number;
    play: number;
    gameLog: number;
    player: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  playoff_teams: 12,
  playoff_autobids: 6,
  playoff_conf_champ_top_4: true,
  auto_realignment: true,
  auto_update_postseason_format: true,
};

export const ensureSettings = (league: LeagueState) => {
  if (!league.settings) {
    league.settings = { ...DEFAULT_SETTINGS };
    return true;
  }
  return false;
};
