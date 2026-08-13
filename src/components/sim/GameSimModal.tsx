import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DriveSummary from '../game/DriveSummary';
import FootballField from '../game/FootballField';
import { buildNextHeader } from '../../domain/sim/ui';
import { resolveHomeAway } from '../../domain/utils/gameDisplay';
import { buildSimMatchup } from '../../domain/utils/simMatchup';
import GameSimCoachPanel from './GameSimCoachPanel';
import GameSimHeader from './GameSimHeader';
import GameSimWorkspace, { type GameSimView } from './GameSimWorkspace';
import { useGameSim } from './useGameSim';

export type GameSimCloseOutcome = 'cancelled' | 'discarded' | 'completed';

type GameSimModalProps = {
  open: boolean;
  gameId: number | null;
  onClose: (outcome: GameSimCloseOutcome) => void;
};

const GameSimModal = ({ open, gameId, onClose }: GameSimModalProps) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeView, setActiveView] = useState<GameSimView>('field');
  const [discardOpen, setDiscardOpen] = useState(false);
  const { state, actions } = useGameSim({ gameId });

  useEffect(() => {
    if (open && gameId) {
      setActiveView('field');
      setDiscardOpen(false);
      void actions.start();
    }
    // The session intentionally restarts only when the selected modal/game changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, open]);

  useEffect(() => {
    if (open && state.isGameComplete) setActiveView('drives');
  }, [open, state.isGameComplete]);

  const finishClose = (outcome: GameSimCloseOutcome) => {
    actions.reset();
    setDiscardOpen(false);
    onClose(outcome);
  };

  const requestClose = () => {
    if (!state.canClose) return;
    if (state.error?.kind === 'finalization') return;
    if (state.isGameComplete) {
      finishClose('completed');
    } else if (state.hasProgress) {
      setDiscardOpen(true);
    } else {
      finishClose('cancelled');
    }
  };

  const viewGameSummary = () => {
    if (!gameId || !state.isGameComplete) return;
    const completedGameId = gameId;
    finishClose('completed');
    navigate(`/game/${completedGameId}`);
  };

  const game = state.gameData;
  const teams = game
    ? resolveHomeAway({
        teamA: game.teamA,
        teamB: game.teamB,
        homeTeamId: game.homeTeamId ?? null,
        awayTeamId: game.awayTeamId ?? null,
        neutralSite: game.neutralSite,
      })
    : null;
  const matchup = game
    ? buildSimMatchup(
        game,
        {
          scoreA: state.displayPlay?.scoreA ?? game.scoreA,
          scoreB: state.displayPlay?.scoreB ?? game.scoreB,
        },
        state.isTeamAOnOffense,
        state.displayDrive?.driveNum ?? 0,
        {
          quarter: state.quarter,
          clockSecondsLeft: state.clockSecondsLeft,
          inOvertime: state.inOvertime,
          overtimeCount: state.overtimeCount,
          timeoutsRemainingA: state.timeoutsRemainingA,
          timeoutsRemainingB: state.timeoutsRemainingB,
        },
      )
    : null;

  const errorActions =
    state.error?.kind === 'preparation' ? (
      <Button variant="outlined" size="small" onClick={() => void actions.retryPreparation()}>
        Try Again
      </Button>
    ) : state.error?.kind === 'finalization' ? (
      <Button variant="outlined" size="small" onClick={() => window.location.reload()}>
        Reload Application
      </Button>
    ) : null;

  const drivesPanel = matchup ? (
    state.drives.length > 0 ? (
      <DriveSummary
        drives={state.drives}
        currentPlayIndex={state.currentPlayIndex}
        variant="modal"
        includeCurrentDrive
        matchup={matchup}
        embedded
      />
    ) : (
      <Stack
        sx={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 180,
          textAlign: 'center',
        }}
      >
        <Typography variant="subtitle1">No drives yet</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Simulate the opening play to begin the drive log.
        </Typography>
      </Stack>
    )
  ) : null;

  const field = game && teams ? (
    <FootballField
      currentYardLine={state.fieldPosition}
      homeTeam={teams.home}
      awayTeam={teams.away}
      neutralSite={teams.neutral}
      isOffenseLeftToRight={state.isTeamAOnOffense === state.openingIsTeamA}
      yardsToGo={state.displayPlay?.yardsLeft ?? 10}
    />
  ) : null;

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        maxWidth="xl"
        fullWidth
        fullScreen={fullScreen}
        aria-labelledby="live-simulation-title"
        slotProps={{
          paper: {
            variant: 'outlined',
            sx: {
              height: fullScreen ? '100dvh' : 'min(92dvh, 920px)',
              maxHeight: fullScreen ? '100dvh' : 'min(92dvh, 920px)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitle
          id="live-simulation-title"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Live simulation
        </DialogTitle>
        <DialogContent
          sx={{
            p: { xs: 1, sm: 1.5, lg: 2 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            minHeight: 0,
            overflow: 'hidden',
            backgroundColor: 'background.default',
          }}
        >
          {matchup ? (
            <GameSimHeader
              matchup={matchup}
              isComplete={state.isPlaybackComplete}
              canClose={state.canClose && state.error?.kind !== 'finalization'}
              onClose={requestClose}
            />
          ) : (
            <Box
              sx={{
                minHeight: 72,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                backgroundColor: 'background.paper',
                flexShrink: 0,
              }}
            >
              <Typography variant="subtitle1">Live Simulation</Typography>
            </Box>
          )}

          {state.error && (
            <Alert severity="error" action={errorActions} sx={{ flexShrink: 0 }}>
              {state.error.kind === 'finalization'
                ? 'The game finished, but its result could not be saved. Reload to reconcile with IndexedDB.'
                : state.error.message}
            </Alert>
          )}

          {!game && state.phase !== 'error' ? (
            <Stack
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 0, flex: 1 }}
            >
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Preparing simulation…
              </Typography>
            </Stack>
          ) : game && matchup ? (
            <Box
              sx={{
                minHeight: 0,
                flex: 1,
                overflowY: { xs: 'auto', lg: 'hidden' },
                scrollbarWidth: 'thin',
              }}
            >
              <GameSimWorkspace
                activeView={activeView}
                onViewChange={setActiveView}
                field={field}
                drives={drivesPanel}
                showCoachPanelOnDrives={state.isGameComplete}
                situationLabel={state.displayPlay?.header
                  ?? buildNextHeader(state.fieldPosition, 1, 10)}
                driveNumber={(state.displayDrive?.driveNum ?? 0) + 1}
                lastPlayText={state.lastPlayText}
                coachPanel={(
                  <GameSimCoachPanel
                    phase={state.phase}
                    coachingEnabled={state.coachingEnabled}
                    isGameComplete={state.isGameComplete}
                    decisionPrompt={state.decisionPrompt}
                    onAdvance={(scope) => void actions.advance(scope)}
                    onDecision={(decision) => void actions.advance('play', decision)}
                    managementSide={state.userSide}
                    selectedTempo={state.selectedTempo}
                    timeoutAfterPlay={state.timeoutAfterPlay}
                    canUseTimeout={state.canUseTimeout}
                    canShowSpike={state.canShowSpike}
                    canShowKneel={state.canShowKneel}
                    onTempoChange={actions.setTempo}
                    onTimeoutChange={actions.setTimeoutAfterPlay}
                    onClose={requestClose}
                    onViewGameSummary={viewGameSummary}
                  />
                )}
              />
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        aria-labelledby="discard-simulation-title"
      >
        <DialogTitle id="discard-simulation-title">Discard this simulation?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This game has not been saved. Closing now will discard every simulated play, and the
            game will restart from the beginning next time.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)}>Keep Simulating</Button>
          <Button color="error" onClick={() => finishClose('discarded')}>
            Discard Simulation
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GameSimModal;
