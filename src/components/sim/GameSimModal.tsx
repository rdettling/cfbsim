import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import DriveSummary from '../game/DriveSummary';
import FootballField from '../game/FootballField';
import GameControls from '../game/GameControls';
import GameScoreStrip from '../game/GameScoreStrip';
import { resolveHomeAway } from '../../domain/utils/gameDisplay';
import { buildSimMatchup } from '../../domain/utils/simMatchup';
import { useGameSim } from './useGameSim';

export type GameSimCloseOutcome = 'cancelled' | 'discarded' | 'completed';

type GameSimModalProps = {
  open: boolean;
  gameId: number | null;
  onClose: (outcome: GameSimCloseOutcome) => void;
};

type NarrowPanel = 'game' | 'drives';

const GameSimModal = ({
  open,
  gameId,
  onClose,
}: GameSimModalProps) => {
  const theme = useTheme();
  const narrowLayout = useMediaQuery(theme.breakpoints.down('lg'));
  const [narrowPanel, setNarrowPanel] = useState<NarrowPanel>('game');
  const [discardOpen, setDiscardOpen] = useState(false);
  const { state, actions } = useGameSim({ gameId });

  useEffect(() => {
    if (open && gameId) {
      setNarrowPanel('game');
      setDiscardOpen(false);
      void actions.start();
    }
    // The session intentionally restarts only when the selected modal/game changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, open]);

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
        }
      )
    : null;

  const gamePanel = game && teams ? (
    <Stack spacing={1.25}>
      <FootballField
        currentYardLine={state.fieldPosition}
        homeTeam={teams.home}
        awayTeam={teams.away}
        neutralSite={teams.neutral}
        isOffenseLeftToRight={state.isTeamAOnOffense === state.openingIsTeamA}
        down={state.displayPlay?.down ?? 1}
        yardsToGo={state.displayPlay?.yardsLeft ?? 10}
        previousPlayYards={state.previousPlayYards}
      />
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={0.5}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2">
              {state.displayPlay?.header ?? 'Waiting for the opening snap'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {state.lastPlayText ? `Last play: ${state.lastPlayText}` : 'No plays yet'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            Drive {(state.displayDrive?.driveNum ?? 0) + 1}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  ) : null;

  const drivesPanel = matchup ? (
    state.drives.length > 0 ? (
      <DriveSummary
        drives={state.drives}
        currentPlayIndex={state.currentPlayIndex}
        variant="modal"
        includeCurrentDrive
        matchup={matchup}
      />
    ) : (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180, textAlign: 'center' }}>
        <Typography variant="subtitle1">No drives yet</Typography>
        <Typography variant="body2" color="text.secondary">
          Simulate the opening play to begin the drive log.
        </Typography>
      </Stack>
    )
  ) : null;

  const errorActions = state.error?.kind === 'preparation' ? (
    <Button variant="outlined" size="small" onClick={() => void actions.retryPreparation()}>
      Try Again
    </Button>
  ) : state.error?.kind === 'finalization' ? (
    <Button variant="outlined" size="small" onClick={() => window.location.reload()}>
      Reload Application
    </Button>
  ) : null;

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        maxWidth="xl"
        fullWidth
        fullScreen={narrowLayout}
        aria-labelledby="live-simulation-title"
        slotProps={{
          paper: {
            variant: 'outlined',
            sx: {
              height: narrowLayout ? '100dvh' : 'min(92vh, 920px)',
              maxHeight: narrowLayout ? '100dvh' : 'min(92vh, 920px)',
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
          <Stack direction="row" spacing={1} alignItems="stretch" sx={{ flexShrink: 0 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {matchup ? (
                <GameScoreStrip
                  matchup={matchup}
                  isPlaybackComplete={state.isPlaybackComplete}
                />
              ) : (
                <Paper
                  variant="outlined"
                  sx={{ minHeight: 72, display: 'grid', placeItems: 'center' }}
                >
                  <Typography variant="subtitle1">Live Simulation</Typography>
                </Paper>
              )}
            </Box>
            <IconButton
              onClick={requestClose}
              disabled={!state.canClose || state.error?.kind === 'finalization'}
              aria-label="Close live simulation"
              sx={{
                alignSelf: 'flex-start',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                backgroundColor: 'background.paper',
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>

          {state.error && (
            <Alert
              severity="error"
              action={errorActions}
              sx={{ flexShrink: 0 }}
            >
              {state.error.kind === 'finalization'
                ? 'The game finished, but its result could not be saved. Reload to reconcile with IndexedDB.'
                : state.error.message}
            </Alert>
          )}

          {!game && state.phase !== 'error' ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{ minHeight: 0, flex: 1 }}
            >
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                Preparing simulation…
              </Typography>
            </Stack>
          ) : game ? (
            <>
              {narrowLayout ? (
                <>
                  <Tabs
                    value={narrowPanel}
                    onChange={(_, value: NarrowPanel) => setNarrowPanel(value)}
                    aria-label="Live simulation panels"
                    selectionFollowsFocus
                    sx={{ minHeight: 40, flexShrink: 0 }}
                  >
                    <Tab
                      id="live-sim-game-tab"
                      aria-controls="live-sim-game-panel"
                      value="game"
                      label="Game"
                      sx={{ minHeight: 40 }}
                    />
                    <Tab
                      id="live-sim-drives-tab"
                      aria-controls="live-sim-drives-panel"
                      value="drives"
                      label="Drives"
                      sx={{ minHeight: 40 }}
                    />
                  </Tabs>
                  <Box
                    id={`live-sim-${narrowPanel}-panel`}
                    role="tabpanel"
                    aria-labelledby={`live-sim-${narrowPanel}-tab`}
                    sx={{ minHeight: 0, flex: 1, overflowY: 'auto', pr: 0.5 }}
                  >
                    {narrowPanel === 'game' ? gamePanel : drivesPanel}
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
                    gap: 1.5,
                    minHeight: 0,
                    flex: 1,
                  }}
                >
                  <Box sx={{ minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
                    {gamePanel}
                  </Box>
                  <Paper
                    variant="outlined"
                    sx={{ minHeight: 0, overflowY: 'auto', p: 1.25 }}
                  >
                    {drivesPanel}
                  </Paper>
                </Box>
              )}

              <Box sx={{ flexShrink: 0 }}>
                <GameControls
                  phase={state.phase}
                  decisionPrompt={
                    state.isUserOffenseNow ? state.decisionPrompt : null
                  }
                  onAdvance={scope => void actions.advance(scope)}
                  onDecision={decision => void actions.advance('play', decision)}
                />
              </Box>
            </>
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
          <Typography variant="body2" color="text.secondary">
            This game has not been saved. Closing now will discard every simulated
            play, and the game will restart from the beginning next time.
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
