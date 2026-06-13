import { useEffect, useState } from 'react';
import { loadAwards } from '../../domain/league';
import type { AwardsPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './AwardsPage.module.css';

type AwardPlayer = AwardsPageData['favorites'][number]['first_place'];
type AwardEntry = AwardsPageData['favorites'][number];

const RANK_LABELS = ['1st Favorite', '2nd Favorite', '3rd Favorite'];

const getAwardStatLine = (stats?: Record<string, unknown> | null) =>
  typeof stats?.stat_line === 'string' ? stats.stat_line : 'No stats yet';

const NomineeRow = ({
  label,
  player,
  score,
  stats,
}: {
  label: string;
  player: AwardPlayer | null;
  score: number | null;
  stats: Record<string, unknown> | null;
}) => (
  <div className={styles.nomineeRow}>
    <div>
      <p className={styles.rankLabel}>{label}</p>
      {player ? (
        <a className={styles.playerLink} href={`/players/${player.id}`}>
          {player.first} {player.last}
        </a>
      ) : (
        <span className={styles.playerLink}>TBD</span>
      )}
      <p className={styles.statsText}>{getAwardStatLine(stats)}</p>
    </div>
    <div className={styles.nomineeSide}>
      <span className={styles.score}>{score != null ? score.toFixed(1) : '—'}</span>
      <span className={styles.pos}>{player?.pos || '--'}</span>
    </div>
  </div>
);

const AwardCard = ({
  award,
  highlightLabel,
  highlightTone,
}: {
  award: AwardEntry;
  highlightLabel: string;
  highlightTone: 'primary' | 'success';
}) => {
  const nominees = [award.first_place, award.second_place, award.third_place];
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{award.category_name}</h3>
          <p className={styles.cardMeta}>{award.category_description}</p>
        </div>
        <span className={highlightTone === 'primary' ? styles.chipPrimary : styles.chipSuccess}>{highlightLabel}</span>
      </div>

      <div className={styles.nomineeList}>
        {nominees.map((player, index) => (
          <NomineeRow
            key={`${award.category_slug}-${index}`}
            label={RANK_LABELS[index]}
            player={player}
            score={index === 0 ? award.first_score : index === 1 ? award.second_score : award.third_score}
            stats={index === 0 ? award.first_stats : index === 1 ? award.second_stats : award.third_stats}
          />
        ))}
      </div>
    </article>
  );
};

export const AwardsPage = () => {
  const [data, setData] = useState<AwardsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadAwards();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load awards');
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
    return <LoadingState title="Loading awards" description="Pulling current award races and final winners." />;
  }

  if (error || !data) {
    return <EmptyState title="Awards unavailable" description={error ?? 'No awards data was found.'} />;
  }

  const hasAwards = data.favorites.length > 0 || data.final.length > 0;

  return (
    <Page
      eyebrow="Season Honors"
      title="Individual Awards"
      description={
        data.info.stage === 'summary'
          ? 'Final award winners based on the completed season.'
          : 'Live award races updated from the current season results.'
      }
      actions={<Button to="/dashboard">Back to Dashboard</Button>}
      compact
    >
      <div className={styles.layout}>
        {!hasAwards ? (
          <EmptyState title="No awards yet" description="Awards will appear here once enough games have been played." />
        ) : null}

        {data.favorites.length > 0 ? (
          <Section title="Live Favorites" accent={data.team.colorPrimary || '#0f4c81'}>
            <div className={styles.grid}>
              {data.favorites.map((award) => (
                <AwardCard award={award} highlightLabel="Live Favorites" highlightTone="primary" key={`${award.category_slug}-fav`} />
              ))}
            </div>
          </Section>
        ) : null}

        {data.final.length > 0 ? (
          <Section title="Final Award Winners" accent="#2e7d32">
            <div className={styles.grid}>
              {data.final.map((award) => (
                <AwardCard award={award} highlightLabel="Final Winner" highlightTone="success" key={`${award.category_slug}-final`} />
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </Page>
  );
};
