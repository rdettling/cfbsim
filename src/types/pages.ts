import type { loadHomeData, loadNonCon, loadDashboard, loadNews, loadTeamSchedule, loadWeekSchedule, loadGame, listAvailableTeams, startNewLeague } from '../domain/league/loaders/season';
import type { loadAwards, loadSeasonSummary } from '../domain/league/loaders/offseason';
import type { loadRosterCuts } from '../domain/league/loaders/loadRosterCuts';
import type { loadRealignment } from '../domain/league/loaders/loadRealignment';
import type { loadRecruitingSummary } from '../domain/league/loaders/loadRecruitingSummary';
import type { loadRecruiting } from '../domain/league/loaders/loadRecruiting';
import type { loadRosterProgression } from '../domain/league/loaders/loadRosterProgression';
import type { loadRankings } from '../domain/league/loaders';
import type { loadRatingsStats, loadStandings, loadTeamStats, loadIndividualStats } from '../domain/league/loaders/stats';
import type { getTeamInfo } from '../domain/league/loaders/team/getTeamInfo';
import type { loadPlayer } from '../domain/league/loaders/team/loadPlayer';
import type { loadTeamHistory } from '../domain/league/loaders/team/loadTeamHistory';
import type { loadTeamRoster } from '../domain/league/loaders/team/loadTeamRoster';
import type {
  loadBowlGames,
  loadPlayoffBracket,
  loadPlayoffPicture,
  loadResumeComparison,
} from '../domain/league/loaders/playoff';
import type {
  loadAdvancedStats,
  loadPostseasonProjections,
} from '../domain/league/loaders/roadmap';

export type HomePageData = Awaited<ReturnType<typeof loadHomeData>>;
export type NonConPageData = Awaited<ReturnType<typeof loadNonCon>>;
export type DashboardPageData = Awaited<ReturnType<typeof loadDashboard>>;
export type NewsPageData = Awaited<ReturnType<typeof loadNews>>;
export type TeamSchedulePageData = Awaited<ReturnType<typeof loadTeamSchedule>>;
export type WeekSchedulePageData = Awaited<ReturnType<typeof loadWeekSchedule>>;
export type GamePageData = Awaited<ReturnType<typeof loadGame>>;
export type AwardsPageData = Awaited<ReturnType<typeof loadAwards>>;
export type SeasonSummaryPageData = Awaited<ReturnType<typeof loadSeasonSummary>>;
export type RealignmentPageData = Awaited<ReturnType<typeof loadRealignment>>;
export type RosterProgressionPageData = Awaited<ReturnType<typeof loadRosterProgression>>;
export type RecruitingSummaryPageData = Awaited<ReturnType<typeof loadRecruitingSummary>>;
export type RecruitingPageData = Awaited<ReturnType<typeof loadRecruiting>>;
export type RosterCutsPageData = Awaited<ReturnType<typeof loadRosterCuts>>;
export type RatingsStatsPageData = Awaited<ReturnType<typeof loadRatingsStats>>;
export type TeamStatsPageData = Awaited<ReturnType<typeof loadTeamStats>>;
export type StandingsPageData = Awaited<ReturnType<typeof loadStandings>>;
export type TeamRosterPageData = Awaited<ReturnType<typeof loadTeamRoster>>;
export type TeamHistoryPageData = Awaited<ReturnType<typeof loadTeamHistory>>;
export type RankingsPageData = Awaited<ReturnType<typeof loadRankings>>;
export type PlayerPageData = Awaited<ReturnType<typeof loadPlayer>>;
export type TeamInfoData = Awaited<ReturnType<typeof getTeamInfo>>;
export type AvailableTeamsData = Awaited<ReturnType<typeof listAvailableTeams>>;
export type StartNewLeagueData = Awaited<ReturnType<typeof startNewLeague>>;
export type IndividualStatsPageData = Awaited<ReturnType<typeof loadIndividualStats>>;
export type PlayoffBracketPageData = Awaited<ReturnType<typeof loadPlayoffBracket>>;
export type PlayoffPicturePageData = Awaited<ReturnType<typeof loadPlayoffPicture>>;
export type ResumeComparisonPageData = Awaited<ReturnType<typeof loadResumeComparison>>;
export type BowlGamesPageData = Awaited<ReturnType<typeof loadBowlGames>>;
export type AdvancedStatsPageData = Awaited<ReturnType<typeof loadAdvancedStats>>;
export type PostseasonProjectionsPageData = Awaited<ReturnType<typeof loadPostseasonProjections>>;
