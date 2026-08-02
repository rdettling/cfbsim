import type {
  FourTeamPlayoffBracket,
  PlayoffBracket,
  PlayoffMatchup,
  TwelveTeamPlayoffBracket,
} from '../../domain/league/loaders/playoff';
import type {
  BowlGamesPageData,
  PlayoffPicturePageData,
  ResumeComparisonPageData,
} from '../../types/pages';

export type PostseasonFormat = 2 | 4 | 12;

export type PostseasonTeam = PlayoffPicturePageData['playoff_teams'][number];
export type BubbleTeam = PlayoffPicturePageData['bubble_teams'][number];
export type ConferenceChampion = PlayoffPicturePageData['conference_champions'][number];
export type ResumeTeam = ResumeComparisonPageData['resume_teams'][number];
export type BowlGame = BowlGamesPageData['bowl_games'][number];

export type {
  FourTeamPlayoffBracket,
  PlayoffBracket,
  PlayoffMatchup,
  TwelveTeamPlayoffBracket,
};

export type TeamAction = (teamName: string) => void;
export type GameAction = (gameId: number) => void;
