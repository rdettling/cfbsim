import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadGame } from '../../domain/league';
import { resolveHomeAway, resolveTeamSide } from '../../domain/utils/gameDisplay';
import type { GamePageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './GamePage.module.css';

const PREVIEW_ROWS = [
  { key: 'points_per_game', label: 'Points/Game' },
  { key: 'yards_per_game', label: 'Yards/Game' },
  { key: 'pass_yards_per_game', label: 'Pass Yards/Game' },
  { key: 'rush_yards_per_game', label: 'Rush Yards/Game' },
  { key: 'turnovers_per_game', label: 'Turnovers/Game' },
] as const;

const formatWinProb = (value?: number | null) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '50%');

const formatGamesPlayedValue = (value: number, gamesPlayed: number) => (gamesPlayed === 0 ? '—' : value.toFixed(1));

const toClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

export const GamePage = () => {
  const { id } = useParams();
  const [data, setData] = useState<GamePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const gameId = Number(id);
        if (!id || Number.isNaN(gameId)) {
          throw new Error('Invalid game ID');
        }
        const nextData = await loadGame(gameId);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load game');
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
  }, [id]);

  const game = data?.game;
  const resultSummary = data?.resultSummary;
  const drives = data?.drives ?? [];
  const { home, away, neutral } = useMemo(() => (game ? resolveHomeAway(game) : { home: null, away: null, neutral: false }), [game]);

  if (loading) {
    return <LoadingState title="Loading game" description="Pulling preview or final result data for this matchup." />;
  }

  if (error || !data || !game || !home || !away) {
    return <EmptyState title="Game unavailable" description={error ?? 'No game data was found.'} />;
  }

  const awaySide = resolveTeamSide(game, away.id);
  const homeSide = resolveTeamSide(game, home.id);
  const isFinal = Boolean(game.winnerId);
  const awayPreview = away.id === game.teamA.id ? data.preview.teamA : data.preview.teamB;
  const homePreview = home.id === game.teamA.id ? data.preview.teamA : data.preview.teamB;
  const awaySummary = resultSummary ? (away.id === game.teamA.id ? resultSummary.teamA : resultSummary.teamB) : null;
  const homeSummary = resultSummary ? (home.id === game.teamA.id ? resultSummary.teamA : resultSummary.teamB) : null;

  return (
    <Page
      eyebrow={isFinal ? 'Game Result' : 'Game Preview'}
      title={game.name || game.base_label || 'Game Center'}
      description={neutral ? `${away.name} vs ${home.name}` : `${away.name} at ${home.name}`}
      actions={<Button to="/dashboard">Back to Dashboard</Button>}
      compact
    >
      <section className={styles.header}>
        <div className={styles.teamColumn}>
          <TeamMark
            name={awaySide.rank > 0 ? `#${awaySide.rank} ${away.name}` : away.name}
            meta={away.record}
            accent={away.colorPrimary}
          />
          <strong className={styles.score}>{isFinal ? awaySide.score : awaySide.spread || formatWinProb(awaySide.winProb)}</strong>
        </div>
        <div className={styles.centerMeta}>
          <span className={styles.label}>{isFinal ? 'Final' : `Week ${game.weekPlayed}`}</span>
          <strong className={styles.vs}>{neutral ? 'VS' : '@'}</strong>
          {game.headline_subtitle ? <span className={styles.subtitle}>{game.headline_subtitle}</span> : null}
        </div>
        <div className={styles.teamColumn}>
          <TeamMark
            name={homeSide.rank > 0 ? `#${homeSide.rank} ${home.name}` : home.name}
            meta={home.record}
            accent={home.colorPrimary}
          />
          <strong className={styles.score}>{isFinal ? homeSide.score : homeSide.spread || formatWinProb(homeSide.winProb)}</strong>
        </div>
      </section>

      {!isFinal ? (
        <div className={styles.previewLayout}>
          <Section title="Team Stat Comparison" accent={data.team.colorPrimary || '#0f4c81'}>
            {awayPreview.gamesPlayed > 0 && homePreview.gamesPlayed > 0 ? (
              <div className={styles.previewTableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{away.name}</th>
                      <th>Metric</th>
                      <th>{home.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PREVIEW_ROWS.map((row) => (
                      <tr key={row.key}>
                        <td>{formatGamesPlayedValue(awayPreview.stats[row.key], awayPreview.gamesPlayed)}</td>
                        <td>{row.label}</td>
                        <td>{formatGamesPlayedValue(homePreview.stats[row.key], homePreview.gamesPlayed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No prior games yet" description="Stat comparisons will appear once both teams have completed games this season." />
            )}
          </Section>

          <Section title="Odds Snapshot" accent="#0f4c81">
            <div className={styles.oddsList}>
              <div className={styles.oddsItem}>
                <span className={styles.label}>Favorite</span>
                <strong>{(awaySide.winProb ?? 0.5) >= (homeSide.winProb ?? 0.5) ? away.name : home.name}</strong>
              </div>
              <div className={styles.oddsItem}>
                <span className={styles.label}>Away win prob</span>
                <strong>{formatWinProb(awaySide.winProb)}</strong>
              </div>
              <div className={styles.oddsItem}>
                <span className={styles.label}>Home win prob</span>
                <strong>{formatWinProb(homeSide.winProb)}</strong>
              </div>
            </div>
          </Section>
        </div>
      ) : (
        <div className={styles.resultLayout}>
          <Section title="Team Stats" accent={data.team.colorPrimary || '#0f4c81'}>
            {awaySummary && homeSummary ? (
              <div className={styles.resultGrid}>
                <div className={styles.resultCard}>
                  <h3>{away.name}</h3>
                  <ul className={styles.statList}>
                    <li><span>Points</span><strong>{awaySummary.points}</strong></li>
                    <li><span>Total Yards</span><strong>{awaySummary.totalYards}</strong></li>
                    <li><span>Pass Yards</span><strong>{awaySummary.passYards}</strong></li>
                    <li><span>Rush Yards</span><strong>{awaySummary.rushYards}</strong></li>
                    <li><span>Turnovers</span><strong>{awaySummary.turnovers}</strong></li>
                    <li><span>TOP</span><strong>{toClock(awaySummary.timeOfPossessionSeconds)}</strong></li>
                  </ul>
                </div>
                <div className={styles.resultCard}>
                  <h3>{home.name}</h3>
                  <ul className={styles.statList}>
                    <li><span>Points</span><strong>{homeSummary.points}</strong></li>
                    <li><span>Total Yards</span><strong>{homeSummary.totalYards}</strong></li>
                    <li><span>Pass Yards</span><strong>{homeSummary.passYards}</strong></li>
                    <li><span>Rush Yards</span><strong>{homeSummary.rushYards}</strong></li>
                    <li><span>Turnovers</span><strong>{homeSummary.turnovers}</strong></li>
                    <li><span>TOP</span><strong>{toClock(homeSummary.timeOfPossessionSeconds)}</strong></li>
                  </ul>
                </div>
              </div>
            ) : (
              <EmptyState title="No result summary" description="This game does not have a finalized stat summary yet." />
            )}
          </Section>

          <Section title="Drive Summary" accent="#0f4c81">
            {drives.length > 0 ? (
              <div className={styles.driveList}>
                {drives.map((drive, index) => (
                  <article className={styles.driveCard} key={`${drive.driveNum}-${index}`}>
                    <div className={styles.driveHeader}>
                      <strong>Drive {drive.driveNum}</strong>
                      <span>{drive.offense}</span>
                    </div>
                    <div className={styles.driveMeta}>
                      <span>{drive.result}</span>
                      <span>{drive.points} pts</span>
                      <span>Start FP {drive.startingFP}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No drives available" description="Drive data is not available for this game." />
            )}
          </Section>

          <Section title="Leaders" accent="#2e7d32">
            {resultSummary ? (
              <div className={styles.leadersGrid}>
                {(['passing', 'rushing', 'receiving', 'defense'] as const).map((category) => (
                  <div className={styles.leaderBlock} key={category}>
                    <h3 className={styles.leaderTitle}>{category}</h3>
                    <div className={styles.leaderList}>
                      {resultSummary.leaders[category].length > 0 ? (
                        resultSummary.leaders[category].map((leader) => (
                          <div className={styles.leaderRow} key={`${category}-${leader.playerId}`}>
                            <div>
                              <strong>{leader.name}</strong>
                              <span>{leader.team} · {leader.pos}</span>
                            </div>
                            <span>{leader.statLine}</span>
                          </div>
                        ))
                      ) : (
                        <span className={styles.muted}>No entries</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No leaders yet" description="Leaderboards appear after the game is final." />
            )}
          </Section>
        </div>
      )}
    </Page>
  );
};
