import type {
  FourTeamPlayoffBracket,
  PlayoffBracket,
  PlayoffMatchup,
  TwelveTeamPlayoffBracket,
} from '../../domain/league/loaders/playoff';
import type { PlayoffPageData } from '../../types/pages';

export type PostseasonView = 'bracket' | 'committee' | 'bowls';
export type PostseasonFormat = 2 | 4 | 12;

export type PostseasonTeam = PlayoffPageData['playoff_teams'][number];
export type BubbleTeam = PlayoffPageData['bubble_teams'][number];
export type ConferenceChampion = PlayoffPageData['conference_champions'][number];
export type ResumeTeam = PlayoffPageData['resume_teams'][number];
export type BowlGame = PlayoffPageData['bowl_games'][number];

export type {
  FourTeamPlayoffBracket,
  PlayoffBracket,
  PlayoffMatchup,
  TwelveTeamPlayoffBracket,
};

export type TeamAction = (teamName: string) => void;
export type GameAction = (gameId: number) => void;
