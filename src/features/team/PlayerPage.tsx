import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadPlayer } from '../../domain/league';
import type { PlayerPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './PlayerPage.module.css';

const formatStatLabel = (key: string) =>
  key
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const PlayerPage = () => {
  const { playerId } = useParams();
  const [data, setData] = useState<PlayerPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!playerId) {
          throw new Error('No player ID provided');
        }
        const nextData = await loadPlayer(playerId);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load player');
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
  }, [playerId]);

  const years = useMemo(() => {
    if (!data) return [];
    const careerYears = Object.keys(data.career_stats).map(Number);
    const logYears = Object.keys(data.game_logs).map(Number);
    return Array.from(new Set([...careerYears, ...logYears])).sort((a, b) => b - a);
  }, [data]);

  useEffect(() => {
    if (!selectedYear && years.length > 0) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  if (loading) {
    return <LoadingState title="Loading player" description="Pulling player profile, career stats, and game logs." />;
  }

  if (error || !data) {
    return <EmptyState title="Player unavailable" description={error ?? 'No player data was found.'} />;
  }

  const player = data.player;
  const awards = data.awards ?? [];
  const careerStatsByYear = data.career_stats ?? {};
  const gameLogsByYear = data.game_logs ?? {};
  const currentYearLogs = selectedYear ? gameLogsByYear[selectedYear] || [] : [];
  const firstCareerYear = years.length > 0 ? careerStatsByYear[years[0]] : null;
  const statKeys = firstCareerYear ? Object.keys(firstCareerYear).filter((key) => !['class', 'rating'].includes(key)) : [];
  const gameLogStatKeys = currentYearLogs[0] ? Object.keys(currentYearLogs[0]).filter((key) => key !== 'game') : [];

  return (
    <Page
      eyebrow="Player View"
      title={`${player.first} ${player.last}`}
      description={`${player.pos.toUpperCase()}  •  ${player.year.toUpperCase()}  •  ${player.team}`}
      actions={<Button to={`/${player.team}/roster`}>Back to Roster</Button>}
      compact
    >
      <section className={styles.header}>
        <div className={styles.headerMain}>
          <div>
            <h2 className={styles.playerName}>{player.first} {player.last}</h2>
            <div className={styles.metaGrid}>
              <div><span>Team</span><strong>{player.team}</strong></div>
              <div><span>Position</span><strong>{player.pos}</strong></div>
              <div><span>Year</span><strong>{player.year.toUpperCase()}</strong></div>
              <div><span>Stars</span><strong>{player.stars > 0 ? '★'.repeat(player.stars) : 'N/A'}</strong></div>
              <div><span>Development</span><strong>{player.development_trait}</strong></div>
              <div><span>Status</span><strong>{player.starter ? 'Starter' : 'Backup'}</strong></div>
            </div>
          </div>
          <div className={styles.ratingCard}>
            <strong className={styles.ratingValue}>{player.rating}</strong>
            <span>Overall Rating</span>
          </div>
        </div>
        <div className={styles.teamRow}>
          <TeamMark name={player.team} meta={data.team.conference} accent={data.team.colorPrimary} />
          {awards.length > 0 ? (
            <div className={styles.awardRow}>
              {awards.map((award) => (
                <span className={styles.awardChip} key={award.slug}>{award.name}</span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <Section title="Career Statistics" accent={data.team.colorPrimary || '#0f4c81'}>
        {years.length > 0 && statKeys.length > 0 ? (
          <div className={styles.tablePanel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Class</th>
                  <th>Rating</th>
                  {statKeys.map((key) => (
                    <th key={key}>{formatStatLabel(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((year, index) => {
                  const yearStats = careerStatsByYear[year];
                  if (!yearStats) return null;
                  return (
                    <tr className={index % 2 === 1 ? styles.altRow : undefined} key={year}>
                      <td><strong>{year}</strong></td>
                      <td>{yearStats.class}</td>
                      <td>{yearStats.rating}</td>
                      {statKeys.map((key) => (
                        <td key={key}>
                          {yearStats[key] != null
                            ? typeof yearStats[key] === 'number'
                              ? Number.isInteger(yearStats[key])
                                ? yearStats[key]
                                : yearStats[key].toFixed(1)
                              : String(yearStats[key])
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No career stats yet" description="No historical stat lines are available for this player." />
        )}
      </Section>

      <Section
        title="Game Logs"
        accent="#0f4c81"
        actions={
          years.length > 0 ? (
            <label className={styles.yearField}>
              <span>Year</span>
              <select value={selectedYear ?? ''} onChange={(event) => setSelectedYear(Number(event.target.value))}>
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      >
        {currentYearLogs.length > 0 ? (
          <div className={styles.tablePanel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  {gameLogStatKeys.map((key) => (
                    <th key={key}>{formatStatLabel(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentYearLogs.map((log, index) => {
                  const game = log.game;
                  return (
                    <tr className={index % 2 === 1 ? styles.altRow : undefined} key={`${game.id}-${index}`}>
                      <td>{game.weekPlayed}</td>
                      <td>
                        <div className={styles.opponentCell}>
                          <TeamMark
                            name={game.opponent.ranking > 0 ? `#${game.opponent.ranking} ${game.opponent.name}` : game.opponent.name}
                            meta={game.label}
                            accent="#0f4c81"
                          />
                        </div>
                      </td>
                      <td>
                        <a className={styles.gameLink} href={`/game/${game.id}`}>
                          {game.score}
                        </a>
                      </td>
                      {gameLogStatKeys.map((key) => (
                        <td key={key}>
                          {log[key] != null
                            ? typeof log[key] === 'number'
                              ? Number.isInteger(log[key])
                                ? log[key]
                                : log[key].toFixed(1)
                              : String(log[key])
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No game logs" description="No games were recorded for the selected year." />
        )}
      </Section>
    </Page>
  );
};
