import Home from '../pages/Home';
import { NonCon } from '../pages/Noncon';
import Dashboard from '../pages/Dashboard';
import TeamSchedule from '../pages/TeamSchedule';
import RatingsStats from '../pages/RatingsStats';
import Rankings from '../pages/Rankings';
import Standings from '../pages/Standings';
import WeekSchedule from '../pages/WeekSchedule';
import Roster from '../pages/Roster';
import TeamHistory from '../pages/TeamHistory';
import SettingsPage from '../pages/Settings';
import Awards from '../pages/Awards';
import SeasonSummary from '../pages/SeasonSummary';
import GamePage from '../pages/game/GamePage';
import TeamStats from '../pages/TeamStats';
import IndividualStats from '../pages/IndividualStats';
import Player from '../pages/Player';
import Realignment from '../pages/Realignment';
import RosterProgression from '../pages/RosterProgression';
import RecruitingSummary from '../pages/RecruitingSummary';
import RosterCuts from '../pages/RosterCuts';
import Playoff from '../pages/Playoff';
import { Route } from 'react-router-dom';

const withPrefix = (prefix: string, path: string) => (prefix ? `${prefix}${path === '/' ? '' : path}` : path);

export const buildLegacyRouteElements = (prefix = '') => (
  <>
    <Route path={withPrefix(prefix, '/')} element={<Home />} />
    <Route path={withPrefix(prefix, '/noncon')} element={<NonCon />} />
    <Route path={withPrefix(prefix, '/dashboard')} element={<Dashboard />} />
    <Route path={withPrefix(prefix, '/:teamName/schedule')} element={<TeamSchedule />} />
    <Route path={withPrefix(prefix, '/:teamName/schedule/:year')} element={<TeamSchedule />} />
    <Route path={withPrefix(prefix, '/:teamName/roster')} element={<Roster />} />
    <Route path={withPrefix(prefix, '/:teamName/history')} element={<TeamHistory />} />
    <Route path={withPrefix(prefix, '/stats/ratings')} element={<RatingsStats />} />
    <Route path={withPrefix(prefix, '/rankings')} element={<Rankings />} />
    <Route path={withPrefix(prefix, '/standings/:conference_name')} element={<Standings />} />
    <Route path={withPrefix(prefix, '/schedule/:week')} element={<WeekSchedule />} />
    <Route path={withPrefix(prefix, '/settings')} element={<SettingsPage />} />
    <Route path={withPrefix(prefix, '/awards')} element={<Awards />} />
    <Route path={withPrefix(prefix, '/summary')} element={<SeasonSummary />} />
    <Route path={withPrefix(prefix, '/realignment')} element={<Realignment />} />
    <Route path={withPrefix(prefix, '/roster_progression')} element={<RosterProgression />} />
    <Route path={withPrefix(prefix, '/recruiting_summary')} element={<RecruitingSummary />} />
    <Route path={withPrefix(prefix, '/roster_cuts')} element={<RosterCuts />} />
    <Route path={withPrefix(prefix, '/playoff')} element={<Playoff />} />
    <Route path={withPrefix(prefix, '/game/:id')} element={<GamePage />} />
    <Route path={withPrefix(prefix, '/players/:playerId')} element={<Player />} />
    <Route path={withPrefix(prefix, '/stats/team')} element={<TeamStats />} />
    <Route path={withPrefix(prefix, '/stats/individual')} element={<IndividualStats />} />
  </>
);
