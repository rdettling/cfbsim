import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { POSITION_ORDER } from '../../domain/roster';
import { loadRosterProgression } from '../../domain/league';
import type { PlayerRecord } from '../../types/db';
import type { RosterProgressionPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './NewRosterProgressionPage.module.css';

interface ProgressedPlayer {
  id: number;
  first: string;
  last: string;
  pos: string;
  year: PlayerRecord['year'];
  rating: number;
  next_year: PlayerRecord['year'];
  next_rating: number;
  stars: number;
  development_trait: number;
}

type DisplayPlayer = PlayerRecord | ProgressedPlayer;

const yearLabel = (year: PlayerRecord['year']) => year.toUpperCase();

const TableBlock = ({
  color,
  emptyText,
  players,
  positionFilter,
  showChange = false,
  title,
}: {
  color: string;
  emptyText: string;
  players: DisplayPlayer[];
  positionFilter: string;
  showChange?: boolean;
  title: string;
}) => {
  const visiblePlayers = players
    .filter((player) => !positionFilter || player.pos === positionFilter)
    .slice()
    .sort((left, right) => right.rating - left.rating);

  return (
    <Section title={title} accent={color}>
      {visiblePlayers.length > 0 ? (
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                {showChange ? <th>Next Year</th> : null}
                <th>Position</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((player, index) => {
                const progressed = player as ProgressedPlayer;
                const ratingChange =
                  showChange && progressed.next_rating !== undefined ? progressed.next_rating - player.rating : 0;
                return (
                  <tr className={index % 2 === 1 ? styles.altRow : undefined} key={player.id}>
                    <td>
                      <Link className={styles.playerLink} to={`/__new/players/${player.id}`}>
                        {player.first} {player.last}
                      </Link>
                    </td>
                    {showChange ? <td><span className={styles.chip}>{yearLabel(progressed.next_year)}</span></td> : null}
                    <td><span className={styles.chip}>{player.pos.toUpperCase()}</span></td>
                    <td>
                      {player.rating}
                      {showChange && progressed.next_rating !== undefined ? (
                        <span className={ratingChange >= 0 ? styles.gainUp : styles.gainDown}>
                          {ratingChange >= 0 ? `(+${ratingChange})` : `(${ratingChange})`}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>{emptyText}</div>
      )}
    </Section>
  );
};

export const NewRosterProgressionPage = () => {
  const [data, setData] = useState<RosterProgressionPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadRosterProgression();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load roster progression');
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

  const uniquePositions = useMemo(() => {
    if (!data) return [];
    const allPlayers = [...data.progressed, ...data.leaving];
    const positionSet = new Set(allPlayers.map((player) => player.pos));
    const ordered = POSITION_ORDER.filter((pos) => positionSet.has(pos));
    const extras = Array.from(positionSet).filter((pos) => !POSITION_ORDER.includes(pos)).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...extras];
  }, [data]);

  if (loading) {
    return <LoadingState title="Loading roster progression" description="Preparing returning-player growth and graduating seniors." />;
  }

  if (error || !data) {
    return <EmptyState title="Roster progression unavailable" description={error ?? 'No progression data was found.'} />;
  }

  const totalProgressed = data.progressed.length;
  const totalLeaving = data.leaving.length;
  const avgRatingChange =
    totalProgressed > 0
      ? Math.round(data.progressed.reduce((sum, player) => sum + (player.next_rating - player.rating), 0) / totalProgressed)
      : 0;
  const maxRatingChange =
    totalProgressed > 0 ? Math.max(...data.progressed.map((player) => player.next_rating - player.rating)) : 0;

  return (
    <Page
      eyebrow="Offseason Setup"
      title="Roster Progression"
      description={`${data.info.currentYear} to ${data.info.currentYear + 1} season transition`}
      actions={<Button to="/__new/realignment">Back to Realignment</Button>}
      compact
    >
      <div className={styles.layout}>
        <div className={styles.statGrid}>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{totalProgressed}</p>
            <p className={styles.statLabel}>Players Progressed</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{totalLeaving}</p>
            <p className={styles.statLabel}>Seniors Leaving</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{avgRatingChange}</p>
            <p className={styles.statLabel}>Avg Rating Change</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{maxRatingChange}</p>
            <p className={styles.statLabel}>Max Rating Gain</p>
          </article>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Filter by Position</span>
          <select className={styles.select} onChange={(event) => setPositionFilter(event.target.value)} value={positionFilter}>
            <option value="">All Positions</option>
            {uniquePositions.map((pos) => (
              <option key={pos} value={pos}>
                {pos.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <TableBlock
          color="#2e7d32"
          emptyText={positionFilter ? `No ${positionFilter.toUpperCase()} players found.` : 'No players have progressed this offseason.'}
          players={data.progressed}
          positionFilter={positionFilter}
          showChange
          title="Players Progressed"
        />

        <TableBlock
          color="#9c6a13"
          emptyText={positionFilter ? `No ${positionFilter.toUpperCase()} players found.` : 'All players are returning for another season.'}
          players={data.leaving}
          positionFilter={positionFilter}
          title="Seniors Leaving"
        />

        <div className={styles.note}>
          Your roster has been updated for the upcoming season.
          {totalProgressed > 0 ? ` ${totalProgressed} players have improved their skills.` : ''}
          {totalLeaving > 0 ? ` ${totalLeaving} seniors have graduated.` : ''}
        </div>

        <Button to="/__new/recruiting_summary">Continue to Recruiting Summary</Button>
      </div>
    </Page>
  );
};
