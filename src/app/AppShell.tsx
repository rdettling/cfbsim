import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { STAGES } from '../constants/stages';
import { loadLeagueOptional } from '../domain/league/leagueStore';
import { advanceWeeks } from '../domain/sim/orchestrator';
import type { LeagueState } from '../types/league';
import './styles.css';

type NavMenu = {
  id: string;
  label: string;
  items: Array<{ label: string; to: string }>;
};

const normalizePath = (path: string) => {
  const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  return decodeURIComponent(trimmed).toLowerCase();
};

const isPathActive = (pathname: string, target: string) => {
  const current = normalizePath(pathname);
  const normalizedTarget = normalizePath(target);
  return current === normalizedTarget || current.startsWith(`${normalizedTarget}/`);
};

const menuIsActive = (pathname: string, menu: NavMenu) => menu.items.some((item) => isPathActive(pathname, item.to));

const AppStageControls = ({ league }: { league: LeagueState }) => {
  const navigate = useNavigate();
  const [isWorking, setIsWorking] = useState(false);
  const [advanceMenuOpen, setAdvanceMenuOpen] = useState(false);

  const currentStage = STAGES.find((stage) => stage.id === league.info.stage) ?? null;
  const nextStage = currentStage ? STAGES.find((stage) => stage.id === currentStage.next) ?? null : null;
  const isSeason = league.info.stage === 'season';
  const isEndOfSeason = league.info.currentWeek > league.info.lastWeek;

  const handleStageChange = async (path: string) => {
    setIsWorking(true);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    navigate(path);
    setIsWorking(false);
  };

  const handleAdvance = async (destWeek: number) => {
    setAdvanceMenuOpen(false);
    setIsWorking(true);

    try {
      await advanceWeeks(destWeek);
      window.dispatchEvent(new Event('pageDataRefresh'));
    } finally {
      setIsWorking(false);
    }
  };

  if (!currentStage) return null;

  const availableWeeks = Array.from(
    { length: Math.max(league.info.lastWeek - league.info.currentWeek, 0) },
    (_, index) => league.info.currentWeek + index + 1
  );

  return (
    <div className="app-shell__stage-controls">
      <span className="app-shell__stage-pill">
        {isSeason ? (isEndOfSeason ? 'Season Complete' : `Week ${league.info.currentWeek}`) : currentStage.banner_label}
      </span>

      {isSeason ? (
        isEndOfSeason ? (
          <button
            className="app-shell__action-button app-shell__action-button--primary"
            disabled={isWorking}
            onClick={() => void handleStageChange('/summary')}
            type="button"
          >
            {isWorking ? 'Loading...' : 'Season Summary'}
          </button>
        ) : (
          <details
            className="app-shell__menu app-shell__menu--stage"
            onToggle={(event) => setAdvanceMenuOpen((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary
              className={
                advanceMenuOpen
                  ? 'app-shell__action-button app-shell__action-button--primary app-shell__menu-trigger'
                  : 'app-shell__action-button app-shell__action-button--primary app-shell__menu-trigger'
              }
            >
              {isWorking ? 'Simulating...' : 'Advance'}
            </summary>
            <div className="app-shell__menu-panel">
              {availableWeeks.map((week) => (
                <button
                  className="app-shell__menu-item"
                  disabled={isWorking}
                  key={week}
                  onClick={() => void handleAdvance(week)}
                  type="button"
                >
                  Simulate to Week {week}
                </button>
              ))}
              <button
                className="app-shell__menu-item"
                disabled={isWorking}
                onClick={() => void handleAdvance(league.info.lastWeek + 1)}
                type="button"
              >
                End of Season
              </button>
            </div>
          </details>
        )
      ) : nextStage ? (
        <>
          <button
            className="app-shell__action-button app-shell__action-button--primary"
            disabled={isWorking}
            onClick={() => void handleStageChange(nextStage.path)}
            type="button"
          >
            {isWorking ? 'Loading...' : `Next: ${nextStage.label}`}
          </button>
          <button
            className="app-shell__action-button app-shell__action-button--secondary"
            disabled={isWorking}
            onClick={() => void handleStageChange(currentStage.path)}
            type="button"
          >
            Open {currentStage.label}
          </button>
        </>
      ) : null}
    </div>
  );
};

export const AppShell = () => {
  const location = useLocation();
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const nextLeague = await loadLeagueOptional();
      if (!cancelled) {
        setLeague(nextLeague);
      }
    };

    void run();
    const handlePageDataRefresh = () => {
      void run();
      setRefreshVersion((version) => version + 1);
    };

    window.addEventListener('pageDataRefresh', handlePageDataRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('pageDataRefresh', handlePageDataRefresh);
    };
  }, [location.pathname]);

  const currentTeam = useMemo(
    () => league?.teams.find((team) => team.name === league.info.team) ?? null,
    [league]
  );

  const navMenus = useMemo<NavMenu[]>(() => {
    if (!league || !currentTeam) return [];

    return [
      {
        id: 'team',
        label: 'Team',
        items: [
          { label: 'Schedule', to: `/${currentTeam.name}/schedule` },
          { label: 'Roster', to: `/${currentTeam.name}/roster` },
          { label: 'History', to: `/${currentTeam.name}/history` },
        ],
      },
      {
        id: 'conferences',
        label: 'Conference Standings',
        items: [
          ...league.conferences.map((conference) => ({
            label: conference.confName,
            to: `/standings/${conference.confName}`,
          })),
          { label: 'Independent', to: '/standings/independent' },
        ],
      },
      {
        id: 'stats',
        label: 'Stats',
        items: [
          { label: 'Team', to: '/stats/team' },
          { label: 'Individual', to: '/stats/individual' },
          { label: 'Ratings', to: '/stats/ratings' },
          { label: 'Awards', to: '/awards' },
        ],
      },
      {
        id: 'schedule',
        label: 'Schedule',
        items: Array.from({ length: league.info.lastWeek }, (_, index) => ({
          label: `Week ${index + 1}`,
          to: `/schedule/${index + 1}`,
        })),
      },
    ];
  }, [currentTeam, league]);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__bar">
          <div className="app-shell__brand-wrap">
            <div className="app-shell__brand">
              <span className="app-shell__kicker">CFB Sim</span>
              <span className="app-shell__title">{currentTeam?.name ?? 'Frontend Rebuild Preview'}</span>
            </div>
            {league ? <AppStageControls league={league} /> : null}
          </div>
          <nav className="app-shell__nav" aria-label="Preview navigation">
            <NavLink
              end
              to="/"
              className={({ isActive }) =>
                isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'
              }
            >
              Home
            </NavLink>

            {league?.info.stage === 'season' ? (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'
                }
              >
                Dashboard
              </NavLink>
            ) : null}

            {navMenus.map((menu) => (
              <details className="app-shell__menu" key={menu.id}>
                <summary
                  className={
                    menuIsActive(location.pathname, menu)
                      ? 'app-shell__nav-link app-shell__nav-link--active app-shell__menu-trigger'
                      : 'app-shell__nav-link app-shell__menu-trigger'
                  }
                >
                  {menu.label}
                </summary>
                <div className="app-shell__menu-panel">
                  {menu.items.map((item) => (
                    <NavLink
                      className={({ isActive }) =>
                        isActive ? 'app-shell__menu-item app-shell__menu-item--active' : 'app-shell__menu-item'
                      }
                      key={item.to}
                      to={item.to}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </details>
            ))}

            <NavLink
              to="/rankings"
              className={({ isActive }) =>
                isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'
              }
            >
              Rankings
            </NavLink>

            <NavLink
              to="/playoff"
              className={({ isActive }) =>
                isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'
              }
            >
              Playoff
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'
              }
            >
              Settings
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="app-shell__main">
        <div key={`${location.pathname}:${refreshVersion}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
