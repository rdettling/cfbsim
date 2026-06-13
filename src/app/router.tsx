import { Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { NewHomePage } from '../features/home/NewHomePage';
import { NewDashboardPage } from '../features/dashboard/NewDashboardPage';
import { NewTeamSchedulePage } from '../features/team/NewTeamSchedulePage';
import { NewRosterPage } from '../features/team/NewRosterPage';
import { NewWeekSchedulePage } from '../features/schedule/NewWeekSchedulePage';
import { NewRankingsPage } from '../features/rankings/NewRankingsPage';
import { NewGamePage } from '../features/game/NewGamePage';

export const newRouteElements = (
  <Route path="/__new" element={<AppShell />}>
    <Route index element={<NewHomePage />} />
    <Route path="dashboard" element={<NewDashboardPage />} />
    <Route path="rankings" element={<NewRankingsPage />} />
    <Route path="game/:id" element={<NewGamePage />} />
    <Route path="schedule/:week" element={<NewWeekSchedulePage />} />
    <Route path=":teamName/roster" element={<NewRosterPage />} />
    <Route path=":teamName/schedule" element={<NewTeamSchedulePage />} />
    <Route path=":teamName/schedule/:year" element={<NewTeamSchedulePage />} />
  </Route>
);
