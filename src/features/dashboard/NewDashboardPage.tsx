import { useEffect, useMemo, useState } from 'react';
import { loadDashboard } from '../../domain/league';
import { formatOpponentPrefix } from '../../domain/utils/gameDisplay';
import type { DashboardPageData } from '../../types/pages';
import type { ScheduleGame, Team } from '../../types/domain';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './NewDashboardPage.module.css';

const standingsRoute = (conferenceName?: string) =>
  `/standings/${conferenceName === 'Independent' || !conferenceName ? 'independent' : conferenceName}`;

const getOpponentLabel = (game: ScheduleGame | null) => {
  if (!game?.opponent) return 'Open date';
  const prefix = formatOpponentPrefix(game.location);
  const rankedName = game.opponent.ranking > 0 ? `#${game.opponent.ranking} ${game.opponent.name}` : game.opponent.name;
  return prefix ? `${prefix} ${rankedName}` : rankedName;
};

const getResultTone = (result: string) => {
  if (result.includes('W')) return styles.resultWin;
  if (result.includes('L')) return styles.resultLoss;
  return styles.resultNeutral;
};

const GameCard = ({ game, label }: { game: ScheduleGame | null; label: string }) => {
  if (!game?.opponent) {
    return (
      <article className={styles.gameCard}>
        <p className={styles.gameLabel}>{label}</p>
        <EmptyState title="No game available" description="This slot has no matchup yet." />
      </article>
    );
  }

  const isCompleted = Boolean(game.result);

  return (
    <article className={styles.gameCard}>
      <p className={styles.gameLabel}>{label}</p>
      <div className={styles.gameTop}>
        <TeamMark
          name={getOpponentLabel(game)}
          meta={game.opponent.record}
          accent="#0f4c81"
        />
        {isCompleted ? (
          <span className={`${styles.resultPill} ${getResultTone(game.result)}`}>
            {game.result}
          </span>
        ) : null}
      </div>
      {isCompleted ? (
        <strong className={styles.scoreLine}>{game.score}</strong>
      ) : (
        <div className={styles.gameOdds}>
          <span>Spread: {game.spread}</span>
          <span>Moneyline: {game.moneyline}</span>
        </div>
      )}
      <div className={styles.gameFooter}>
        <Button to={`/game/${game.id}`} variant={isCompleted ? 'ghost' : 'secondary'}>
          {isCompleted ? 'Game Summary' : 'Game Preview'}
        </Button>
      </div>
    </article>
  );
};

export const NewDashboardPage = () => {
  const [data, setData] = useState<DashboardPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadDashboard();

        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load dashboard');
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

  const team = data?.team;
  const conferenceName = team?.conference || 'Independent';
  const topGameItems = data?.top_games ?? [];
  const topTen = useMemo(() => data?.top_10 ?? [], [data]);
  const conferenceTeams = useMemo(() => data?.confTeams ?? [], [data]);

  if (loading) {
    return (
      <LoadingState
        title="Loading dashboard"
        description="Bootstrapping the season hub from the current league state."
      />
    );
  }

  if (error || !data || !team) {
    return <EmptyState title="Dashboard unavailable" description={error ?? 'No active league was found.'} />;
  }

  const previousGame = data.prev_game;
  const upcomingGame = data.curr_game;

  return (
    <Page
      eyebrow="Season Hub"
      title={`${team.ranking > 0 ? `#${team.ranking} ` : ''}${team.name} ${team.mascot}`}
      description={`Record: ${team.record}  •  Rating: ${team.rating}`}
      actions={<Button to={`/`}>Back to Launch</Button>}
      compact
    >
      <section className={styles.teamHeader} style={{ borderTopColor: team.colorPrimary || '#0f4c81' }}>
        <div className={styles.teamHeaderLeft}>
          <div className={styles.teamBadge} style={{ background: team.colorPrimary || '#0f4c81' }}>
            {team.abbreviation}
          </div>
          <div>
            <h2 className={styles.teamTitle}>
              {team.ranking > 0 ? `#${team.ranking} ` : ''}{team.name} {team.mascot}
            </h2>
            <p className={styles.teamSubtitle}>
              Record: <strong>{team.record}</strong>  •  Rating: <strong>{team.rating}</strong>
            </p>
          </div>
        </div>
        <div className={styles.teamHeaderRight}>
          <div className={styles.confBlock}>
            <span className={styles.confLabel}>Conference</span>
            <strong>{conferenceName}</strong>
          </div>
          <div className={styles.confBlock}>
            <span className={styles.confLabel}>Week</span>
            <strong>{data.info.currentWeek}</strong>
          </div>
        </div>
      </section>

      <div className={styles.workspace}>
        <Section title="Games">
          <div className={styles.gameStack}>
            <GameCard game={previousGame} label="Last Week" />
            <GameCard game={upcomingGame} label="This Week" />
          </div>
        </Section>

        <Section
          title={conferenceName ? `${conferenceName} Standings` : 'Independent Teams'}
          accent={team.colorPrimary || '#0f4c81'}
          actions={<Button to={standingsRoute(conferenceName)} variant="secondary">Full Standings</Button>}
        >
          <div className={styles.scrollPanel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Rating</th>
                  <th>Conf</th>
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {conferenceTeams.map((conferenceTeam) => (
                  <tr
                    key={conferenceTeam.name}
                    className={conferenceTeam.name === team.name ? styles.highlightRow : undefined}
                  >
                    <td>
                      <TeamMark
                        name={conferenceTeam.ranking > 0 ? `#${conferenceTeam.ranking} ${conferenceTeam.name}` : conferenceTeam.name}
                        meta={conferenceTeam.mascot}
                        accent={conferenceTeam.colorPrimary}
                      />
                    </td>
                    <td>{conferenceTeam.rating}</td>
                    <td>{conferenceTeam.confWins}-{conferenceTeam.confLosses}</td>
                    <td>{conferenceTeam.totalWins}-{conferenceTeam.totalLosses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="AP Top 10" accent="#0f4c81">
          <div className={styles.scrollPanel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {topTen.map((rankedTeam, index) => (
                  <tr
                    key={rankedTeam.name}
                    className={rankedTeam.name === team.name ? styles.highlightRow : undefined}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <TeamMark
                        name={rankedTeam.name}
                        meta={rankedTeam.mascot}
                        accent={rankedTeam.colorPrimary}
                      />
                    </td>
                    <td>{rankedTeam.record}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Headlines" accent="#2e7d32">
          <div className={styles.headlineList}>
            {topGameItems.length > 0 ? (
              topGameItems.map((game) => (
                <article className={styles.headlineCard} key={game.id}>
                  <a className={styles.headlineLink} href={`/game/${game.id}`}>
                    {game.headline}
                  </a>
                  {game.subtitle ? <p className={styles.headlineSubtitle}>{game.subtitle}</p> : null}
                  {game.tags?.length ? (
                    <div className={styles.tagRow}>
                      {game.tags.slice(0, 3).map((tag) => (
                        <span className={styles.tag} key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState title="No games played yet" description="Headlines will appear here once weekly results start landing." />
            )}
          </div>
        </Section>
      </div>
    </Page>
  );
};
