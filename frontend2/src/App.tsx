import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { NonCon } from './pages/Noncon';
import Dashboard from './pages/Dashboard';
import TeamSchedule from './pages/TeamSchedule';
import RatingsStats from './pages/RatingsStats';
import Rankings from './pages/Rankings';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/noncon" element={<NonCon />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:teamName/schedule" element={<TeamSchedule />} />
        <Route path="/stats/ratings" element={<RatingsStats />} />
        <Route path="/rankings" element={<Rankings />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
