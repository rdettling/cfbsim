import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadTeamRoster } from '../../domain/league';
import type { PlayerRecord } from '../../types/db';
import type { TeamRosterPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamPageActions } from './TeamPageActions';
import styles from './RosterPage.module.css';

const yearLabels = {
  fr: 'Freshman',
  so: 'Sophomore',
  jr: 'Junior',
  sr: 'Senior',
} as const;

export const RosterPage = () => {
  const navigate = useNavigate();
  const { teamName } = useParams();
  const [data, setData] = useState<TeamRosterPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadTeamRoster(teamName);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load roster');
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

  const visiblePositions = useMemo(() => {
    if (!data) return [];
    return data.positions.filter((position) => positionFilter === '' || positionFilter === position);
  }, [data, positionFilter]);

  if (loading) {
    return <LoadingState title="Loading roster" description="Pulling active roster data for the selected team." />;
  }

  if (error || !data) {
    return <EmptyState title="Roster unavailable" description={error ?? 'No roster data was found.'} />;
  }

  const playersByPosition = (position: string) =>
    data.roster
      .filter((player: PlayerRecord) => player.pos === position)
      .slice()
      .sort((left: PlayerRecord, right: PlayerRecord) => {
        if (right.rating !== left.rating) return right.rating - left.rating;
        return `${left.last},${left.first}`.localeCompare(`${right.last},${right.first}`);
      });

  return (
    <Page
      eyebrow="Team View"
      title="Team Roster"
      description={`${data.team.name} ${data.team.mascot}  •  ${data.roster.length} active players`}
      actions={<TeamPageActions current="roster" teamName={data.team.name} />}
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
        <div className={styles.controls}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Team</span>
            <select className={styles.select} value={data.team.name} onChange={(event) => navigate(`/${event.target.value}/roster`)}>
              {data.teams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Position</span>
            <select className={styles.select} value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              <option value="">All Positions</option>
              {data.positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <Section title="Roster" accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Rating</th>
                <th>Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visiblePositions.map((position) => {
                const players = playersByPosition(position);
                return players.length > 0 ? (
                  <tbody key={position}>
                    <tr className={styles.positionRow}>
                      <td colSpan={4}>{position.toUpperCase()}</td>
                    </tr>
                    {players.map((player) => (
                      <tr key={player.id}>
                        <td>
                          <button className={styles.playerLink} onClick={() => navigate(`/players/${player.id}`)} type="button">
                            {player.first} {player.last}
                          </button>
                        </td>
                        <td>{player.rating}</td>
                        <td>{yearLabels[player.year as keyof typeof yearLabels]}</td>
                        <td>
                          <span className={player.starter ? styles.starterChip : styles.backupChip}>
                            {player.starter ? 'Starter' : 'Backup'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ) : null;
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </Page>
  );
};
