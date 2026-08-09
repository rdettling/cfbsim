import type { Drive } from './game';

export interface LoadingDialogProps {
  open: boolean;
  message: string;
}

export interface DriveSummaryProps {
  drives: Drive[];
  currentPlayIndex?: number;
  totalPlays?: number;
  isGameComplete?: boolean;
  variant?: 'modal' | 'page';
  includeCurrentDrive?: boolean;
  matchup?: SimMatchup;
  embedded?: boolean;
}

export interface SimMatchup {
  homeTeam: {
    name: string;
    record: string;
    mascot?: string;
    colorPrimary?: string;
    colorSecondary?: string;
  };
  awayTeam: {
    name: string;
    record: string;
    mascot?: string;
    colorPrimary?: string;
    colorSecondary?: string;
  };
  homeScore: number;
  awayScore: number;
  currentScoreA: number;
  currentScoreB: number;
  awayIsTeamA: boolean;
  isAwayOnOffense: boolean;
  currentDriveNum: number;
  quarter: number;
  clockSecondsLeft: number;
  inOvertime: boolean;
  overtimeCount: number;
}
