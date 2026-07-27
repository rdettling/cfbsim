import type { Drive } from './game';

export interface TeamLinkProps {
  name: string;
  onTeamClick: (name: string) => void;
}

export interface LogoProps {
  name: string;
  size?: number;
}

export type LogoKind = 'teams' | 'conferences';

export type LogoWithTypeProps = LogoProps & { type: LogoKind };

export interface TeamInfoModalProps {
  teamName: string;
  open: boolean;
  onClose: () => void;
}

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
