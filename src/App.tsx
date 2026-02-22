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
import GamePage from './pages/game/GamePage';
import TeamStats from './pages/TeamStats';
import IndividualStats from './pages/IndividualStats';
import Player from './pages/Player';
import Realignment from './pages/Realignment';
import RosterProgression from './pages/RosterProgression';
import RecruitingSummary from './pages/RecruitingSummary';
import RosterCuts from './pages/RosterCuts';
import Playoff from './pages/Playoff';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/noncon" element={<NonCon />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:teamName/schedule" element={<TeamSchedule />} />
        <Route path="/:teamName/schedule/:year" element={<TeamSchedule />} />
        <Route path="/:teamName/roster" element={<Roster />} />
        <Route path="/:teamName/history" element={<TeamHistory />} />
        <Route path="/stats/ratings" element={<RatingsStats />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/standings/:conference_name" element={<Standings />} />
        <Route path="/schedule/:week" element={<WeekSchedule />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/awards" element={<Awards />} />
        <Route path="/summary" element={<SeasonSummary />} />
        <Route path="/realignment" element={<Realignment />} />
        <Route path="/roster_progression" element={<RosterProgression />} />
        <Route path="/recruiting_summary" element={<RecruitingSummary />} />
        <Route path="/roster_cuts" element={<RosterCuts />} />
        <Route path="/playoff" element={<Playoff />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/players/:playerId" element={<Player />} />
        <Route path="/stats/team" element={<TeamStats />} />
        <Route path="/stats/individual" element={<IndividualStats />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
