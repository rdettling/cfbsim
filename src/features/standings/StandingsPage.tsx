import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadStandings } from '../../domain/league';
import { formatOpponentPrefix } from '../../domain/utils/gameDisplay';
import type { ScheduleGame } from '../../types/domain';
import type { StandingsPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './StandingsPage.module.css';

const normalizeConferenceName = (conferenceName: string) =>
  conferenceName === 'Independent' ? 'independent' : conferenceName;

const titleFor = (conferenceName: string) =>
  conferenceName === 'independent' ? 'Independent Teams' : `${conferenceName} Standings`;

const getOpponentLabel = (game: ScheduleGame | null) => {
  if (!game?.opponent) return 'No game';
  const prefix = formatOpponentPrefix(game.location);
  const rankedName = game.opponent.ranking > 0 ? `#${game.opponent.ranking} ${game.opponent.name}` : game.opponent.name;
  return prefix ? `${prefix} ${rankedName}` : rankedName;
};

const resultToneClass = (result: string) => {
  if (result.includes('W')) return styles.resultWin;
  if (result.includes('L')) return styles.resultLoss;
  return styles.resultNeutral;
};

const GameSummary = ({ game }: { game: ScheduleGame | null }) => {
  if (!game?.opponent) {
    return <span className={styles.subtle}>No game</span>;
  }

  return (
    <div className={styles.gameCell}>
      <span>{getOpponentLabel(game)}</span>
      {game.id ? (
        <Link className={game.result ? resultToneClass(game.result) : styles.teamLink} to={`/game/${game.id}`}>
          {game.result ? `${game.result}: ${game.score}` : 'Preview'}
        </Link>
      ) : (
        <span className={styles.subtle}>{game.label || 'Scheduled'}</span>
      )}
    </div>
  );
};

export const StandingsPage = () => {
  const navigate = useNavigate();
  const { conferenceName } = useParams();
  const [data, setData] = useState<StandingsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!conferenceName) {
          throw new Error('No conference specified');
        }
        const nextData = await loadStandings(conferenceName);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load standings');
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
  }, [conferenceName]);

  const conferenceOptions = useMemo(() => {
    if (!data) return [];
    return [
      ...data.conferences.map((conference) => conference.confName),
      'Independent',
    ].sort((left, right) => left.localeCompare(right));
  }, [data]);

  if (loading) {
    return <LoadingState title="Loading standings" description="Pulling conference records and recent game context." />;
  }

  if (error || !data || !conferenceName) {
    return <EmptyState title="Standings unavailable" description={error ?? 'No standings data was found.'} />;
  }

  const selectedValue = conferenceName === 'independent' ? 'Independent' : data.conference;

  return (
    <Page
      eyebrow="Conference View"
      title={titleFor(conferenceName)}
      description={`${data.info.currentYear} season through week ${data.info.currentWeek}`}
      actions={<Button to="/dashboard">Back to Dashboard</Button>}
      compact
    >
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <h2 className={styles.heroTitle}>{conferenceName === 'independent' ? 'Independent Teams' : data.conference}</h2>
            <p className={styles.heroMeta}>Conference race, last result, and next matchup at a glance.</p>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Conference</span>
            <select
              className={styles.select}
              onChange={(event) => navigate(`/standings/${normalizeConferenceName(event.target.value)}`)}
              value={selectedValue}
            >
              {conferenceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <Section title={titleFor(conferenceName)} accent={data.team.colorPrimary || '#0f4c81'}>
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                {conferenceName !== 'independent' ? <th>Conf</th> : null}
                <th>Overall</th>
                <th>Last Week</th>
                <th>This Week</th>
              </tr>
            </thead>
            <tbody>
              {data.teams.map((team, index) => (
                <tr className={index % 2 === 1 ? styles.altRow : undefined} key={team.id}>
                  <td className={styles.rankCell}>{index + 1}</td>
                  <td>
                    <Link className={styles.teamLink} to={`/${team.name}/history`}>
                      <TeamMark
                        name={team.ranking > 0 ? `#${team.ranking} ${team.name}` : team.name}
                        meta={team.mascot}
                        accent={team.colorPrimary}
                      />
                    </Link>
                  </td>
                  {conferenceName !== 'independent' ? <td>{team.confWins}-{team.confLosses}</td> : null}
                  <td>{team.totalWins}-{team.totalLosses}</td>
                  <td><GameSummary game={team.last_game} /></td>
                  <td><GameSummary game={team.next_game} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </Page>
  );
};
