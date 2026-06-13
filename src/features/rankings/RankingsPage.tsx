import { useEffect, useMemo, useState } from 'react';
import { loadRankings } from '../../domain/league';
import { formatOpponentPrefix } from '../../domain/utils/gameDisplay';
import type { RankingsPageData } from '../../types/pages';
import type { Team } from '../../types/domain';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './RankingsPage.module.css';

const InlineGame = ({
  team,
  mode,
}: {
  team: Team & { last_game?: Team['last_game']; next_game?: Team['next_game'] };
  mode: 'last' | 'next';
}) => {
  const game = mode === 'last' ? team.last_game : team.next_game;
  if (!game?.opponent) {
    return <span className={styles.mutedCell}>-</span>;
  }

  const prefix = formatOpponentPrefix(game.location);
  const rankedOpponent =
    game.opponent.ranking > 0 ? `#${game.opponent.ranking} ${game.opponent.name}` : game.opponent.name;

  if (mode === 'last') {
    return (
      <div className={styles.inlineGame}>
        <span>{game.result}</span>
        <a href={`/game/${game.id}`} className={styles.inlineLink}>
          ({game.score})
        </a>
        {prefix ? <span>{prefix}</span> : null}
        <span>{rankedOpponent}</span>
      </div>
    );
  }

  return (
    <div className={styles.inlineGame}>
      {prefix ? <span>{prefix}</span> : null}
      <span>{rankedOpponent}</span>
      <a href={`/game/${game.id}`} className={styles.inlineLink}>
        ({game.spread})
      </a>
    </div>
  );
};

export const RankingsPage = () => {
  const [data, setData] = useState<RankingsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTeams, setShowAllTeams] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadRankings();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load rankings');
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

  const displayedTeams = useMemo(() => {
    if (!data) return [];
    return showAllTeams ? data.rankings : data.rankings.slice(0, 25);
  }, [data, showAllTeams]);

  if (loading) {
    return <LoadingState title="Loading rankings" description="Building the national rankings table for the current season." />;
  }

  if (error || !data) {
    return <EmptyState title="Rankings unavailable" description={error ?? 'No rankings data was found.'} />;
  }

  return (
    <Page
      eyebrow="National View"
      title="Rankings"
      description={showAllTeams ? `${data.rankings.length} teams shown` : 'Top 25 shown'}
      actions={
        <Button
          variant="secondary"
          onClick={() => setShowAllTeams((current) => !current)}
        >
          {showAllTeams ? 'Show Top 25' : `Show All ${data.rankings.length}`}
        </Button>
      }
      compact
    >
      <Section title="AP Rankings" accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Record</th>
                <th>Poll Score</th>
                <th>Strength of Record</th>
                <th>Last Week</th>
                <th>This Week</th>
              </tr>
            </thead>
            <tbody>
              {displayedTeams.map((team, index) => (
                <tr key={team.name} className={index % 2 === 1 ? styles.altRow : undefined}>
                  <td>
                    <div className={styles.rankCell}>
                      <strong>{team.ranking}</strong>
                      {team.movement !== 0 ? (
                        <span className={team.movement > 0 ? styles.movementUp : styles.movementDown}>
                          {team.movement > 0 ? `+${team.movement}` : team.movement}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <TeamMark name={team.name} meta={team.mascot} accent={team.colorPrimary} />
                  </td>
                  <td>{team.record}</td>
                  <td>{team.poll_score !== undefined ? team.poll_score.toFixed(1) : 'N/A'}</td>
                  <td>{team.strength_of_record !== undefined ? team.strength_of_record.toFixed(1) : 'N/A'}</td>
                  <td>
                    <InlineGame team={team} mode="last" />
                  </td>
                  <td>
                    <InlineGame team={team} mode="next" />
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
