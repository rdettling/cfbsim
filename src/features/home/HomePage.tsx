import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadHomeData } from '../../domain/league';
import type { Team } from '../../types/domain';
import type { LaunchProps } from '../../types/league';
import { STAGES } from '../../constants/stages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { StatCard } from '../../ui/StatCard';
import { TeamMark } from '../../ui/TeamMark';
import styles from './HomePage.module.css';

type PlayoffState = {
  teams: number;
  autobids: number;
  confChampTop4: boolean;
};

const defaultPlayoffState: PlayoffState = {
  teams: 12,
  autobids: 5,
  confChampTop4: true,
};

const getContinuePath = (data: LaunchProps | null) => {
  if (!data?.info) return null;
  return STAGES.find((stage) => stage.id === data.info?.stage)?.path ?? '/';
};

const hydratePlayoffState = (data: LaunchProps | null): PlayoffState => {
  const playoff = data?.preview?.playoff;
  if (!playoff) return defaultPlayoffState;

  return {
    teams: playoff.teams,
    autobids: playoff.conf_champ_autobids ?? 0,
    confChampTop4: playoff.conf_champ_top_4 ?? false,
  };
};

const toConferenceOptions = (data: LaunchProps | null) => {
  if (!data?.preview) return [];

  return Object.keys(data.preview.conferences)
    .sort((left, right) => left.localeCompare(right))
    .map((conference) => ({
      value: conference,
      label: conference,
    }));
};

const collectTeams = (data: LaunchProps | null, conferenceFilter: string) => {
  if (!data?.preview) return [];

  const teams =
    conferenceFilter === 'INDEPENDENTS'
      ? data.preview.independents.map((team) => ({ ...team, confName: 'Independent' }))
      : conferenceFilter === 'ALL'
        ? [
            ...Object.entries(data.preview.conferences).flatMap(([confName, conference]) =>
              conference.teams.map((team) => ({ ...team, confName }))
            ),
            ...data.preview.independents.map((team) => ({ ...team, confName: 'Independent' })),
          ]
        : (data.preview.conferences[conferenceFilter]?.teams ?? []).map((team) => ({
            ...team,
            confName: conferenceFilter,
          }));

  return teams.sort((left, right) => right.prestige - left.prestige);
};

