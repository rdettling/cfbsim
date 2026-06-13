import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadRatingsStats } from '../../domain/league';
import type { RatingsStatsPageData } from '../../types/pages';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { StatsNav } from './StatsNav';
import styles from './StatsPages.module.css';

const stars = (count: number) => '★'.repeat(Math.max(1, count));
const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

export const NewRatingsStatsPage = () => {
  const [data, setData] = useState<RatingsStatsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadRatingsStats();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load ratings stats');
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
    return <LoadingState title="Loading ratings stats" description="Pulling star distribution and team rating tables." />;
  }

  if (error || !data) {
    return <EmptyState title="Ratings stats unavailable" description={error ?? 'No ratings stats data was found.'} />;
  }

  return (
    <Page
      eyebrow="Stats"
      title="Ratings Statistics"
      description="Roster star distribution, prestige tiers, and team rating ladder"
      actions={<StatsNav current="ratings" />}
      compact
    >
      <div className={styles.grid}>
        <div className={styles.stack}>
          <Section
            title="Prestige Tier Breakdown"
            description="Average team quality and player star mix by prestige tier."
            accent={data.team.colorPrimary || '#0f4c81'}
          >
            <div className={styles.tablePanel}>
              <table className={`${styles.table} ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Teams</th>
                    <th>Avg Rating</th>
                    <th>Avg Stars</th>
                    <th>5★</th>
                    <th>4★</th>
                    <th>3★</th>
                    <th>2★</th>
                    <th>1★</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prestige_stars_table
                    .slice()
                    .reverse()
                    .map((row, index) => (
                      <tr className={index % 2 === 1 ? styles.altRow : undefined} key={row.prestige}>
                        <td><span className={styles.chip}>Tier {row.prestige}</span></td>
                        <td>{row.team_count}</td>
                        <td>{row.avg_rating}</td>
                        <td>{row.average_stars}</td>
                        <td>{row.star_percentages[5]}%</td>
                        <td>{row.star_percentages[4]}%</td>
                        <td>{row.star_percentages[3]}%</td>
                        <td>{row.star_percentages[2]}%</td>
                        <td>{row.star_percentages[1]}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Star Rating Counts" description="Overall player counts and development curve by star band.">
            <div className={styles.tablePanel}>
              <table className={`${styles.table} ${styles.compactTable}`}>
                <thead>
                  <tr>
                    <th>Stars</th>
                    <th>Players</th>
                    <th>Current</th>
                    <th>FR</th>
                    <th>SO</th>
                    <th>JR</th>
                    <th>SR</th>
                  </tr>
                </thead>
                <tbody>
                  {STAR_LEVELS.map((star, index) => (
                    <tr className={index % 2 === 1 ? styles.altRow : undefined} key={star}>
                      <td className={styles.starCell}>{stars(star)}</td>
                      <td>{data.total_star_counts.counts[star]}</td>
                      <td>{data.total_star_counts.avg_ratings[star]}</td>
                      <td>{data.total_star_counts.avg_ratings_fr[star]}</td>
                      <td>{data.total_star_counts.avg_ratings_so[star]}</td>
                      <td>{data.total_star_counts.avg_ratings_jr[star]}</td>
                      <td>{data.total_star_counts.avg_ratings_sr[star]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <Section title="Team Rating Ladder" description="Every team sorted by current overall rating." accent="#2e7d32">
          <div className={styles.tablePanel}>
            <table className={`${styles.table} ${styles.leaderTable}`}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Rating</th>
                  <th>Prestige</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((team, index) => (
                  <tr className={index % 2 === 1 ? styles.altRow : undefined} key={team.id}>
                    <td className={styles.rankCell}>#{index + 1}</td>
                    <td>
                      <Link className={styles.teamLink} to={`/${team.name}/history`}>
                        {team.name}
                      </Link>
                    </td>
                    <td>{team.rating}</td>
                    <td><span className={styles.chip}>Tier {team.prestige}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </Page>
  );
};
