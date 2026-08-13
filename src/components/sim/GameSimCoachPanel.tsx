import FastForwardIcon from '@mui/icons-material/FastForward';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { ClockTempo } from '../../types/db';
import GameSimDecisionControls from './GameSimDecisionControls';
import GameSimManagementControls from './GameSimManagementControls';
import type {
  GameSimUserSide,
  SimulationAdvanceScope,
  SimulationDecision,
  SimulationDecisionPrompt,
  SimulationPhase,
} from './gameSimTypes';

type GameSimCoachPanelProps = {
  phase: SimulationPhase;
  coachingEnabled: boolean;
  isGameComplete: boolean;
  decisionPrompt: SimulationDecisionPrompt | null;
  onAdvance: (scope: SimulationAdvanceScope) => void;
  onDecision: (decision: SimulationDecision) => void;
  managementSide: GameSimUserSide;
  selectedTempo: ClockTempo | 'auto';
  timeoutAfterPlay: boolean;
  canUseTimeout: boolean;
  canShowSpike: boolean;
  canShowKneel: boolean;
  onTempoChange: (tempo: ClockTempo | 'auto') => void;
  onTimeoutChange: (armed: boolean) => void;
  onClose: () => void;
  onViewGameSummary: () => void;
};

const GameSimCoachPanel = ({
  phase,
  coachingEnabled,
  isGameComplete,
  decisionPrompt,
  onAdvance,
  onDecision,
  managementSide,
  selectedTempo,
  timeoutAfterPlay,
  canUseTimeout,
  canShowSpike,
  canShowKneel,
  onTempoChange,
  onTimeoutChange,
  onClose,
  onViewGameSummary,
}: GameSimCoachPanelProps) => {
  const busy = phase === 'advancing' || phase === 'finalizing';
  const disabled = phase !== 'ready';
  const busyLabel = phase === 'finalizing' ? 'Saving final result…' : 'Simulating…';
  const isTry = decisionPrompt?.type === 'try';
  const showManagement = coachingEnabled && Boolean(managementSide) && !isTry;

  if (isGameComplete) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, lg: 1 } }}>
        <Stack
          spacing={{ xs: 1.5, lg: 1 }}
          sx={{
            flexDirection: { lg: 'row' },
            alignItems: { lg: 'center' },
            justifyContent: { lg: 'space-between' },
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontSize: { lg: '1rem' } }}>Game complete</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              The final result and game detail have been saved.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75}>
            <Button variant="outlined" onClick={onViewGameSummary}>Game Summary</Button>
            <Button variant="contained" onClick={onClose} sx={{ minWidth: { lg: 120 } }}>Close</Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {coachingEnabled && (
        <GameSimDecisionControls
          decisionPrompt={decisionPrompt}
          disabled={disabled}
          onDecision={onDecision}
        />
      )}

      <Box
        sx={{
          display: { xs: 'contents', lg: 'grid' },
          gridTemplateColumns: {
            lg: showManagement ? 'minmax(0, 1fr) minmax(320px, 0.65fr)' : 'minmax(0, 1fr)',
          },
          alignItems: { lg: 'stretch' },
        }}
      >
        {showManagement && managementSide && (
          <GameSimManagementControls
            managementSide={managementSide}
            selectedTempo={selectedTempo}
            timeoutAfterPlay={timeoutAfterPlay}
            canUseTimeout={canUseTimeout}
            canShowSpike={canShowSpike}
            canShowKneel={canShowKneel}
            disabled={disabled}
            onDecision={onDecision}
            onTempoChange={onTempoChange}
            onTimeoutChange={onTimeoutChange}
          />
        )}

        <Box
          component="section"
          aria-label="Simulation shortcuts"
          sx={{
            p: { xs: 1.25, sm: 1.5, lg: 1 },
            borderLeft: { lg: showManagement ? '1px solid' : 0 },
            borderColor: 'divider',
            minWidth: 0,
          }}
        >
          <Stack
            spacing={{ xs: 1, lg: 0 }}
            sx={{
              display: { lg: 'grid' },
              rowGap: { lg: 0.25 },
              minWidth: 0,
            }}
          >
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'baseline', minWidth: 0 }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontSize: { lg: '0.75rem' }, whiteSpace: 'nowrap' }}
              >
                {coachingEnabled ? 'Simulate' : 'Simulation controls'}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                role="status"
                aria-live="polite"
                sx={{
                  color: 'text.secondary',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {busy ? busyLabel : ''}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              aria-label="Simulation shortcut actions"
              sx={{
                flexWrap: { xs: 'wrap', lg: 'nowrap' },
                flexShrink: { lg: 0 },
                '& .MuiButton-root': {
                  minHeight: { lg: 30 },
                  py: { lg: 0.25 },
                  px: { lg: 0.75 },
                  lineHeight: { lg: 1.35 },
                  whiteSpace: { lg: 'nowrap' },
                },
              }}
            >
              <Button
                variant="outlined"
                size="small"
                startIcon={<SkipNextIcon />}
                onClick={() => onAdvance('play')}
                disabled={disabled}
              >
                Sim Play
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SkipNextIcon />}
                onClick={() => onAdvance('drive')}
                disabled={disabled}
              >
                Sim Drive
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <FastForwardIcon />}
                onClick={() => onAdvance('game')}
                disabled={disabled}
              >
                Sim to End
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
};

export default GameSimCoachPanel;
