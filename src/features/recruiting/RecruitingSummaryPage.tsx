import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadRecruitingSummary } from '../../domain/league';
import type { Team } from '../../types/domain';
import type { RecruitingSummaryPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './RecruitingSummaryPage.module.css';

interface FreshmanPlayer {
  id: number;
  first: string;
  last: string;
  pos: string;
  rating: number;
  stars: number;
  teamName?: string;
}

type TeamRanking = RecruitingSummaryPageData['team_rankings'][number];

const starText = (count: number) => '★'.repeat(count);

export const RecruitingSummaryPage = () => {
  const [data, setData] = useState<RecruitingSummaryPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'teams' | 'players'>('teams');
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadRecruitingSummary();
        if (!cancelled) {
          setData(nextData);
          setSelectedTeamName(nextData.team_rankings[0]?.team_name ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load recruiting summary');
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

  const allFreshmen = useMemo(() => {
    if (!data) return [];
    return data.team_rankings
      .flatMap((teamRanking) => teamRanking.players.map((player) => ({ ...player, teamName: teamRanking.team_name })))
      .sort((left, right) => right.rating - left.rating);
  }, [data]);

  const displayedTeams = data?.team_rankings.slice(0, showAllTeams ? data.team_rankings.length : 25) ?? [];
  const selectedClass = useMemo(
    () => data?.team_rankings.find((ranking) => ranking.team_name === selectedTeamName) ?? null,
    [data, selectedTeamName]
  );

  if (loading) {
    return <LoadingState title="Loading recruiting summary" description="Pulling team classes and national freshman rankings." />;
  }

  if (error || !data) {
    return <EmptyState title="Recruiting summary unavailable" description={error ?? 'No recruiting data was found.'} />;
  }

  return (
    <Page
      eyebrow="Offseason Setup"
      title={`${data.info.currentYear} Recruiting Rankings`}
      description="Team classes and player rankings for the incoming freshman group."
      actions={<Button to="/roster_progression">Back to Progression</Button>}
      compact
    >
      <div className={styles.layout}>
        <div className={styles.statGrid}>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{data.summary_stats.total_freshmen}</p>
            <p className={styles.statLabel}>Total Freshmen</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{data.summary_stats.avg_rating}</p>
            <p className={styles.statLabel}>Average Rating</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{data.summary_stats.max_rating}</p>
            <p className={styles.statLabel}>Top Rating</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statValue}>{data.team_rankings.length}</p>
            <p className={styles.statLabel}>Classes Ranked</p>
          </article>
        </div>

        <Section
          title="Recruiting View"
          accent={data.team.colorPrimary || '#0f4c81'}
          actions={
            <div className={styles.toggleRow}>
              <button
                className={`${styles.toggleButton} ${view === 'teams' ? styles.toggleButtonActive : ''}`}
                onClick={() => setView('teams')}
                type="button"
              >
                Team Rankings
              </button>
              <button
                className={`${styles.toggleButton} ${view === 'players' ? styles.toggleButtonActive : ''}`}
                onClick={() => setView('players')}
                type="button"
              >
                Player Rankings
              </button>
            </div>
          }
        >
          {view === 'teams' ? (
            <div className={styles.detailGrid}>
              <div className={styles.tablePanel}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Total</th>
                      <th>5★</th>
                      <th>4★</th>
                      <th>3★</th>
                      <th>Avg Stars</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTeams.map((teamRanking, index) => (
                      <tr className={index % 2 === 1 ? styles.altRow : undefined} key={teamRanking.team_name}>
                        <td>#{index + 1}</td>
                        <td>
                          <button
                            className={styles.teamLink}
                            onClick={() => setSelectedTeamName(teamRanking.team_name)}
                            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                            type="button"
                          >
                            {teamRanking.team_name}
                          </button>
                        </td>
                        <td>{teamRanking.player_count}</td>
                        <td>{teamRanking.five_stars}</td>
                        <td>{teamRanking.four_stars}</td>
                        <td>{teamRanking.three_stars}</td>
                        <td>{teamRanking.avg_stars}</td>
                        <td>{teamRanking.weighted_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Section title="Selected Class" accent="#2e7d32">
                {selectedClass ? (
                  <div className={styles.layout}>
                    <div className={styles.classHeader}>
                      <strong>{selectedClass.team.name}</strong>
                      <span className={styles.metaText}>
                        {selectedClass.players.length} recruits • {selectedClass.team.conference} • Prestige {selectedClass.team.prestige}
                      </span>
                    </div>
                    <div className={styles.tablePanel}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Pos</th>
                            <th>Rating</th>
                            <th>Stars</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClass.players
                            .slice()
                            .sort((left, right) => right.rating - left.rating)
                            .map((player, index) => (
                              <tr className={index % 2 === 1 ? styles.altRow : undefined} key={player.id}>
                                <td>#{index + 1}</td>
                                <td>
                                  <Link className={styles.playerLink} to={`/players/${player.id}`}>
                                    {player.first} {player.last}
                                  </Link>
                                </td>
                                <td><span className={styles.chip}>{player.pos.toUpperCase()}</span></td>
                                <td>{player.rating}</td>
                                <td><span className={styles.stars}>{starText(player.stars)}</span></td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className={styles.metaText}>Select a recruiting class to inspect its incoming players.</div>
                )}
              </Section>
            </div>
          ) : allFreshmen.length > 0 ? (
            <div className={styles.tablePanel}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Team</th>
                    <th>Position</th>
                    <th>Rating</th>
                    <th>Stars</th>
                  </tr>
                </thead>
                <tbody>
                  {allFreshmen.slice(0, 100).map((player, index) => (
                    <tr className={index % 2 === 1 ? styles.altRow : undefined} key={player.id}>
                      <td>#{index + 1}</td>
                      <td>
                        <Link className={styles.playerLink} to={`/players/${player.id}`}>
                          {player.first} {player.last}
                        </Link>
                      </td>
                      <td>
                        <Link className={styles.teamLink} to={`/${player.teamName}/history`}>
                          {player.teamName}
                        </Link>
                      </td>
                      <td><span className={styles.chip}>{player.pos.toUpperCase()}</span></td>
                      <td>{player.rating}</td>
                      <td><span className={styles.stars}>{starText(player.stars)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No recruits found" description="No freshmen match the current recruiting summary." />
          )}
        </Section>

        {data.team_rankings.length > 25 && view === 'teams' ? (
          <Button onClick={() => setShowAllTeams((current) => !current)} variant="secondary">
            {showAllTeams ? `Show Top 25 (of ${data.team_rankings.length} teams)` : `Show All ${data.team_rankings.length} Teams`}
          </Button>
        ) : null}

        <Button to="/roster_cuts">Continue to Roster Cuts</Button>
      </div>
    </Page>
  );
};
