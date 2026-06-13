import { Navigate, Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../features/home/HomePage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { NonConPage } from '../features/noncon/NonConPage';
import { TeamSchedulePage } from '../features/team/TeamSchedulePage';
import { RosterPage } from '../features/team/RosterPage';
import { TeamHistoryPage } from '../features/team/TeamHistoryPage';
import { PlayerPage } from '../features/team/PlayerPage';
import { WeekSchedulePage } from '../features/schedule/WeekSchedulePage';
import { RankingsPage } from '../features/rankings/RankingsPage';
import { GamePage } from '../features/game/GamePage';
import { TeamStatsPage } from '../features/stats/TeamStatsPage';
import { IndividualStatsPage } from '../features/stats/IndividualStatsPage';
import { RatingsStatsPage } from '../features/stats/RatingsStatsPage';
import { StandingsPage } from '../features/standings/StandingsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SeasonSummaryPage } from '../features/summary/SeasonSummaryPage';
import { RealignmentPage } from '../features/realignment/RealignmentPage';
import { RosterProgressionPage } from '../features/progression/RosterProgressionPage';
import { RecruitingSummaryPage } from '../features/recruiting/RecruitingSummaryPage';
import { RosterCutsPage } from '../features/cuts/RosterCutsPage';
import { AwardsPage } from '../features/awards/AwardsPage';
import { PlayoffPage } from '../features/playoff/PlayoffPage';

const buildShellRoute = (path: string, statsRedirect: string) => (
  <Route path={path} element={<AppShell />}>
    <Route index element={<HomePage />} />
    <Route path="noncon" element={<NonConPage />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="rankings" element={<RankingsPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="summary" element={<SeasonSummaryPage />} />
    <Route path="awards" element={<AwardsPage />} />
    <Route path="playoff" element={<PlayoffPage />} />
    <Route path="realignment" element={<RealignmentPage />} />
    <Route path="roster_progression" element={<RosterProgressionPage />} />
    <Route path="recruiting_summary" element={<RecruitingSummaryPage />} />
    <Route path="roster_cuts" element={<RosterCutsPage />} />
    <Route path="standings/:conferenceName" element={<StandingsPage />} />
    <Route path="stats" element={<Navigate replace to={statsRedirect} />} />
    <Route path="stats/team" element={<TeamStatsPage />} />
    <Route path="stats/individual" element={<IndividualStatsPage />} />
    <Route path="stats/ratings" element={<RatingsStatsPage />} />
    <Route path="game/:id" element={<GamePage />} />
    <Route path="players/:playerId" element={<PlayerPage />} />
    <Route path="schedule/:week" element={<WeekSchedulePage />} />
    <Route path=":teamName/history" element={<TeamHistoryPage />} />
    <Route path=":teamName/roster" element={<RosterPage />} />
    <Route path=":teamName/schedule" element={<TeamSchedulePage />} />
    <Route path=":teamName/schedule/:year" element={<TeamSchedulePage />} />
  </Route>
);

export const primaryRouteElements = buildShellRoute('/', '/stats/team');
