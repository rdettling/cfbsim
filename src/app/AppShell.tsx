import { NavLink, Outlet } from 'react-router-dom';
import './styles.css';

const navItems = [
  { to: '/__new', label: 'Home' },
  { to: '/__new/dashboard', label: 'Dashboard' },
  { to: '/__new/rankings', label: 'Rankings' },
  { to: '/__new/schedule/1', label: 'Week Schedule' },
];

export const AppShell = () => {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__bar">
          <div className="app-shell__brand">
            <span className="app-shell__kicker">CFB Sim</span>
            <span className="app-shell__title">Frontend Rebuild Preview</span>
          </div>
          <nav className="app-shell__nav" aria-label="Preview navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/__new'}
                className={({ isActive }) =>
                  isActive ? 'app-shell__nav-link app-shell__nav-link--active' : 'app-shell__nav-link'
                }
              >
                {item.label}
              </NavLink>
            ))}
            <a className="app-shell__nav-link" href="/">
              Legacy App
            </a>
          </nav>
        </div>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
};
