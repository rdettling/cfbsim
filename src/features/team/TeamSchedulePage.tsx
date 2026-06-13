import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadTeamSchedule } from '../../domain/league';
import type { TeamSchedulePageData } from '../../types/pages';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import { Button } from '../../ui/Button';
import { TeamPageActions } from './TeamPageActions';
import { TeamPageHeader, TeamHeaderSelect } from './TeamPageHeader';
import styles from './TeamSchedulePage.module.css';

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

export const TeamSchedulePage = () => {
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
    navigate(nextYear ? `/${nextTeam}/schedule/${nextYear}` : `/${nextTeam}/schedule`);
  };

  const handleYearChange = (nextYear: number) => {
    navigate(`/${data.team.name}/schedule/${nextYear}`);
  };

  return (
    <Page
      eyebrow="Team View"
      title={`${data.selected_year ?? data.info.currentYear} Season Schedule`}
      description={`${data.team.name} ${data.team.mascot}  •  ${data.team.record}  •  Rating ${data.team.rating}`}
      actions={<TeamPageActions current="schedule" teamName={data.team.name} />}
      compact
    >
      <TeamPageHeader
        team={data.team}
        subtitle={<>Record: <strong>{data.team.record}</strong></>}
      >
        <TeamHeaderSelect
          label="Team"
          onChange={(event) => handleTeamChange(event.target.value)}
          options={data.teams.map((name) => ({ value: name, label: name }))}
          value={data.team.name}
        />
        {data.years.length > 0 ? (
          <TeamHeaderSelect
            label="Year"
            onChange={(event) => handleYearChange(Number(event.target.value))}
            options={data.years.map((seasonYear) => ({ value: seasonYear, label: String(seasonYear) }))}
            value={data.selected_year ?? data.info.currentYear}
          />
        ) : null}
      </TeamPageHeader>

      <Section title={`${data.selected_year ?? data.info.currentYear} Schedule`} accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={`ui-table-shell ui-table-shell--soft ${styles.schedulePanel}`}>
          <table className={`ui-table ${styles.table}`}>
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
                    <span className={`ui-chip ui-chip--compact ${styles.locationPill} ${locationTone(normalizeLocation(game.location))}`}>
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
                    {game.label ? <span className="ui-chip ui-chip--compact ui-chip--primary">{game.label}</span> : '-'}
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
