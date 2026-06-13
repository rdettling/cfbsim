import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { NewHomePage } from '../features/home/NewHomePage';
import { NewDashboardPage } from '../features/dashboard/NewDashboardPage';
import { NewTeamSchedulePage } from '../features/team/NewTeamSchedulePage';

export const NewAppRoutes = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<NewHomePage />} />
        <Route path="dashboard" element={<NewDashboardPage />} />
        <Route path=":teamName/schedule" element={<NewTeamSchedulePage />} />
        <Route path=":teamName/schedule/:year" element={<NewTeamSchedulePage />} />
      </Route>
    </Routes>
  );
};
