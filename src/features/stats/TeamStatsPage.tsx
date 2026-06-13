import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadTeamStats } from '../../domain/league';
import type { TeamStatsColumnConfig, TeamStatsSortConfig, TeamStatsType } from '../../types/stats';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { StatsNav } from './StatsNav';
import styles from './StatsPages.module.css';

const COLUMN_CONFIG: TeamStatsColumnConfig[] = [
  { key: 'games', label: 'Games', width: '60px', sortable: true },
  { key: 'ppg', label: 'PPG', width: '60px', sortable: true },
  { key: 'pass_cpg', label: 'CMP', width: '50px', sortable: true },
  { key: 'pass_apg', label: 'ATT', width: '50px', sortable: true },
  { key: 'comp_percent', label: 'PCT', width: '50px', sortable: true },
  { key: 'pass_ypg', label: 'Pass Yds', width: '72px', sortable: true },
  { key: 'pass_tdpg', label: 'Pass TD', width: '60px', sortable: true },
  { key: 'rush_apg', label: 'Rush Att', width: '64px', sortable: true },
  { key: 'rush_ypg', label: 'Rush Yds', width: '72px', sortable: true },
  { key: 'rush_ypc', label: 'YPC', width: '50px', sortable: true },
  { key: 'rush_tdpg', label: 'Rush TD', width: '60px', sortable: true },
  { key: 'playspg', label: 'Plays', width: '60px', sortable: true },
  { key: 'yardspg', label: 'Total Yds', width: '72px', sortable: true },
  { key: 'ypp', label: 'YPP', width: '50px', sortable: true },
  { key: 'first_downs_total', label: '1st Downs', width: '72px', sortable: true },
  { key: 'turnovers', label: 'TO', width: '50px', sortable: true },
];

type TeamStatsData = Awaited<ReturnType<typeof loadTeamStats>>;
type StatsMode = 'offense' | 'defense';

const formatValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const fillStats = (stats: Partial<TeamStatsType>): TeamStatsType => ({
  games: 0,
  ppg: 0,
  pass_cpg: 0,
  pass_apg: 0,
  comp_percent: 0,
  pass_ypg: 0,
  pass_tdpg: 0,
  rush_apg: 0,
  rush_ypg: 0,
  rush_ypc: 0,
  rush_tdpg: 0,
  playspg: 0,
  yardspg: 0,
  ypp: 0,
  first_downs_pass: 0,
  first_downs_rush: 0,
  first_downs_total: 0,
  fumbles: 0,
  interceptions: 0,
  turnovers: 0,
  ...stats,
});

export const TeamStatsPage = () => {
  const [data, setData] = useState<TeamStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StatsMode>('offense');
  const [sortConfig, setSortConfig] = useState<TeamStatsSortConfig>({ field: 'ppg', direction: 'desc' });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadTeamStats();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load team stats');
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

    const source = mode === 'offense' ? data.offense : data.defense;
    const average = fillStats(mode === 'offense' ? data.offense_averages : data.defense_averages);

    const sorted = Object.entries(source)
      .map(([teamName, stats]) => ({ teamName, stats: fillStats(stats) }))
      .sort((left, right) => {
        const leftValue = left.stats[sortConfig.field] ?? 0;
        const rightValue = right.stats[sortConfig.field] ?? 0;
        return sortConfig.direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
      });

    return [
      { rank: 'AVG', teamName: 'League Average', stats: average, isAverage: true },
      ...sorted.map((entry, index) => ({
        rank: index + 1,
        teamName: entry.teamName,
        stats: entry.stats,
        isAverage: false,
      })),
    ];
  }, [data, mode, sortConfig]);

  const handleSort = (field: keyof TeamStatsType) => {
    setSortConfig((current) => ({
      field,
      direction: current.field === field && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (loading) {
    return <LoadingState title="Loading team stats" description="Pulling offense and defense production for every team." />;
  }

  if (error || !data) {
    return <EmptyState title="Team stats unavailable" description={error ?? 'No team stats data was found.'} />;
  }

  return (
    <Page
      eyebrow="Stats"
      title="Team Statistics"
      description={`${data.info.currentYear} season through week ${data.info.currentWeek}`}
      actions={<StatsNav current="team" />}
      compact
    >
      <Section
        title="Team Production"
        description="Sortable offense and defense table for the current season."
        accent={data.team.colorPrimary || '#0f4c81'}
        actions={
          <div className={styles.toggleRow}>
            <button
              className={`${styles.toggleButton} ${mode === 'offense' ? styles.toggleButtonActive : ''}`}
              onClick={() => setMode('offense')}
              type="button"
            >
              Offense
            </button>
            <button
              className={`${styles.toggleButton} ${mode === 'defense' ? styles.toggleButtonActive : ''}`}
              onClick={() => setMode('defense')}
              type="button"
            >
              Defense
            </button>
          </div>
        }
      >
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                {COLUMN_CONFIG.map((column) => (
                  <th
                    className={column.sortable ? styles.sortable : undefined}
                    key={column.key}
                    onClick={column.sortable ? () => handleSort(column.key) : undefined}
                  >
                    {column.label}
                    {sortConfig.field === column.key ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  className={row.isAverage ? styles.leagueAverageRow : index % 2 === 0 ? undefined : styles.altRow}
                  key={row.teamName}
                >
                  <td className={styles.rankCell}>{row.rank}</td>
                  <td>
                    {row.isAverage ? (
                      <span className={styles.metaText}>League Average</span>
                    ) : (
                      <Link className={styles.teamLink} to={`/${row.teamName}/history`}>
                        {row.teamName}
                      </Link>
                    )}
                  </td>
                  {COLUMN_CONFIG.map((column) => (
                    <td key={column.key}>{formatValue(row.stats[column.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Page>
  );
};