export const HomePage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<LaunchProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState('ALL');
  const [playoffState, setPlayoffState] = useState<PlayoffState>(defaultPlayoffState);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadHomeData(selectedYear || undefined);

        if (cancelled) return;

        setData(nextData);
        setSelectedYear((current) => current || nextData.selected_year || '');
        setConferenceFilter('ALL');
        setPlayoffState(hydratePlayoffState(nextData));
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load home data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const conferenceOptions = useMemo(() => toConferenceOptions(data), [data]);
  const visibleTeams = useMemo(() => collectTeams(data, conferenceFilter), [data, conferenceFilter]);
  const continuePath = getContinuePath(data);
  const canContinue = Boolean(data?.info && continuePath);

  const topTeams = visibleTeams.slice(0, 12);
  const selectedYearLabel = data?.selected_year ?? selectedYear;

  const handleStartLeague = (team: Team) => {
    navigate('/noncon', {
      state: {
        fromHome: true,
        team: team.name,
        year: selectedYearLabel,
        playoff: {
          teams: playoffState.teams,
          autobids: playoffState.autobids,
          conf_champ_top_4: playoffState.confChampTop4,
        },
      },
    });
  };

  const setPlayoffTeams = (value: number) => {
    setPlayoffState((current) => {
      if (value !== 12) {
        return {
          teams: value,
          autobids: 0,
          confChampTop4: false,
        };
      }

      return {
        teams: 12,
        autobids: current.autobids > 0 ? current.autobids : 5,
        confChampTop4: true,
      };
    });
  };

  if (loading) {
    return <LoadingState title="Loading league launch data" description="Pulling season options and preview data from IndexedDB." />;
  }

  if (error) {
    return <EmptyState title="Home screen failed to load" description={error} />;
  }

  return (
    <Page
      eyebrow="League Setup"
      title="Pick a season, choose a team, and get into the dynasty fast."
      description="The new home flow is intentionally lighter: one clear launch path, a visible team field, and a small set of settings that matter before the season begins."
      actions={
        canContinue ? (
          <Button to={continuePath!} variant="secondary">
            Continue Current Save
          </Button>
        ) : undefined
      }
    >
      <div className="ui-stat-grid">
        <StatCard label="Available seasons" value={String(data?.years.length ?? 0)} meta="Historical launch data from base data." />
        <StatCard label="Visible teams" value={String(visibleTeams.length)} meta={conferenceFilter === 'ALL' ? 'All conferences and independents.' : `Filtered to ${conferenceFilter}.`} />
        <StatCard label="Playoff format" value={`${playoffState.teams} teams`} meta={playoffState.teams === 12 ? `${playoffState.autobids} autobids` : 'Single format selection.'} />
      </div>

      <div className={styles.layout}>
        <Section
          title="Start a new league"
          description="Season setup should stay lightweight. Pick the year, pick the playoff format, then choose the program."
        >
          <div className={styles.controls}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Season</span>
              <select
                className={styles.select}
                value={selectedYearLabel ?? ''}
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                {(data?.years ?? []).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Playoff teams</span>
              <select
                className={styles.select}
                value={playoffState.teams}
                onChange={(event) => setPlayoffTeams(Number(event.target.value))}
              >
                <option value={2}>2 teams</option>
                <option value={4}>4 teams</option>
                <option value={12}>12 teams</option>
              </select>
            </label>

            {playoffState.teams === 12 ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Autobids</span>
                  <select
                    className={styles.select}
                    value={playoffState.autobids}
                    onChange={(event) =>
                      setPlayoffState((current) => ({
                        ...current,
                        autobids: Number(event.target.value),
                      }))
                    }
                  >
                    {Array.from({ length: conferenceOptions.length + 2 }, (_, index) => (
                      <option key={index} value={index}>
                        {index}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.toggle}>
                  <input
                    checked={playoffState.confChampTop4}
                    onChange={(event) =>
                      setPlayoffState((current) => ({
                        ...current,
                        confChampTop4: event.target.checked,
                        autobids: event.target.checked && current.autobids < 4 ? 4 : current.autobids,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>Conference champs locked into top four seeds</span>
                </label>
              </>
            ) : null}
          </div>

          <div className={styles.currentSave}>
            <div>
              <p className={styles.currentSaveLabel}>Current save</p>
              <p className={styles.currentSaveValue}>
                {canContinue && data?.info
                  ? `${data.info.currentYear} · ${data.info.stage}`
                  : 'No active league saved'}
              </p>
            </div>
            {canContinue ? (
              <Button to={continuePath!} variant="ghost">
                Resume saved league
              </Button>
            ) : null}
          </div>
        </Section>

        <Section
          title="Team field"
          description="The list is prestige-first for now. This keeps the launch screen fast to scan while we rebuild richer team presentation later."
          actions={
            <label className={styles.filter}>
              <span className={styles.fieldLabel}>Filter</span>
              <select
                className={styles.select}
                value={conferenceFilter}
                onChange={(event) => setConferenceFilter(event.target.value)}
              >
                <option value="ALL">All conferences</option>
                {conferenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="INDEPENDENTS">Independents</option>
              </select>
            </label>
          }
        >
          {topTeams.length > 0 ? (
            <div className={styles.teamGrid}>
              {topTeams.map((team, index) => (
                <article className={styles.teamCard} key={team.name}>
                  <div className={styles.teamHeader}>
                    <span className={styles.rank}>#{index + 1}</span>
                    <TeamMark
                      name={`${team.name} ${team.mascot}`}
                      meta={team.confName ?? 'Independent'}
                      accent={team.colorPrimary}
                    />
                  </div>
                  <div className={styles.teamStats}>
                    <div>
                      <span className={styles.teamStatLabel}>Prestige</span>
                      <strong>{team.prestige}</strong>
                    </div>
                    <div>
                      <span className={styles.teamStatLabel}>Ceiling</span>
                      <strong>{team.ceiling}</strong>
                    </div>
                    <div>
                      <span className={styles.teamStatLabel}>Floor</span>
                      <strong>{team.floor}</strong>
                    </div>
                  </div>
                  <Button onClick={() => handleStartLeague(team)}>Start as {team.name}</Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No teams match this filter"
              description="Try a different conference filter or season selection."
            />
          )}
        </Section>
      </div>
    </Page>
  );
};
