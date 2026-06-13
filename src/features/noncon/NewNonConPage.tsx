import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listAvailableTeams, loadNonCon, scheduleNonConGame, startNewLeague } from '../../domain/league';
import type { NonConPageData } from '../../types/pages';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { Page } from '../../ui/Page';
import { Section } from '../../ui/Section';
import { TeamMark } from '../../ui/TeamMark';
import styles from './NewNonConPage.module.css';

type LaunchState = {
  fromHome?: boolean;
  team?: string;
  year?: string;
  playoff?: {
    teams: number;
    autobids?: number;
    conf_champ_top_4?: boolean;
  };
};

export const NewNonConPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const launchState = (location.state ?? {}) as LaunchState;
  const [data, setData] = useState<NonConPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedLaunchState, setUsedLaunchState] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState('');

  const fetchData = async () => {
    if (!usedLaunchState && launchState.fromHome && launchState.team && launchState.year) {
      const response = await startNewLeague(launchState.team, launchState.year, launchState.playoff);
      setUsedLaunchState(true);
      navigate('/__new/noncon', { replace: true, state: {} });
      return response;
    }
    return loadNonCon();
  };

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const nextData = await fetchData();
      setData(nextData);
    } catch (err) {
      setError((err as Error).message || 'Failed to load non-conference scheduling');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  const scheduledWeeks = useMemo(() => data?.schedule.filter((game) => game.opponent).length || 0, [data]);
  const totalWeeks = data?.schedule.length || 0;
  const byeWeeks = totalWeeks - scheduledWeeks;

  const handleOpenModal = async (week: number) => {
    try {
      const teams = await listAvailableTeams(week);
      setAvailableTeams(teams);
      setSelectedWeek(week);
      setModalOpen(true);
    } catch (err) {
      setError((err as Error).message || 'Failed to load available teams');
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedOpponent('');
    setSelectedWeek(null);
  };

  const handleScheduleGame = async () => {
    if (selectedWeek == null || !selectedOpponent) return;
    try {
      await scheduleNonConGame(selectedOpponent, selectedWeek);
      handleCloseModal();
      await refetch();
    } catch (err) {
      setError((err as Error).message || 'Failed to schedule game');
    }
  };

  if (loading) {
    return <LoadingState title="Loading non-conference scheduling" description="Preparing the preseason slate and rivalry placeholders." />;
  }

  if (error || !data) {
    return <EmptyState title="Non-conference scheduling unavailable" description={error ?? 'No scheduling data was found.'} />;
  }

  return (
    <Page
      eyebrow="Preseason"
      title={data.team.name}
      description="Build your non-conference slate. The remaining slots will auto-fill when you advance the season."
      actions={<Button to="/__new/dashboard">Skip to Dashboard</Button>}
      compact
    >
      <section className={styles.hero}>
        <h2 className={styles.heroTitle}>{data.team.name}</h2>
        <p className={styles.heroMeta}>Build your non-conference slate. The remaining slots will auto-fill when you advance the season.</p>
        <div className={styles.chipRow}>
          <span className={styles.chipPrimary}>Non-Conf: {data.team.nonConfGames}/{data.team.nonConfLimit}</span>
          <span className={styles.chip}>Weeks Scheduled: {scheduledWeeks}/{totalWeeks}</span>
          <span className={styles.chipSuccess}>Bye Weeks: {byeWeeks}</span>
        </div>
      </section>

      <div className={styles.layout}>
        <Section title="Schedule" accent={data.team.colorPrimary || '#0f4c81'}>
          <div className={styles.scheduleStack}>
            {data.schedule.map((game) => (
              <article className={styles.gameCard} key={game.weekPlayed}>
                <div className={styles.gameRow}>
                  <div className={styles.gameMeta}>
                    <span className={styles.label}>Week {game.weekPlayed}</span>
                    <strong>{game.opponent ? 'Game Scheduled' : 'Open Week'}</strong>
                    {game.label ? <span className={styles.heroMeta}>{game.label}</span> : null}
                  </div>

                  <div className={styles.opponentBlock}>
                    {game.opponent ? (
                      <div className={styles.opponentRow}>
                        {game.opponent.ranking ? <span className={styles.chip}>#{game.opponent.ranking}</span> : null}
                        <TeamMark name={game.opponent.name} meta={game.location || 'TBD'} accent="#0f4c81" />
                      </div>
                    ) : (
                      <span className={styles.heroMeta}>Slot available for non-conference scheduling.</span>
                    )}
                  </div>

                  <div>
                    {!game.opponent && data.team.nonConfGames < data.team.nonConfLimit ? (
                      <Button onClick={() => handleOpenModal(game.weekPlayed)}>Schedule Game</Button>
                    ) : (
                      <span className={styles.chip}>{game.opponent ? 'Locked' : 'Auto-fill'}</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <aside className={styles.panel}>
          <h3 className={styles.panelTitle}>Pending Rivalries</h3>
          <p className={styles.panelMeta}>These rivalry games will be placed once the full schedule is generated.</p>
          {data.pending_rivalries.length === 0 ? (
            <span className={styles.heroMeta}>All rivalry games are already placed.</span>
          ) : (
            <div className={styles.rivalryList}>
              {data.pending_rivalries.map((rivalry) => (
                <div className={styles.rivalryItem} key={rivalry.id}>
                  <strong>{rivalry.teamA} vs {rivalry.teamB}</strong>
                  <p className={styles.panelMeta}>
                    {rivalry.name || 'Rivalry game'} • {rivalry.homeTeam && rivalry.awayTeam ? `${rivalry.homeTeam} home` : 'Home/away TBD'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <Modal open={modalOpen} onClose={handleCloseModal} title="Schedule Non-Conference Game">
        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Opponent</span>
            <select className={styles.select} onChange={(event) => setSelectedOpponent(event.target.value)} value={selectedOpponent}>
              <option value="">Select opponent</option>
              {availableTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!selectedOpponent} onClick={handleScheduleGame}>Schedule</Button>
        </div>
      </Modal>
    </Page>
  );
};
