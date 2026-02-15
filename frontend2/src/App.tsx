import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { NonCon } from './pages/Noncon';
import Dashboard from './pages/Dashboard';
import TeamSchedule from './pages/TeamSchedule';
import RatingsStats from './pages/RatingsStats';
import Rankings from './pages/Rankings';
import Standings from './pages/Standings';
import WeekSchedule from './pages/WeekSchedule';
import Roster from './pages/Roster';
import TeamHistory from './pages/TeamHistory';
import SettingsPage from './pages/Settings';
import Awards from './pages/Awards';
import SeasonSummary from './pages/SeasonSummary';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/noncon" element={<NonCon />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:teamName/schedule" element={<TeamSchedule />} />
        <Route path="/:teamName/roster" element={<Roster />} />
        <Route path="/:teamName/history" element={<TeamHistory />} />
        <Route path="/stats/ratings" element={<RatingsStats />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/standings/:conference_name" element={<Standings />} />
        <Route path="/schedule/:week" element={<WeekSchedule />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/awards" element={<Awards />} />
        <Route path="/summary" element={<SeasonSummary />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
