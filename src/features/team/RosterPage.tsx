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
import { TeamPageHeader, TeamHeaderSelect } from './TeamPageHeader';
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
      <TeamPageHeader
        team={data.team}
        subtitle={<>Record: <strong>{data.team.record}</strong></>}
      >
        <TeamHeaderSelect
          label="Team"
          onChange={(event) => navigate(`/${event.target.value}/roster`)}
          options={data.teams.map((name) => ({ value: name, label: name }))}
          value={data.team.name}
        />
        <TeamHeaderSelect
          label="Position"
          onChange={(event) => setPositionFilter(event.target.value)}
          options={[
            { value: '', label: 'All Positions' },
            ...data.positions.map((position) => ({ value: position, label: position })),
          ]}
          value={positionFilter}
        />
      </TeamPageHeader>

      <Section title="Roster" accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={`ui-table-shell ui-table-shell--soft ${styles.tablePanel}`}>
          <table className={`ui-table ${styles.table}`}>
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
                          <span className={player.starter ? 'ui-chip ui-chip--compact ui-chip--success' : 'ui-chip ui-chip--compact ui-chip--neutral'}>
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
