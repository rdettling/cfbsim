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
import Awards from './pages/Awards';
import SeasonSummary from './pages/SeasonSummary';
import GamePage from './pages/game/GamePage';
import TeamStats from './pages/TeamStats';
import IndividualStats from './pages/IndividualStats';
import Player from './pages/Player';
import Realignment from './pages/Realignment';
import RosterProgression from './pages/RosterProgression';
import Recruiting from './pages/Recruiting';
import RecruitingSummary from './pages/RecruitingSummary';
import RosterCuts from './pages/RosterCuts';
import Playoff from './pages/Playoff';
import { ROUTES } from './constants/routes';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.HOME} element={<Home />} />
        <Route path={ROUTES.NONCON} element={<NonCon />} />
        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
        <Route path={ROUTES.TEAM_SCHEDULE} element={<TeamSchedule />} />
        <Route path="/:teamName/schedule/:year" element={<TeamSchedule />} />
        <Route path={ROUTES.TEAM_ROSTER} element={<Roster />} />
        <Route path={ROUTES.TEAM_HISTORY} element={<TeamHistory />} />
        <Route path={ROUTES.RATINGS_STATS} element={<RatingsStats />} />
        <Route path={ROUTES.RANKINGS} element={<Rankings />} />
        <Route path={ROUTES.STANDINGS} element={<Standings />} />
        <Route path={ROUTES.WEEK_SCHEDULE} element={<WeekSchedule />} />
        <Route path={ROUTES.AWARDS} element={<Awards />} />
        <Route path={ROUTES.SEASON_SUMMARY} element={<SeasonSummary />} />
        <Route path={ROUTES.REALIGNMENT} element={<Realignment />} />
        <Route
          path={ROUTES.ROSTER_PROGRESSION}
          element={<RosterProgression />}
        />
        <Route path={ROUTES.RECRUITING} element={<Recruiting />} />
        <Route
          path={ROUTES.RECRUITING_SUMMARY}
          element={<RecruitingSummary />}
        />
        <Route path={ROUTES.ROSTER_CUTS} element={<RosterCuts />} />
        <Route path={ROUTES.PLAYOFF} element={<Playoff />} />
        <Route path={ROUTES.GAME} element={<GamePage />} />
        <Route path={ROUTES.PLAYER} element={<Player />} />
        <Route path={ROUTES.TEAM_STATS} element={<TeamStats />} />
        <Route
          path={ROUTES.INDIVIDUAL_STATS}
          element={<IndividualStats />}
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
