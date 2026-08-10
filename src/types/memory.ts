import type { PlayoffTeamCount } from './domain';
import type { TeamAggregateTotals } from './stats';

export const SEASON_MEMORY_EVENT_TYPES = [
  'conference_championship',
  'bowl',
  'playoff_first_round',
  'playoff_quarterfinal',
  'playoff_semifinal',
  'national_championship',
] as const;

export type SeasonMemoryEventType =
  (typeof SEASON_MEMORY_EVENT_TYPES)[number];

export type SeasonMemoryEvent =
  | {
      type: 'conference_championship';
      gameId: number;
      conferenceName: string;
    }
  | {
      type: 'bowl';
      gameId: number;
      bowlName: string;
    }
  | {
      type:
        | 'playoff_first_round'
        | 'playoff_quarterfinal'
        | 'playoff_semifinal'
        | 'national_championship';
      gameId: number;
    };

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
  playoffTeams: PlayoffTeamCount;
  teamSnapshots: SeasonTeamSnapshot[];
  events: SeasonMemoryEvent[];
  awards: SeasonAwardWinner[];
}

export class SeasonMemoryDataIntegrityError extends Error {
  constructor(message = 'Saved dynasty memory does not match the current data model.') {
    super(message);
    this.name = 'SeasonMemoryDataIntegrityError';
  }
}
