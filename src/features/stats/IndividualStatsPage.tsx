import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadIndividualStats } from '../../domain/league';
import type { IndividualStatsPageData } from '../../types/pages';
import type { IndividualPlayerData } from '../../types/stats';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { StatsNav } from './StatsNav';
import styles from './StatsPages.module.css';

type CategoryKey = 'passing' | 'rushing' | 'receiving';

const SORT_FIELDS: Record<CategoryKey, string> = {
  passing: 'adjusted_pass_yards_per_attempt',
  rushing: 'yards_per_game',
  receiving: 'yards_per_game',
};

const formatValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export const IndividualStatsPage = () => {
  const [data, setData] = useState<IndividualStatsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>('passing');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadIndividualStats();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load individual stats');
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

  const rows = useMemo(() => {
    if (!data) return [];
    const sortBy = SORT_FIELDS[category];
    return Object.values(data.stats[category] ?? {}).sort((left, right) => right.stats[sortBy] - left.stats[sortBy]);
  }, [category, data]);

  const statKeys = useMemo(() => {
    const firstRow = rows[0] as IndividualPlayerData | undefined;
    return firstRow ? Object.keys(firstRow.stats) : [];
  }, [rows]);

  if (loading) {
    return <LoadingState title="Loading individual stats" description="Pulling current-season leaderboards by player." />;
  }

  if (error || !data) {
    return <EmptyState title="Individual stats unavailable" description={error ?? 'No individual stats data was found.'} />;
  }

  return (
    <Page
      eyebrow="Stats"
      title="Individual Statistics"
      description={`${data.info.currentYear} season leaders grouped by category`}
      actions={<StatsNav current="individual" />}
      compact
    >
      <Section
        title="Player Leaders"
        description="Starter-based production tables for passing, rushing, and receiving."
        accent={data.team.colorPrimary || '#0f4c81'}
        actions={
          <div className={styles.toggleRow}>
            {(['passing', 'rushing', 'receiving'] as const).map((key) => (
              <button
                className={`${styles.toggleButton} ${category === key ? styles.toggleButtonActive : ''}`}
                key={key}
                onClick={() => setCategory(key)}
                type="button"
              >
                {key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        }
      >
        {rows.length > 0 ? (
          <div className={styles.tablePanel}>
            <table className={`${styles.table} ${styles.compactTable}`}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Pos</th>
                  <th>Games</th>
                  {statKeys.map((key) => (
                    <th key={key}>{key.replace(/_/g, ' ').toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((player, index) => (
                  <tr className={index % 2 === 1 ? styles.altRow : undefined} key={player.id}>
                    <td>
                      <Link className={styles.playerLink} to={`/players/${player.id}`}>
                        {player.first} {player.last}
                      </Link>
                    </td>
                    <td>
                      <Link className={styles.teamLink} to={`/${player.team}/roster`}>
                        {player.team}
                      </Link>
                    </td>
                    <td>{player.pos.toUpperCase()}</td>
                    <td>{player.gamesPlayed}</td>
                    {statKeys.map((key) => (
                      <td key={key}>{formatValue(player.stats[key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No leaderboards yet" description="These tables will populate after enough current-season games have been played." />
        )}
      </Section>
    </Page>
  );
};
