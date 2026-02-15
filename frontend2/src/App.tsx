import { useEffect, useMemo, useState } from 'react';
import './app.css';

type YearsIndex = { years: string[] };

type YearData = {
  playoff: {
    teams: number;
    conf_champ_autobids?: number;
    conf_champ_top_4?: boolean;
  };
  conferences: Record<
    string,
    {
      games: number;
      teams: Record<string, number>;
    }
  >;
  Independent?: Record<string, number>;
};

type TeamsData = {
  teams: Record<
    string,
    {
      mascot: string;
      abbreviation: string;
      ceiling: number;
      floor: number;
      colorPrimary: string;
      colorSecondary: string;
      city?: string;
      state?: string;
      stadium?: string;
    }
  >;
};

type ConferencesData = Record<string, string>;

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const App = () => {
  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [yearData, setYearData] = useState<YearData | null>(null);
  const [teamsData, setTeamsData] = useState<TeamsData | null>(null);
  const [conferencesData, setConferencesData] = useState<ConferencesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadBase = async () => {
      try {
        setLoading(true);
        const [yearsIndex, teams, conferences] = await Promise.all([
          fetchJson<YearsIndex>('/data/years/index.json'),
          fetchJson<TeamsData>('/data/teams.json'),
          fetchJson<ConferencesData>('/data/conferences.json'),
        ]);
        if (cancelled) return;
        setYears(yearsIndex.years);
        setSelectedYear(yearsIndex.years[0] ?? '');
        setTeamsData(teams);
        setConferencesData(conferences);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadBase();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadYear = async () => {
      if (!selectedYear) return;
      try {
        setLoading(true);
        const data = await fetchJson<YearData>(`/data/years/${selectedYear}.json`);
        if (!cancelled) setYearData(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadYear();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const conferenceRows = useMemo(() => {
    if (!yearData || !teamsData || !conferencesData) return [];
    return Object.entries(yearData.conferences).map(([confName, confData]) => {
      const teams = Object.entries(confData.teams).map(([teamName, prestige]) => {
        const meta = teamsData.teams[teamName];
        return {
          name: teamName,
          prestige,
          mascot: meta?.mascot ?? '',
        };
      });
      teams.sort((a, b) => b.prestige - a.prestige);
      return {
        name: confName,
        fullName: conferencesData[confName] ?? confName,
        games: confData.games,
        topTeams: teams.slice(0, 5),
        teamCount: teams.length,
      };
    });
  }, [yearData, teamsData, conferencesData]);

  const independentTeams = useMemo(() => {
    if (!yearData || !teamsData) return [];
    const independents = yearData.Independent ?? {};
    return Object.entries(independents)
      .map(([teamName, prestige]) => ({
        name: teamName,
        prestige,
        mascot: teamsData.teams[teamName]?.mascot ?? '',
      }))
      .sort((a, b) => b.prestige - a.prestige);
  }, [yearData, teamsData]);

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">CFB Sim • Frontend Two</p>
          <h1>Offline-First League Builder</h1>
          <p className="app__subtitle">
            This is a new client-only rebuild. Start simple, layer complexity later.
          </p>
        </div>
        <div className="app__controls">
          <label htmlFor="year">Season</label>
          <select
            id="year"
            value={selectedYear}
            onChange={event => setSelectedYear(event.target.value)}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error && <div className="app__error">{error}</div>}
      {loading && <div className="app__loading">Loading data…</div>}

      {!loading && yearData && (
        <main className="app__main">
          <section className="card">
            <h2>Season Snapshot</h2>
            <div className="stat-grid">
              <div>
                <span className="stat-label">Playoff Teams</span>
                <span className="stat-value">{yearData.playoff.teams}</span>
              </div>
              <div>
                <span className="stat-label">Conferences</span>
                <span className="stat-value">{conferenceRows.length}</span>
              </div>
              <div>
                <span className="stat-label">Independents</span>
                <span className="stat-value">{independentTeams.length}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Conferences</h2>
            <div className="conference-grid">
              {conferenceRows.map(conf => (
                <article key={conf.name} className="conference">
                  <header>
                    <h3>{conf.fullName}</h3>
                    <p>
                      {conf.teamCount} teams • {conf.games} conf games
                    </p>
                  </header>
                  <ul>
                    {conf.topTeams.map(team => (
                      <li key={team.name}>
                        <span>{team.name}</span>
                        <span className="badge">{team.prestige}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Independents</h2>
            <div className="tag-list">
              {independentTeams.map(team => (
                <span key={team.name} className="tag">
                  {team.name} <strong>{team.prestige}</strong>
                </span>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

export default App;
