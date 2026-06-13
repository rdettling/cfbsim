import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadWeekSchedule } from '../../domain/league';
import { formatMatchup, resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';
import type { WeekSchedulePageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './NewWeekSchedulePage.module.css';

type WeekGame = WeekSchedulePageData['games'][number];

const GameTeams = ({ game }: { game: WeekGame }) => {
  const { home, away, neutral } = resolveHomeAway(game);
  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const isFinal = game.winner;

  return (
    <>
      <div className={styles.cardTop}>
        <span className={styles.matchupLabel}>{formatMatchup(home.name, away.name, neutral)}</span>
        <span className={styles.watchability}>Watchability: {game.watchability}</span>
      </div>

      <div className={styles.teamRows}>
        <div className={styles.teamRow}>
          <TeamMark
            name={awaySide.rank > 0 && awaySide.rank < 26 ? `#${awaySide.rank} ${away.name}` : away.name}
            meta={away.record}
            accent={away.colorPrimary}
          />
          <strong className={styles.teamValue}>{isFinal ? awaySide.score : awaySide.spread}</strong>
        </div>
        <div className={styles.teamRow}>
          <TeamMark
            name={homeSide.rank > 0 && homeSide.rank < 26 ? `#${homeSide.rank} ${home.name}` : home.name}
            meta={home.record}
            accent={home.colorPrimary}
          />
          <strong className={styles.teamValue}>{isFinal ? homeSide.score : homeSide.spread}</strong>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.footerLabel}>
          {isFinal
            ? `${game.base_label || 'VS'} - FINAL${game.overtime && game.overtime > 0 ? ` (${game.overtime > 1 ? `${game.overtime}OT` : 'OT'})` : ''}`
            : formatMatchup(home.name, away.name, neutral)}
        </span>
        <Button to={`/game/${game.id}`} variant="ghost">
          {isFinal ? 'Summary' : 'Preview'}
        </Button>
      </div>
    </>
  );
};

export const NewWeekSchedulePage = () => {
  const navigate = useNavigate();
  const { week } = useParams();
  const [data, setData] = useState<WeekSchedulePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const weekNumber = Number(week);
        if (!week || Number.isNaN(weekNumber)) {
          throw new Error('Invalid week number');
        }

        const nextData = await loadWeekSchedule(weekNumber);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load week schedule');
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
  }, [week]);

  if (loading) {
    return <LoadingState title="Loading week schedule" description="Pulling current week matchups from league state." />;
  }

  if (error || !data) {
    return <EmptyState title="Week schedule unavailable" description={error ?? 'No games were found for this week.'} />;
  }

  const currentWeek = Number(week);

  return (
    <Page
      eyebrow="Season Schedule"
      title={`Week ${currentWeek} Schedule`}
      description={`${data.games.length} games this week`}
      actions={
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => navigate(`/schedule/${Math.max(1, currentWeek - 1)}`)}
            disabled={currentWeek <= 1}
          >
            Prev Week
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/schedule/${Math.min(data.info.lastWeek || currentWeek, currentWeek + 1)}`)}
            disabled={currentWeek >= (data.info.lastWeek || currentWeek)}
          >
            Next Week
          </Button>
        </div>
      }
      compact
    >
      <Section title={`Week ${currentWeek} Matchups`} accent={data.team.colorPrimary || '#0f4c81'}>
        {data.games.length > 0 ? (
          <div className={styles.grid}>
            {data.games.map((game) => (
              <article className={styles.card} key={game.id}>
                <GameTeams game={game} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No games this week" description="This week does not have any scheduled matchups." />
        )}
      </Section>
    </Page>
  );
};
