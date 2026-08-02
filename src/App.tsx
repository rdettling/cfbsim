import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppErrorBoundary from './components/layout/AppErrorBoundary';
import FullPageLoading from './components/layout/FullPageLoading';
import { ROUTES } from './constants/routes';

const Home = lazy(() => import('./pages/Home'));
const NewLeague = lazy(() => import('./pages/NewLeague'));
const NonCon = lazy(() => import('./pages/Noncon'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TeamSchedule = lazy(() => import('./pages/TeamSchedule'));
const RatingsStats = lazy(() => import('./pages/RatingsStats'));
const Rankings = lazy(() => import('./pages/Rankings'));
const Standings = lazy(() => import('./pages/Standings'));
const WeekSchedule = lazy(() => import('./pages/WeekSchedule'));
const Roster = lazy(() => import('./pages/Roster'));
const TeamHistory = lazy(() => import('./pages/TeamHistory'));
const Awards = lazy(() => import('./pages/Awards'));
const SeasonSummary = lazy(() => import('./pages/SeasonSummary'));
const GamePage = lazy(() => import('./pages/game/GamePage'));
const TeamStats = lazy(() => import('./pages/TeamStats'));
const IndividualStats = lazy(() => import('./pages/IndividualStats'));
const Player = lazy(() => import('./pages/Player'));
const Realignment = lazy(() => import('./pages/Realignment'));
const RosterProgression = lazy(() => import('./pages/RosterProgression'));
const Recruiting = lazy(() => import('./pages/Recruiting'));
const RecruitingSummary = lazy(() => import('./pages/RecruitingSummary'));
const RosterCuts = lazy(() => import('./pages/RosterCuts'));
const Playoff = lazy(() => import('./pages/Playoff'));
const PlayoffPicture = lazy(() => import('./pages/PlayoffPicture'));
const ResumeComparison = lazy(() => import('./pages/ResumeComparison'));
const PostseasonProjections = lazy(() => import('./pages/PostseasonProjections'));
const BowlGames = lazy(() => import('./pages/BowlGames'));
const AdvancedStats = lazy(() => import('./pages/AdvancedStats'));

const App = () => {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Suspense fallback={<FullPageLoading message="Loading page…" />}>
          <Routes>
            <Route path={ROUTES.HOME} element={<Home />} />
            <Route path={ROUTES.NEW_LEAGUE} element={<NewLeague />} />
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
            <Route path={ROUTES.PLAYOFF_PICTURE} element={<PlayoffPicture />} />
            <Route path={ROUTES.PLAYOFF_RESUMES} element={<ResumeComparison />} />
            <Route path={ROUTES.PLAYOFF_PROJECTIONS} element={<PostseasonProjections />} />
            <Route path={ROUTES.BOWL_GAMES} element={<BowlGames />} />
            <Route path={ROUTES.GAME} element={<GamePage />} />
            <Route path={ROUTES.PLAYER} element={<Player />} />
            <Route path={ROUTES.TEAM_STATS} element={<TeamStats />} />
            <Route path={ROUTES.ADVANCED_STATS} element={<AdvancedStats />} />
            <Route
              path={ROUTES.INDIVIDUAL_STATS}
              element={<IndividualStats />}
            />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
