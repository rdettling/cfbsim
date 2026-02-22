import type { ReactNode } from 'react';
import type { Conference, Info, Team, ScheduleGame } from './domain';
import type { GameData, Play, Drive } from './game';

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

export interface TeamInfo {
  id: number;
  name: string;
  prestige: number;
  rating: number;
  offense: number;
  defense: number;
  mascot: string;
  colorPrimary: string;
  confWins: number;
  confLosses: number;
  totalWins: number;
  totalLosses: number;
  ranking: number;
  conference: string;
}

export interface TeamInfoModalProps {
  teamName: string;
  open: boolean;
  onClose: () => void;
}

export interface StatItemProps {
  label: string;
  value: string | number;
}

export interface ActionButtonProps {
  to: string;
  icon: string;
  label: string;
  color: string;
}

export interface NavbarProps {
  team: Team;
  currentStage: string;
  info: Info & { lastWeek: number };
  conferences: Conference[];
}

export interface PageLayoutProps {
  loading: boolean;
  error: string | null;
  navbarData?: {
    team: Team;
    currentStage: string;
    info: Info & { lastWeek: number };
    conferences: Conference[];
  };
  containerMaxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  children: ReactNode;
}

export interface SeasonBannerProps {
  info: Info & { lastWeek: number };
  primaryColor?: string;
  secondaryColor?: string;
}

export interface NonSeasonBannerProps {
  currentStage: {
    id: string;
    label: string;
    path: string;
    next: string;
    season: boolean;
  };
  nextStage: {
    id: string;
    label: string;
    path: string;
    next: string;
    season: boolean;
  };
  primaryColor?: string;
  secondaryColor?: string;
}

export interface TeamHeaderProps {
  team: Team;
  teams: string[];
  onTeamChange: (name: string) => void;
}

export interface BaseGameComponentProps {
  team: Team & {
    last_game?: any;
    next_game?: any;
  };
  onTeamClick: (name: string) => void;
}

export interface DashboardGameCardProps {
  game: ScheduleGame;
  type: 'prev' | 'curr';
  onTeamClick: (name: string) => void;
}

export interface DashboardTeamRowProps {
  team: Team;
  showRating?: boolean;
  rank?: number;
  highlight?: boolean;
  onTeamClick: (name: string) => void;
}

export interface GameSimModalProps {
  open: boolean;
  onClose: () => void;
  gameId: number | null;
  isUserGame: boolean;
}

export interface GameSelectionModalGame {
  id: number;
  teamAId?: number;
  teamBId?: number;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  neutralSite?: boolean;
  teamA: {
    name: string;
    ranking: number;
    record: string;
  };
  teamB: {
    name: string;
    ranking: number;
    record: string;
  };
  label: string;
  watchability: number;
  is_user_game?: boolean;
}

export interface GameSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onGameSelect: (gameId: number, isUserGame: boolean) => void;
}

export interface LoadingDialogProps {
  open: boolean;
  message: string;
}

export interface GamePreviewProps {
  data: {
    game: {
      id: number;
      label: string;
      weekPlayed: number;
      year: number;
      homeTeamId?: number | null;
      awayTeamId?: number | null;
      neutralSite?: boolean;
      teamA: Team;
      teamB: Team;
      rankATOG: number;
      rankBTOG: number;
      spreadA?: string;
      spreadB?: string;
      moneylineA?: string;
      moneylineB?: string;
      winProbA?: number;
      winProbB?: number;
      headline?: string | null;
    };
    preview: {
      teamA: {
        stats: {
          yards_per_game: number;
          pass_yards_per_game: number;
          pass_tds_per_game: number;
          rush_yards_per_game: number;
          turnovers_per_game: number;
          points_per_game: number;
        };
        ranks: {
          yards_per_game: number;
          pass_yards_per_game: number;
          pass_tds_per_game: number;
          rush_yards_per_game: number;
          turnovers_per_game: number;
          points_per_game: number;
        };
        topStarters: Array<{
          id: number;
          first: string;
          last: string;
          pos: string;
          rating: number;
        }>;
        keyPlayers: Array<{
          id: number;
          first: string;
          last: string;
          pos: string;
          rating: number;
          impact: number;
        }>;
      };
      teamB: {
        stats: {
          yards_per_game: number;
          pass_yards_per_game: number;
          pass_tds_per_game: number;
          rush_yards_per_game: number;
          turnovers_per_game: number;
          points_per_game: number;
        };
        ranks: {
          yards_per_game: number;
          pass_yards_per_game: number;
          pass_tds_per_game: number;
          rush_yards_per_game: number;
          turnovers_per_game: number;
          points_per_game: number;
        };
        topStarters: Array<{
          id: number;
          first: string;
          last: string;
          pos: string;
          rating: number;
        }>;
        keyPlayers: Array<{
          id: number;
          first: string;
          last: string;
          pos: string;
          rating: number;
          impact: number;
        }>;
      };
    };
  };
}

export interface GameResultProps {
  data: {
    game: {
      teamA: Team;
      teamB: Team;
      homeTeamId?: number | null;
      awayTeamId?: number | null;
      neutralSite?: boolean;
      [key: string]: any;
    };
    drives?: Drive[];
  };
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

export interface FootballFieldProps {
  currentYardLine: number;
  homeTeam: {
    name: string;
    mascot?: string;
    colorPrimary?: string;
    colorSecondary?: string;
  };
  awayTeam: {
    name: string;
    mascot?: string;
    colorPrimary?: string;
    colorSecondary?: string;
  };
  isOffenseLeftToRight: boolean;
  down: number;
  yardsToGo: number;
  previousPlayYards?: number;
}

export interface GameControlsProps {
  isGameComplete: boolean;
  handleNextPlay: () => void;
  handleNextDrive: () => void;
  handleSimToEnd: () => void;
  decisionPrompt?: {
    type: 'run_pass' | 'fourth_down';
    down: number;
    yards_left: number;
    field_position: number;
  };
  handleDecision?: (decision: string) => void;
  submittingDecision?: boolean;
}

export interface GameHeaderProps {
  gameData: GameData;
  currentPlay: Play | null;
  isTeamAOnOffense: boolean;
  plays: Play[];
  isPlaybackComplete: boolean;
  lastPlayText?: string;
  currentDrive?: Drive | null;
}

export interface GameScoreStripProps {
  matchup: SimMatchup;
  isPlaybackComplete: boolean;
}
