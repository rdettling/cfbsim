import { Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { NewHomePage } from '../features/home/NewHomePage';
import { NewDashboardPage } from '../features/dashboard/NewDashboardPage';
import { NewTeamSchedulePage } from '../features/team/NewTeamSchedulePage';
import { NewWeekSchedulePage } from '../features/schedule/NewWeekSchedulePage';

export const newRouteElements = (
  <Route path="/__new" element={<AppShell />}>
    <Route index element={<NewHomePage />} />
    <Route path="dashboard" element={<NewDashboardPage />} />
    <Route path="schedule/:week" element={<NewWeekSchedulePage />} />
    <Route path=":teamName/schedule" element={<NewTeamSchedulePage />} />
    <Route path=":teamName/schedule/:year" element={<NewTeamSchedulePage />} />
  </Route>
);
