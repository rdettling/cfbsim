export interface Play {
  id: number;
  driveId?: number;
  down: number;
  yardsLeft: number;
  startingFP: number;
  playType: string;
  yardsGained: number;
  text: string;
  header: string;
  result: string;
  scoreA: number;
  scoreB: number;
}

export interface Drive {
  driveNum: number;
  offense: string;
  defense: string;
  startingFP: number;
  result: string;
  points: number;
  yards?: number;
  plays: Play[];
  scoreAAfter?: number;
  scoreBAfter?: number;
}

export interface GameData {
  id: number;
  base_label: string;
  headline?: string | null;
  headline_subtitle?: string | null;
  headline_tags?: string[] | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  teamA: {
    id: number;
    name: string;
    record: string;
    colorPrimary?: string;
    colorSecondary?: string;
    mascot?: string;
  };
  teamB: {
    id: number;
    name: string;
    record: string;
    colorPrimary?: string;
    colorSecondary?: string;
    mascot?: string;
  };
  scoreA: number;
  scoreB: number;
}
