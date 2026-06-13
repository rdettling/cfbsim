import { Navigate, Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { NewHomePage } from '../features/home/NewHomePage';
import { NewDashboardPage } from '../features/dashboard/NewDashboardPage';
import { NewTeamSchedulePage } from '../features/team/NewTeamSchedulePage';
import { NewRosterPage } from '../features/team/NewRosterPage';
import { NewTeamHistoryPage } from '../features/team/NewTeamHistoryPage';
import { NewPlayerPage } from '../features/team/NewPlayerPage';
import { NewWeekSchedulePage } from '../features/schedule/NewWeekSchedulePage';
import { NewRankingsPage } from '../features/rankings/NewRankingsPage';
import { NewGamePage } from '../features/game/NewGamePage';
import { NewTeamStatsPage } from '../features/stats/NewTeamStatsPage';
import { NewIndividualStatsPage } from '../features/stats/NewIndividualStatsPage';
import { NewRatingsStatsPage } from '../features/stats/NewRatingsStatsPage';
import { NewStandingsPage } from '../features/standings/NewStandingsPage';
import { NewSettingsPage } from '../features/settings/NewSettingsPage';
import { NewSeasonSummaryPage } from '../features/summary/NewSeasonSummaryPage';

export const newRouteElements = (
  <Route path="/__new" element={<AppShell />}>
    <Route index element={<NewHomePage />} />
    <Route path="dashboard" element={<NewDashboardPage />} />
    <Route path="rankings" element={<NewRankingsPage />} />
    <Route path="settings" element={<NewSettingsPage />} />
    <Route path="summary" element={<NewSeasonSummaryPage />} />
    <Route path="standings/:conferenceName" element={<NewStandingsPage />} />
    <Route path="stats" element={<Navigate replace to="/__new/stats/team" />} />
    <Route path="stats/team" element={<NewTeamStatsPage />} />
    <Route path="stats/individual" element={<NewIndividualStatsPage />} />
    <Route path="stats/ratings" element={<NewRatingsStatsPage />} />
    <Route path="game/:id" element={<NewGamePage />} />
    <Route path="players/:playerId" element={<NewPlayerPage />} />
    <Route path="schedule/:week" element={<NewWeekSchedulePage />} />
    <Route path=":teamName/history" element={<NewTeamHistoryPage />} />
    <Route path=":teamName/roster" element={<NewRosterPage />} />
    <Route path=":teamName/schedule" element={<NewTeamSchedulePage />} />
    <Route path=":teamName/schedule/:year" element={<NewTeamSchedulePage />} />
  </Route>
);
