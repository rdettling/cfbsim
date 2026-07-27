import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type {
  SimulationAdvanceScope,
  SimulationDecision,
  SimulationDecisionPrompt,
  SimulationPhase,
} from '../sim/useGameSim';

type GameControlsProps = {
  phase: SimulationPhase;
  decisionPrompt: SimulationDecisionPrompt | null;
  onAdvance: (scope: SimulationAdvanceScope) => void;
  onDecision: (decision: SimulationDecision) => void;
};

const formatDown = (down: number) => {
  if (down === 1) return '1st';
  if (down === 2) return '2nd';
  if (down === 3) return '3rd';
  return '4th';
};

const formatFieldPosition = (fieldPosition: number) => {
  const territory = fieldPosition <= 50 ? 'own' : 'opponent';
  const yardLine = fieldPosition <= 50 ? fieldPosition : 100 - fieldPosition;
  return `${territory} ${yardLine}`;
};

const GameControls = ({
  phase,
  decisionPrompt,
  onAdvance,
  onDecision,
}: GameControlsProps) => {
  const busy = phase === 'advancing' || phase === 'finalizing';
  const disabled = phase !== 'ready';
  const busyLabel = phase === 'finalizing' ? 'Saving final result…' : 'Simulating…';

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {decisionPrompt && phase === 'ready' && (
        <Stack
          spacing={1}
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'action.hover',
          }}
        >
          <Box>
            <Typography variant="subtitle2">Call the next play</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDown(decisionPrompt.down)} &amp; {decisionPrompt.yardsLeft}
              {' · '}
              {formatFieldPosition(decisionPrompt.fieldPosition)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              variant="contained"
              size="small"
              startIcon={<DirectionsRunIcon />}
              onClick={() => onDecision('run')}
            >
              Run
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<SportsFootballIcon />}
              onClick={() => onDecision('pass')}
            >
              Pass
            </Button>
            {decisionPrompt.type === 'fourth_down' && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onDecision('punt')}
                >
                  Punt
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onDecision('field_goal')}
                >
                  Field Goal
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ p: { xs: 1.25, sm: 1.5 } }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2">Simulation controls</Typography>
          <Typography variant="caption" color="text.secondary">
            Automatic controls let the simulator make every decision in their scope.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
            variant="contained"
            size="small"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <FastForwardIcon />}
            onClick={() => onAdvance('game')}
            disabled={disabled}
          >
            {busy ? busyLabel : 'Sim to End'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default GameControls;
