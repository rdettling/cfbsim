import type { TeamAggregateTotals } from './stats';

interface SeasonPlayoffArchiveBase {
  seeds: number[];
  autobids: number;
  conferenceChampionsReceiveTopSeeds: boolean;
}

export type SeasonPlayoffArchive =
  | SeasonPlayoffArchiveBase & {
      format: 2;
      games: {
        championship: number;
      };
    }
  | SeasonPlayoffArchiveBase & {
      format: 4;
      games: {
        leftSemifinal: number;
        rightSemifinal: number;
        championship: number;
      };
    }
  | SeasonPlayoffArchiveBase & {
      format: 12;
      games: {
        leftFirstRound1: number;
        leftFirstRound2: number;
        rightFirstRound1: number;
        rightFirstRound2: number;
        leftQuarterfinal1: number;
        leftQuarterfinal2: number;
        rightQuarterfinal1: number;
        rightQuarterfinal2: number;
        leftSemifinal: number;
        rightSemifinal: number;
        championship: number;
      };
    };

export interface SeasonConferenceChampion {
  conferenceName: string;
  teamId: number;
  championshipGameId: number | null;
}

export interface SeasonBowlArchive {
  gameId: number;
  name: string;
  tier: 'ny6' | 'other';
}

export interface SeasonPostseasonArchive {
  playoff: SeasonPlayoffArchive;
  conferenceChampions: SeasonConferenceChampion[];
  bowls: SeasonBowlArchive[];
}

export interface SeasonAwardWinner {
  categorySlug: string;
  playerId: number;
  teamId: number;
}

export interface SeasonTeamSnapshot {
  teamId: number;
  conference: string;
  rating: number;
  prestige: number;
  ranking: number;
  record: string;
  offense: TeamAggregateTotals;
  defense: TeamAggregateTotals;
}

export interface SeasonMemory {
  year: number;
  teamSnapshots: SeasonTeamSnapshot[];
  postseason: SeasonPostseasonArchive;
  awards: SeasonAwardWinner[];
}

export class SeasonMemoryDataIntegrityError extends Error {
  constructor(message = 'Saved dynasty memory does not match the current data model.') {
    super(message);
    this.name = 'SeasonMemoryDataIntegrityError';
  }
}
