import { useEffect, useMemo, useState } from 'react';
import { loadPlayoff } from '../../domain/league';
import type { PlayoffPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import styles from './NewPlayoffPage.module.css';

type TeamSeedEntry = PlayoffPageData['playoff_teams'][number];
type ResumeEntry = PlayoffPageData['resume_teams'][number];
type BowlEntry = PlayoffPageData['bowl_games'][number];

type BracketGame = {
  game_id?: number;
  team1: string;
  team2: string;
  seed1: number | null;
  seed2: number | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
};

const playoffLabel = (teams: number) => `${teams} Teams`;

const teamLine = (name: string, seed: number | null) => `${seed ? `#${seed} ` : ''}${name}`;

const resultLine = (game: BracketGame) =>
  game.score1 != null && game.score2 != null ? `${game.score1}-${game.score2}` : 'TBD';

const gameHref = (gameId?: number) => (gameId ? `/__new/game/${gameId}` : undefined);

const BracketGameCard = ({ game }: { game: BracketGame }) => (
  <article className={styles.gameCard}>
    <div className={styles.gameTeams}>
      <div className={styles.teamRow}>
        <span>{teamLine(game.team1, game.seed1)}</span>
        <strong>{game.score1 ?? '—'}</strong>
      </div>
      <div className={styles.teamRow}>
        <span>{teamLine(game.team2, game.seed2)}</span>
        <strong>{game.score2 ?? '—'}</strong>
      </div>
    </div>
    <div className={styles.gameMeta}>
      <span className={game.winner ? styles.chipSuccess : styles.chipNeutral}>
        {game.winner ? `Winner: ${game.winner}` : 'Awaiting result'}
      </span>
      {gameHref(game.game_id) ? (
        <a className={styles.gameLink} href={gameHref(game.game_id)}>
          Open Game
        </a>
      ) : null}
    </div>
  </article>
);

export const NewPlayoffPage = () => {
  const [data, setData] = useState<PlayoffPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextData = await loadPlayoff();
        if (!cancelled) {
          setData(nextData);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load playoff data');
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

  const bowlData = useMemo(() => {
    if (!data) return [];
    return data.bowl_games.length ? data.bowl_games : data.bowl_projections;
  }, [data]);

  if (loading) {
    return <LoadingState title="Loading postseason hub" description="Pulling bracket, committee snapshot, and bowl slate." />;
  }

  if (error || !data) {
    return <EmptyState title="Playoff unavailable" description={error ?? 'No postseason data was found.'} />;
  }

  const format = data.playoff.teams;
  const bracket = data.bracket as Record<string, unknown>;

  return (
    <Page
      eyebrow="Postseason"
      title="Postseason Hub"
      description="Championship bracket, committee snapshot, and bowl slate in one place."
      actions={<Button to="/__new/dashboard">Back to Dashboard</Button>}
      compact
    >
      <section className={styles.hero}>
        <div>
          <h2 className={styles.heroTitle}>Postseason Hub</h2>
          <p className={styles.heroMeta}>Championship and bowl slate in a single season-defining view.</p>
        </div>
        <div className={styles.settingsRow}>
          <div className={styles.settingItem}>
            <span>Format:</span>
            <span className={styles.chipPrimary}>{playoffLabel(data.playoff.teams)}</span>
          </div>
          {data.playoff.teams === 12 ? (
            <>
              <div className={styles.settingItem}>
                <span>Auto Bids:</span>
                <strong>{data.playoff.autobids}</strong>
              </div>
              <div className={styles.settingItem}>
                <span>Top 4:</span>
                <strong>{data.playoff.conf_champ_top_4 ? 'Conf Champs' : 'Highest Ranked'}</strong>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {data.is_projection ? (
        <div className={styles.notice}>
          This is a playoff projection based on current rankings. The actual playoff bracket will be determined after Week {data.info.lastWeek - 1}.
        </div>
      ) : null}

      <div className={styles.grid}>
        <Section title="Bracket" accent={data.team.colorPrimary || '#0f4c81'}>
          {format === 2 ? (
            <div className={styles.stack}>
              <BracketGameCard game={bracket.championship as BracketGame} />
            </div>
          ) : null}

          {format === 4 ? (
            <div className={styles.roundGrid}>
              <div className={styles.roundColumn}>
                <p className={styles.roundTitle}>Semifinals</p>
                {((bracket.semifinals as BracketGame[]) ?? []).map((game, index) => (
                  <BracketGameCard game={game} key={index} />
                ))}
              </div>
              <div className={styles.roundColumn}>
                <p className={styles.roundTitle}>Championship</p>
                <BracketGameCard game={bracket.championship as BracketGame} />
              </div>
            </div>
          ) : null}

          {format === 12 ? (
            <div className={styles.roundGrid}>
              <div className={styles.roundColumn}>
                <p className={styles.roundTitle}>Left Bracket</p>
                {((bracket.left_bracket as { first_round: BracketGame[]; quarterfinals: BracketGame[]; semifinal: BracketGame })?.first_round ?? []).map((game, index) => (
                  <BracketGameCard game={game} key={`lfr-${index}`} />
                ))}
                {((bracket.left_bracket as { first_round: BracketGame[]; quarterfinals: BracketGame[]; semifinal: BracketGame })?.quarterfinals ?? []).map((game, index) => (
                  <BracketGameCard game={game} key={`lq-${index}`} />
                ))}
                {(bracket.left_bracket as { semifinal: BracketGame })?.semifinal ? (
                  <BracketGameCard game={(bracket.left_bracket as { semifinal: BracketGame }).semifinal} />
                ) : null}
              </div>
              <div className={styles.roundColumn}>
                <p className={styles.roundTitle}>Right Bracket</p>
                {((bracket.right_bracket as { first_round: BracketGame[]; quarterfinals: BracketGame[]; semifinal: BracketGame })?.first_round ?? []).map((game, index) => (
                  <BracketGameCard game={game} key={`rfr-${index}`} />
                ))}
                {((bracket.right_bracket as { first_round: BracketGame[]; quarterfinals: BracketGame[]; semifinal: BracketGame })?.quarterfinals ?? []).map((game, index) => (
                  <BracketGameCard game={game} key={`rq-${index}`} />
                ))}
                {(bracket.right_bracket as { semifinal: BracketGame })?.semifinal ? (
                  <BracketGameCard game={(bracket.right_bracket as { semifinal: BracketGame }).semifinal} />
                ) : null}
              </div>
              <div className={styles.roundColumn}>
                <p className={styles.roundTitle}>Championship</p>
                <BracketGameCard game={bracket.championship as BracketGame} />
              </div>
            </div>
          ) : null}
        </Section>

        <Section title="Playoff Field" accent="#2e7d32">
          <div className={styles.tablePanel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Seed</th>
                  <th>Team</th>
                  <th>Record</th>
                  <th>Conference</th>
                  <th>Tag</th>
                </tr>
              </thead>
              <tbody>
                {data.playoff_teams.map((team: TeamSeedEntry, index) => (
                  <tr className={index % 2 === 1 ? styles.altRow : undefined} key={team.name}>
                    <td>#{team.seed}</td>
                    <td><a className={styles.teamLink} href={`/__new/${team.name}/history`}>{team.name}</a></td>
                    <td>{team.record}</td>
                    <td>{team.conference}</td>
                    <td>{team.is_autobid ? <span className={styles.chipSuccess}>Auto Bid</span> : <span className={styles.chipNeutral}>At Large</span>}</td>
                  </tr>
                ))}
                {data.bubble_teams.map((team, index) => (
                  <tr className={(data.playoff_teams.length + index) % 2 === 1 ? styles.altRow : undefined} key={team.name}>
                    <td>#{team.ranking}</td>
                    <td><a className={styles.teamLink} href={`/__new/${team.name}/history`}>{team.name}</a></td>
                    <td>{team.record}</td>
                    <td>{team.conference}</td>
                    <td><span className={styles.chip}>Bubble</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="Committee Snapshot" accent="#0f4c81">
        <div className={styles.tablePanel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Record</th>
                <th>Rating</th>
                <th>SOR</th>
                <th>Ranked Wins</th>
                <th>Losses</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.resume_teams.map((team: ResumeEntry, index) => (
                <tr className={index % 2 === 1 ? styles.altRow : undefined} key={team.name}>
                  <td>#{team.ranking}</td>
                  <td><a className={styles.teamLink} href={`/__new/${team.name}/history`}>{team.name}</a></td>
                  <td>{team.record}</td>
                  <td>{team.rating}</td>
                  <td>#{team.sor_rank}</td>
                  <td>{team.ranked_wins}</td>
                  <td>{team.losses}</td>
                  <td>{team.ranking <= (format === 2 ? 2 : format === 4 ? 4 : 12) ? <span className={styles.chipPrimary}>In</span> : <span className={styles.chipNeutral}>Out</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Bowl Slate" accent="#9c6a13">
        {bowlData.length > 0 ? (
          <div className={styles.tablePanel}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Bowl</th>
                  <th>Matchup</th>
                  <th>Records</th>
                  <th>Tags</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {bowlData.map((game: BowlEntry, index) => (
                  <tr className={index % 2 === 1 ? styles.altRow : undefined} key={`${game.name}-${game.id}-${index}`}>
                    <td>
                      {game.id > 0 ? (
                        <a className={styles.gameLink} href={`/__new/game/${game.id}`}>{game.name}</a>
                      ) : (
                        <span>{game.name}</span>
                      )}
                    </td>
                    <td>
                      <a className={styles.teamLink} href={`/__new/${game.teamA}/history`}>#{game.rankA} {game.teamA}</a>
                      <span className={styles.subtle}> vs </span>
                      <a className={styles.teamLink} href={`/__new/${game.teamB}/history`}>#{game.rankB} {game.teamB}</a>
                    </td>
                    <td>{game.recordA} / {game.recordB}</td>
                    <td>
                      <div className={styles.gameMeta}>
                        {game.is_ny6 ? <span className={styles.chipPrimary}>NY6</span> : null}
                        {game.is_projection ? <span className={styles.chip}>Projection</span> : null}
                        {game.teamA_is_champ ? <span className={styles.chipSuccess}>{game.teamA_conf} Champ</span> : null}
                        {game.teamB_is_champ ? <span className={styles.chipSuccess}>{game.teamB_conf} Champ</span> : null}
                      </div>
                    </td>
                    <td>{game.scoreA != null && game.scoreB != null ? `${game.scoreA}-${game.scoreB}` : 'TBD'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No bowl slate yet" description="Bowl projections or results will appear here once the postseason picture forms." />
        )}
      </Section>
    </Page>
  );
};
