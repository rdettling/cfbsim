import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSeasonSummary } from '../../domain/league';
import type { SeasonSummaryPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './SeasonSummaryPage.module.css';

type SummaryAward = {
  category_slug: string;
  category_name: string;
  first_place: {
    id: number;
    first: string;
    last: string;
    pos: string;
    team_name: string;
  } | null;
  first_stats: Record<string, unknown> | null;
};

type SummaryTeam = SeasonSummaryPageData['teams'][number] & {
  avg_rank_before?: number | null;
  avg_rank_after?: number | null;
};

const getAwardStatLine = (stats?: Record<string, unknown> | null) =>
  typeof stats?.stat_line === 'string' ? stats.stat_line : 'No stats yet';

const changeClassName = (change: number) => {
  if (change > 0) return styles.changeUp;
  if (change < 0) return `${styles.changeDown} ${styles.changeFlat}`;
  return styles.changeFlat;
};

export const SeasonSummaryPage = () => {
  const [data, setData] = useState<SeasonSummaryPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadSeasonSummary();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load season summary');
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

  const awards = useMemo(() => ((data?.awards ?? []) as SummaryAward[]), [data]);
  const orderedPrestigeChanges = useMemo(() => {
    const teams = ((data?.teams ?? []) as SummaryTeam[])
      .filter((team) => (team.prestige_change ?? 0) !== 0)
      .slice()
      .sort((left, right) => {
        const leftChange = left.prestige_change ?? 0;
        const rightChange = right.prestige_change ?? 0;
        if (leftChange !== rightChange) return rightChange - leftChange;
        return left.name.localeCompare(right.name);
      });
    return teams;
  }, [data]);

  if (loading) {
    return <LoadingState title="Loading season summary" description="Pulling champions, awards, and prestige movement." />;
  }

  if (error || !data) {
    return <EmptyState title="Season summary unavailable" description={error ?? 'No summary data was found.'} />;
  }

  const champion = data.champion;

  return (
    <Page
      eyebrow="Season Review"
      title={`${data.info.currentYear} Season Summary`}
      description="Champions, awards, and prestige movement in one view."
      actions={<Button to="/dashboard">Back to Dashboard</Button>}
      compact
    >
      <div className={styles.workspace}>
        <div className={styles.heroGrid}>
          <section className={styles.heroCard}>
            <p className={styles.eyebrow}>National Champions</p>
            {champion ? (
              <div className={styles.championRow}>
                <div className={styles.championBadge}>{champion.abbreviation}</div>
                <div>
                  <h2 className={styles.championName}>
                    <Link className={styles.championLink} to={`/${champion.name}/history`}>
                      {champion.name} {champion.mascot}
                    </Link>
                  </h2>
                  <div className={styles.chip}>Title Winners</div>
                </div>
              </div>
            ) : (
              <p className={styles.metaText}>Championship data is not available yet.</p>
            )}
          </section>

          <section className={styles.heroCard}>
            <p className={styles.eyebrow}>Next Steps</p>
            <p className={styles.metaText}>
              Review roster progression, confirm realignment changes, and get ready for recruiting.
            </p>
            <div className={styles.nextStepList}>
              <div className={styles.nextStepItem}>
                <p className={styles.nextStepTitle}>Realignment</p>
                <p className={styles.nextStepMeta}>Check conference moves and postseason format changes for next year.</p>
                <p className={styles.nextStepMeta}>
                  <Link className={styles.teamLink} to="/realignment">Open realignment setup</Link>
                </p>
              </div>
              <div className={styles.nextStepItem}>
                <p className={styles.nextStepTitle}>Roster Progression</p>
                <p className={styles.nextStepMeta}>Review graduating players and rating growth before recruiting.</p>
              </div>
              <div className={styles.nextStepItem}>
                <p className={styles.nextStepTitle}>Recruiting Summary</p>
                <p className={styles.nextStepMeta}>Use the offseason flow to inspect roster shape before cuts.</p>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.bottomGrid}>
          <Section title="Award Winners" accent={data.team.colorPrimary || '#0f4c81'}>
            <div className={styles.scrollPanel}>
              {awards.length === 0 ? (
                <div className={styles.awardRow}>
                  <p className={styles.metaText}>No awards have been finalized yet.</p>
                </div>
              ) : (
                <div className={styles.awardList}>
                  {awards.map((award) => {
                    const winner = award.first_place;
                    return (
                      <article className={styles.awardRow} key={award.category_slug}>
                        <div>
                          <p className={styles.awardTitle}>{award.category_name}</p>
                          {winner ? (
                            <Link className={styles.awardWinner} to={`/players/${winner.id}`}>
                              {winner.first} {winner.last}
                            </Link>
                          ) : (
                            <span className={styles.awardWinner}>TBD</span>
                          )}
                          <p className={styles.awardStats}>{getAwardStatLine(award.first_stats)}</p>
                        </div>
                        <span className={styles.posChip}>{winner?.pos || '--'}</span>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          <Section title="Prestige Movement" description="Changes effective next season." accent="#2e7d32">
            <div className={styles.scrollPanel}>
              {orderedPrestigeChanges.length > 0 ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Current</th>
                      <th>Avg Rank</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedPrestigeChanges.map((team, index) => {
                      const change = team.prestige_change ?? 0;
                      const avgBefore = team.avg_rank_before;
                      const avgAfter = team.avg_rank_after;
                      const avgLabel =
                        avgBefore == null ? '—' : `${avgBefore.toFixed(1)} -> ${avgAfter == null ? '—' : avgAfter.toFixed(1)}`;

                      return (
                        <tr className={index % 2 === 1 ? styles.altRow : undefined} key={team.name}>
                          <td>
                            <Link className={styles.teamLink} to={`/${team.name}/history`}>
                              {team.name}
                            </Link>
                          </td>
                          <td>{team.prestige}</td>
                          <td>{avgLabel}</td>
                          <td>
                            <span className={changeClassName(change)}>{change > 0 ? `+${change}` : String(change)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className={styles.awardRow}>
                  <p className={styles.metaText}>Prestige changes are not available yet.</p>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </Page>
  );
};
