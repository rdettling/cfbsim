import { useEffect, useState } from 'react';
import { loadRosterCuts } from '../../domain/league';
import type { RosterCutsPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './NewRosterCutsPage.module.css';

export const NewRosterCutsPage = () => {
  const [data, setData] = useState<RosterCutsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadRosterCuts();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load roster cuts');
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
  }, []);

  if (loading) {
    return <LoadingState title="Loading roster cuts" description="Checking projected roster size against position limits." />;
  }

  if (error || !data) {
    return <EmptyState title="Roster cuts unavailable" description={error ?? 'No roster cut data was found.'} />;
  }

  const totalCuts = data.cuts.length;

  return (
    <Page
      eyebrow="Offseason Setup"
      title="Roster Cuts"
      description="Projected cuts based on position limits and long-term roster balance."
      actions={<Button to="/__new/recruiting_summary">Back to Recruiting Summary</Button>}
      compact
    >
      <div className={styles.layout}>
        <section className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <h2 className={styles.summaryTitle}>Players Cut</h2>
            <span className={styles.chip}>{totalCuts} players</span>
          </div>
          <p className={styles.metaText}>Cuts are based on projected ratings and position limits.</p>
        </section>

        <Section title="Projected Cuts" accent={data.team.colorPrimary || '#9c6a13'}>
          {totalCuts > 0 ? (
            <div className={styles.tablePanel}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Year</th>
                    <th>Position</th>
                    <th>Rating</th>
                    <th>Projected</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cuts.map((player, index) => (
                    <tr className={index % 2 === 1 ? styles.altRow : undefined} key={player.id}>
                      <td>
                        <a className={styles.playerLink} href={`/__new/players/${player.id}`}>
                          {player.first} {player.last}
                        </a>
                      </td>
                      <td><span className={styles.tag}>{player.year?.toUpperCase() || ''}</span></td>
                      <td><span className={styles.tag}>{player.pos.toUpperCase()}</span></td>
                      <td>{player.rating}</td>
                      <td>{player.rating_sr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>No cuts needed. Your roster is within position limits.</div>
          )}
        </Section>
      </div>
    </Page>
  );
};
