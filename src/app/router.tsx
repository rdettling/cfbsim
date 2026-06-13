import { Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { NewHomePage } from '../features/home/NewHomePage';
import { NewDashboardPage } from '../features/dashboard/NewDashboardPage';

export const NewAppRoutes = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<NewHomePage />} />
        <Route path="dashboard" element={<NewDashboardPage />} />
      </Route>
    </Routes>
  );
};

