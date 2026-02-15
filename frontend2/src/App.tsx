import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { NonCon } from './pages/Noncon';
import Dashboard from './pages/Dashboard';
import TeamSchedule from './pages/TeamSchedule';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/noncon" element={<NonCon />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:teamName/schedule" element={<TeamSchedule />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
