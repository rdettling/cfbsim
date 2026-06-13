import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadTeamHistory } from '../../domain/league';
import type { TeamHistoryPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamPageActions } from './TeamPageActions';
import styles from './NewTeamHistoryPage.module.css';

const getRankDisplay = (rank: number) => (rank === 0 ? 'N/A' : `#${rank}`);

const getPrestigeStars = (prestige: number) => Math.min(Math.max(prestige, 1), 7);

const PrestigeStars = ({ prestige }: { prestige: number }) => {
  const count = getPrestigeStars(prestige);
  return (
    <div className={styles.stars}>
      {Array.from({ length: count }, (_, index) => (
        <img alt="star" className={styles.star} key={index} src="/logos/star.png" />
      ))}
    </div>
  );
};

export const NewTeamHistoryPage = () => {
  const navigate = useNavigate();
  const { teamName } = useParams();
  const [data, setData] = useState<TeamHistoryPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadTeamHistory(teamName);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load team history');
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
  }, [teamName]);

  const totals = useMemo(() => {
    const years = data?.years ?? [];
    return years.reduce(
      (accumulator, year) => {
        accumulator.wins += year.wins;
        accumulator.losses += year.losses;
        return accumulator;
      },
      { wins: 0, losses: 0 }
    );
  }, [data]);

  if (loading) {
    return <LoadingState title="Loading team history" description="Pulling historical season rows for the selected team." />;
  }

  if (error || !data) {
    return <EmptyState title="Team history unavailable" description={error ?? 'No historical data was found.'} />;
  }

  return (
    <Page
      eyebrow="Team View"
      title="Team History"
      description={`${data.team.name} ${data.team.mascot}  •  All-Time ${totals.wins}-${totals.losses}`}
      actions={<TeamPageActions current="history" teamName={data.team.name} />}
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
            <p className={styles.teamSubtitle}>All-Time: <strong>{totals.wins}-{totals.losses}</strong></p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Team</span>
            <select className={styles.select} value={data.team.name} onChange={(event) => navigate(`/__new/${event.target.value}/history`)}>
              {data.teams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <Section title="Historical Seasons" accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Year</th>
                <th>Prestige</th>
                <th>Rating</th>
                <th>Conference</th>
                <th>Record</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {data.years.map((year) => (
                <tr key={year.year}>
                  <td>
                    {year.has_games ? (
                      <button className={styles.linkButton} onClick={() => navigate(`/__new/${data.team.name}/schedule/${year.year}`)} type="button">
                        {year.year}
                      </button>
                    ) : (
                      <span className={styles.muted}>{year.year}</span>
                    )}
                  </td>
                  <td><PrestigeStars prestige={year.prestige} /></td>
                  <td>{year.rating != null ? <span className={styles.ratingChip}>{year.rating}</span> : <span className={styles.muted}>-</span>}</td>
                  <td>{year.conference}</td>
                  <td>
                    <strong>
                      {year.wins}-{year.losses}{year.rank === 1 ? ' 🏆' : ''}
                    </strong>
                  </td>
                  <td>
                    <span className={year.rank <= 25 && year.rank > 0 ? styles.rankBadge : styles.rankMuted}>
                      {getRankDisplay(year.rank)}
                    </span>
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
