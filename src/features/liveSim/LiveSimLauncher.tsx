import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getGamesToLiveSim } from '../../domain/sim';
import { buildSimMatchup } from '../../domain/utils/simMatchup';
import { resolveHomeAway } from '../../domain/utils/gameDisplay';
import { LoadingState } from '../../ui/LoadingState';
import { useLiveGameSim } from './useLiveGameSim';
import styles from './LiveSim.module.css';

type LiveSimGame = Awaited<ReturnType<typeof getGamesToLiveSim>>['games'][number];

const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const formatQuarter = (quarter: number, inOvertime: boolean, overtimeCount: number) => {
  if (inOvertime) {
    return overtimeCount > 1 ? `${overtimeCount}OT` : 'OT';
  }

  return `Q${quarter}`;
};

const formatFieldPosition = (fieldPosition: number) => {
  const side = fieldPosition <= 50 ? 'OWN' : 'OPP';
  const yardLine = fieldPosition <= 50 ? fieldPosition : 100 - fieldPosition;
  return `${side} ${yardLine}`;
};

const SelectionModal = ({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (game: LiveSimGame) => void;
}) => {
  const [games, setGames] = useState<LiveSimGame[]>([]);
  const [week, setWeek] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getGamesToLiveSim();
        if (!cancelled) {
          setGames(response.games);
          setWeek(response.week);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to load live-sim games.');
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
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div className={styles.selectionModal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>Live Sim</span>
            <h2 className={styles.title}>Select a Week {week} Game</h2>
          </div>
          <button className="ui-button ui-button--secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className={styles.body}>
          {loading ? (
            <LoadingState title="Loading games" description="Pulling current unplayed matchups for this week." />
          ) : error ? (
            <div className={styles.empty}>{error}</div>
          ) : games.length === 0 ? (
            <div className={styles.empty}>No unplayed games are available to live sim this week.</div>
          ) : (
            <div className={styles.selectionList}>
              {games.map((game) => {
                const { home, away, neutral } = resolveHomeAway({
                  teamA: { id: game.teamAId, name: game.teamA.name },
                  teamB: { id: game.teamBId, name: game.teamB.name },
                  homeTeamId: game.homeTeamId ?? null,
                  awayTeamId: game.awayTeamId ?? null,
                  neutralSite: game.neutralSite ?? false,
                });
                const awayInfo = away.id === game.teamAId ? game.teamA : game.teamB;
                const homeInfo = home.id === game.teamAId ? game.teamA : game.teamB;

                return (
                  <button
                    className={game.is_user_game ? `${styles.selectionCard} ${styles.selectionCardUser}` : styles.selectionCard}
                    key={game.id}
                    onClick={() => onSelect(game)}
                    type="button"
                  >
                    <div className={styles.selectionTeams}>
                      <div className={styles.selectionSide}>
                        <span className={styles.selectionTeam}>
                          {awayInfo.ranking > 0 ? `#${awayInfo.ranking} ` : ''}
                          {awayInfo.name}
                        </span>
                        <span className={styles.selectionRecord}>{awayInfo.record}</span>
                      </div>

                      <div className={styles.selectionCenter}>
                        <span className={game.is_user_game ? `${styles.selectionBadge} ${styles.selectionBadgeUser}` : styles.selectionBadge}>
                          {game.is_user_game ? 'Your Game' : neutral ? 'VS' : 'AT'}
                        </span>
                      </div>

                      <div className={`${styles.selectionSide} ${styles.selectionSideRight}`}>
                        <span className={styles.selectionTeam}>
                          {homeInfo.ranking > 0 ? `#${homeInfo.ranking} ` : ''}
                          {homeInfo.name}
                        </span>
                        <span className={styles.selectionRecord}>{homeInfo.record}</span>
                      </div>
                    </div>

                    <div className={styles.selectionMeta}>
                      <span>{game.label}</span>
                      <span>Watchability {game.watchability}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const SimModal = ({
  gameId,
  isUserGame,
  onClose,
}: {
  gameId: number;
  isUserGame: boolean;
  onClose: (didPersist: boolean) => void;
}) => {
  const sim = useLiveGameSim({ gameId, allowUserDecision: isUserGame });
  const { state, actions } = sim;

  useEffect(() => {
    void actions.start();

    return () => {
      actions.reset();
    };
  }, [gameId]);

  const close = () => {
    const didPersist = state.hasSavedResult;
    actions.reset();
    onClose(didPersist);
  };

  const matchup = useMemo(() => {
    if (!state.gameData) return null;

    return buildSimMatchup(
      state.gameData,
      {
        scoreA: state.displayPlay?.scoreA ?? state.gameData.scoreA,
        scoreB: state.displayPlay?.scoreB ?? state.gameData.scoreB,
      },
      state.isTeamAOnOffense,
      state.displayDrive?.driveNum ?? 0,
      {
        quarter: state.quarter,
        clockSecondsLeft: state.clockSecondsLeft,
        inOvertime: state.inOvertime,
        overtimeCount: state.overtimeCount,
      }
    );
  }, [state.clockSecondsLeft, state.displayDrive?.driveNum, state.displayPlay?.scoreA, state.displayPlay?.scoreB, state.gameData, state.inOvertime, state.isTeamAOnOffense, state.overtimeCount, state.quarter]);

  const recentPlays = useMemo(() => state.plays.slice(-8).reverse(), [state.plays]);

  if (!state.gameData || !matchup) {
    return createPortal(
      <div className={styles.backdrop} role="presentation" onClick={close}>
        <div className={styles.simModal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
          <div className={styles.header}>
            <div className={styles.headerText}>
              <span className={styles.eyebrow}>Live Sim</span>
              <h2 className={styles.title}>Preparing Game</h2>
            </div>
            <button className="ui-button ui-button--secondary" onClick={close} type="button">
              Close
            </button>
          </div>
          <div className={styles.simBody}>
            <LoadingState title="Loading live sim" description="Bootstrapping the interactive game state." />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const markerLeft = `${Math.max(0, Math.min(100, state.fieldPosition))}%`;
  const driveLabel = state.displayDrive ? `Drive ${state.displayDrive.driveNum + 1}` : 'Opening Possession';

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={close}>
      <div className={styles.simModal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>Live Sim</span>
            <h2 className={styles.title}>{state.gameData.base_label}</h2>
          </div>
          <button className="ui-button ui-button--secondary" onClick={close} type="button">
            Close
          </button>
        </div>

        <div className={styles.simBody}>
          <section className={styles.scoreboard}>
            <div className={styles.scoreSide}>
              <span className={styles.scoreName}>{matchup.awayTeam.name}</span>
              <span className={styles.scoreMeta}>{matchup.awayTeam.record}</span>
              <span className={styles.scoreValue}>{matchup.awayScore}</span>
            </div>

            <div className={styles.centerScoreboard}>
              <span className={styles.centerLabel}>
                {formatQuarter(state.quarter, state.inOvertime, state.overtimeCount)} • {formatClock(state.clockSecondsLeft)}
              </span>
              <span className={styles.centerSituation}>{driveLabel}</span>
              <span className={styles.scoreMeta}>
                {state.isGameComplete ? 'Final' : matchup.isAwayOnOffense ? `${matchup.awayTeam.name} ball` : `${matchup.homeTeam.name} ball`}
              </span>
            </div>

            <div className={`${styles.scoreSide} ${styles.scoreSideRight}`}>
              <span className={styles.scoreName}>{matchup.homeTeam.name}</span>
              <span className={styles.scoreMeta}>{matchup.homeTeam.record}</span>
              <span className={styles.scoreValue}>{matchup.homeScore}</span>
            </div>
          </section>

          <div className={styles.layout}>
            <div className={styles.mainStack}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>Field Position</h3>
                  <span className={styles.scoreMeta}>{formatFieldPosition(state.fieldPosition)}</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.field}>
                    <div className={styles.fieldTrack}>
                      <div className={styles.fieldMidline} />
                      <div className={styles.fieldMarker} style={{ left: markerLeft }} />
                    </div>
                    <div className={styles.fieldMeta}>
                      <span>Previous Play: {state.previousPlayYards >= 0 ? `+${state.previousPlayYards}` : state.previousPlayYards} yds</span>
                      <span>{state.displayPlay?.down ? `${state.displayPlay.down}${state.displayPlay.down === 1 ? 'st' : state.displayPlay.down === 2 ? 'nd' : state.displayPlay.down === 3 ? 'rd' : 'th'} & ${state.displayPlay.yardsLeft}` : 'Waiting for snap'}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>Current Play</h3>
                  <span className={styles.scoreMeta}>{state.displayPlay?.result || 'Live'}</span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.playCard}>
                    <div className={styles.playHeader}>
                      <span>{state.displayPlay?.header ?? 'No play yet'}</span>
                      <span>{state.lastPlayText ? 'Latest update' : ''}</span>
                    </div>
                    <p className={styles.playSituation}>{state.displayPlay?.text || 'Use the controls below to start the possession.'}</p>
                    <p className={styles.playText}>
                      {state.lastPlayText || 'The live-sim engine is ready. Step through one play, one drive, or the full game.'}
                    </p>
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>Controls</h3>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.controls}>
                    {isUserGame && state.isUserOffenseNow && state.decisionPrompt ? (
                      <div className={styles.decisionPrompt}>
                        <p className={styles.decisionTitle}>User Decision Needed</p>
                        <p className={styles.decisionMeta}>
                          {state.decisionPrompt.down}th down style prompt: {state.decisionPrompt.yards_left} yards left at {formatFieldPosition(state.decisionPrompt.field_position)}.
                        </p>
                        <div className={styles.actionRow}>
                          <button className="ui-button ui-button--secondary" disabled={state.submittingDecision} onClick={() => void actions.handleDecision('run')} type="button">
                            Run
                          </button>
                          <button className="ui-button ui-button--secondary" disabled={state.submittingDecision} onClick={() => void actions.handleDecision('pass')} type="button">
                            Pass
                          </button>
                          {state.decisionPrompt.type === 'fourth_down' ? (
                            <>
                              <button className="ui-button ui-button--ghost" disabled={state.submittingDecision} onClick={() => void actions.handleDecision('punt')} type="button">
                                Punt
                              </button>
                              <button className="ui-button ui-button--ghost" disabled={state.submittingDecision} onClick={() => void actions.handleDecision('field_goal')} type="button">
                                Field Goal
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.actionRow}>
                      <button className="ui-button ui-button--secondary" disabled={state.isGameComplete} onClick={() => void actions.simulateAutoPlays(1)} type="button">
                        Next Play
                      </button>
                      <button className="ui-button ui-button--secondary" disabled={state.isGameComplete} onClick={() => void actions.simulateAutoDrive()} type="button">
                        Next Drive
                      </button>
                      <button className="ui-button ui-button--primary" disabled={state.isGameComplete} onClick={() => void actions.simulateToEnd()} type="button">
                        Sim To End
                      </button>
                    </div>

                    {state.isGameComplete ? (
                      <div className={styles.empty}>Game complete. Closing this modal will refresh the rest of the app.</div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>Recent Plays</h3>
                </div>
                <div className={styles.panelBody}>
                  {recentPlays.length > 0 ? (
                    <div className={styles.playFeed}>
                      {recentPlays.map((play) => (
                        <article className={styles.playFeedItem} key={play.id}>
                          <div className={styles.playFeedHeader}>
                            <span>{play.header}</span>
                            <span>{play.result || play.playType}</span>
                          </div>
                          <p className={styles.playFeedText}>{play.text}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>No plays yet.</div>
                  )}
                </div>
              </section>
            </div>

            <div className={styles.sideStack}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3 className={styles.panelTitle}>Drive Summary</h3>
                </div>
                <div className={styles.panelBody}>
                  {state.drives.length > 0 ? (
                    <div className={styles.driveList}>
                      {state.drives.map((drive) => (
                        <article className={styles.driveCard} key={`${drive.driveNum}-${drive.offense}`}>
                          <div className={styles.driveHeader}>
                            <span>Drive {drive.driveNum + 1}</span>
                            <span>{drive.offense}</span>
                          </div>
                          <div className={styles.driveMeta}>
                            <span>{drive.result || 'In progress'}</span>
                            <span>{drive.points} pts</span>
                            <span>Start {formatFieldPosition(drive.startingFP)}</span>
                            <span>{drive.plays.length} plays</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>Drive data will populate as the game unfolds.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const LiveSimLauncher = ({ enabled }: { enabled: boolean }) => {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<{ gameId: number; isUserGame: boolean } | null>(null);

  if (!enabled) return null;

  return (
    <>
      <button className="app-shell__nav-link" onClick={() => setSelectionOpen(true)} type="button">
        Live Sim
      </button>

      <SelectionModal
        open={selectionOpen}
        onClose={() => setSelectionOpen(false)}
        onSelect={(game) => {
          setSelectionOpen(false);
          setSelectedGame({ gameId: game.id, isUserGame: game.is_user_game });
        }}
      />

      {selectedGame ? (
        <SimModal
          gameId={selectedGame.gameId}
          isUserGame={selectedGame.isUserGame}
          onClose={(didPersist) => {
            setSelectedGame(null);
            if (didPersist) {
              window.dispatchEvent(new Event('pageDataRefresh'));
            }
          }}
        />
      ) : null}
    </>
  );
};
