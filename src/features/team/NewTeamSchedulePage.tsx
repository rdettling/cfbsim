import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadTeamSchedule } from '../../domain/league';
import type { TeamSchedulePageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './NewTeamSchedulePage.module.css';

const locationLabel = (location?: 'Home' | 'Away' | 'Neutral') => {
  if (location === 'Home') return 'H';
  if (location === 'Away') return 'A';
  if (location === 'Neutral') return 'N';
  return '-';
};

const locationTone = (location?: 'Home' | 'Away' | 'Neutral') => {
  if (location === 'Home') return styles.locationHome;
  if (location === 'Away') return styles.locationAway;
  if (location === 'Neutral') return styles.locationNeutral;
  return styles.locationNeutral;
};

const rowTone = (result: string) => {
  if (result === 'W') return styles.rowWin;
  if (result === 'L') return styles.rowLoss;
  return '';
};

const normalizeLocation = (location?: string): 'Home' | 'Away' | 'Neutral' | undefined => {
  if (location === 'Home' || location === 'Away' || location === 'Neutral') {
    return location;
  }
  return undefined;
};

export const NewTeamSchedulePage = () => {
  const navigate = useNavigate();
  const { teamName, year } = useParams();
  const [data, setData] = useState<TeamSchedulePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const parsedYear = year ? Number(year) : undefined;
        const nextData = await loadTeamSchedule(teamName, parsedYear);

        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load team schedule');
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
  }, [teamName, year]);

  if (loading) {
    return <LoadingState title="Loading team schedule" description="Pulling season schedule data for the selected program." />;
  }

  if (error || !data) {
    return <EmptyState title="Team schedule unavailable" description={error ?? 'No schedule data was found.'} />;
  }

  const handleTeamChange = (nextTeam: string) => {
    const nextYear = data.selected_year;
    navigate(nextYear ? `/__new/${nextTeam}/schedule/${nextYear}` : `/__new/${nextTeam}/schedule`);
  };

  const handleYearChange = (nextYear: number) => {
    navigate(`/__new/${data.team.name}/schedule/${nextYear}`);
  };

  return (
    <Page
      eyebrow="Team View"
      title={`${data.selected_year ?? data.info.currentYear} Season Schedule`}
      description={`${data.team.name} ${data.team.mascot}  •  ${data.team.record}  •  Rating ${data.team.rating}`}
      actions={<Button to="/__new/dashboard">Back to Dashboard</Button>}
      compact
    >
      <section className={styles.teamHeader} style={{ borderTopColor: data.team.colorPrimary || '#0f4c81' }}>
        <div className={styles.teamHeaderLeft}>
          <div className={styles.teamBadge} style={{ background: data.team.colorPrimary || '#0f4c81' }}>
            {data.team.abbreviation}
          </div>
          <div>
            <h2 className={styles.teamTitle}>
              {data.team.ranking > 0 ? `#${data.team.ranking} ` : ''}{data.team.name} {data.team.mascot}
            </h2>
            <p className={styles.teamSubtitle}>Record: <strong>{data.team.record}</strong></p>
          </div>
        </div>
        <div className={styles.teamHeaderControls}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Team</span>
            <select className={styles.select} value={data.team.name} onChange={(event) => handleTeamChange(event.target.value)}>
              {data.teams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {data.years.length > 0 ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Year</span>
              <select
                className={styles.select}
                value={data.selected_year ?? data.info.currentYear}
                onChange={(event) => handleYearChange(Number(event.target.value))}
              >
                {data.years.map((seasonYear) => (
                  <option key={seasonYear} value={seasonYear}>
                    {seasonYear}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <Section title={`${data.selected_year ?? data.info.currentYear} Schedule`} accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={styles.schedulePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Week</th>
                <th>Loc</th>
                <th>Opponent</th>
                <th>Rating</th>
                <th>Record</th>
                <th>Spread</th>
                <th>Result</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.schedule.map((game) => (
                <tr className={rowTone(game.result)} key={game.weekPlayed}>
                  <td>{game.weekPlayed}</td>
                  <td>
                    <span className={`${styles.locationPill} ${locationTone(normalizeLocation(game.location))}`}>
                      {locationLabel(normalizeLocation(game.location))}
                    </span>
                  </td>
                  <td>
                    {game.opponent ? (
                      <TeamMark
                        name={game.opponent.ranking > 0 ? `#${game.opponent.ranking} ${game.opponent.name}` : game.opponent.name}
                        meta={game.opponent.record}
                        accent="#0f4c81"
                      />
                    ) : (
                      <span className={styles.byeText}>Bye</span>
                    )}
                  </td>
                  <td>{game.opponent?.rating ?? '-'}</td>
                  <td>{game.opponent?.record ?? '-'}</td>
                  <td>{game.spread || '-'}</td>
                  <td>
                    {game.id ? (
                      <Button to={`/game/${game.id}`} variant={game.result ? 'ghost' : 'secondary'}>
                        {game.result ? `${game.result}: ${game.score}` : 'Preview'}
                      </Button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {game.label ? <span className={styles.noteChip}>{game.label}</span> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Page>
  );
};
