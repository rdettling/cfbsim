import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { ClockTempo } from '../../types/db';
import type {
  SimulationAdvanceScope,
  SimulationDecision,
  SimulationDecisionPrompt,
  SimulationPhase,
} from '../sim/useGameSim';
import {
  CONCEPT_LABELS,
  PASS_CONCEPTS,
  RUN_CONCEPTS,
} from '../../domain/sim/concepts';
import {
  DEFENSIVE_INTENTS,
  DEFENSIVE_INTENT_LABELS,
} from '../../domain/sim/defensiveIntents';

type GameControlsProps = {
  phase: SimulationPhase;
  decisionPrompt: SimulationDecisionPrompt | null;
  onAdvance: (scope: SimulationAdvanceScope) => void;
  onDecision: (decision: SimulationDecision) => void;
  managementSide: 'offense' | 'defense' | null;
  selectedTempo: ClockTempo | 'auto';
  timeoutAfterPlay: boolean;
  canUseTimeout: boolean;
  canShowSpike: boolean;
  canShowKneel: boolean;
  onTempoChange: (tempo: ClockTempo | 'auto') => void;
  onTimeoutChange: (armed: boolean) => void;
};

const TEMPO_OPTIONS: Array<{ value: ClockTempo | 'auto'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'normal', label: 'Normal' },
  { value: 'hurry_up', label: 'Hurry' },
  { value: 'chew_clock', label: 'Chew' },
];

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
  managementSide,
  selectedTempo,
  timeoutAfterPlay,
  canUseTimeout,
  canShowSpike,
  canShowKneel,
  onTempoChange,
  onTimeoutChange,
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
      {managementSide && decisionPrompt?.type !== 'try' && phase === 'ready' && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            p: { xs: 1.25, sm: 1.5 },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {managementSide === 'offense' ? (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ alignSelf: 'center', fontWeight: 700 }}>
                Tempo
              </Typography>
              {TEMPO_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  size="small"
                  variant={selectedTempo === option.value ? 'contained' : 'outlined'}
                  onClick={() => onTempoChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </Stack>
          ) : <Box />}
          <Button
            size="small"
            variant={timeoutAfterPlay ? 'contained' : 'outlined'}
            color={timeoutAfterPlay ? 'warning' : 'primary'}
            disabled={!canUseTimeout}
            onClick={() => onTimeoutChange(!timeoutAfterPlay)}
          >
            {timeoutAfterPlay ? 'Timeout armed' : 'Timeout after play'}
          </Button>
        </Stack>
      )}
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
            <Typography variant="subtitle2">
              {decisionPrompt.side === 'offense'
                ? decisionPrompt.type === 'try' ? 'Choose the try' : 'Call the next play'
                : decisionPrompt.type === 'try'
                  ? 'Defend the two-point try'
                  : 'Set the defensive intent'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              {decisionPrompt.type === 'try'
                ? 'Untimed down from the 3-yard line'
                : <>
                    {formatDown(decisionPrompt.down)} &amp; {decisionPrompt.yardsLeft}
                    {' · '}
                    {formatFieldPosition(decisionPrompt.fieldPosition)}
                  </>}
            </Typography>
          </Box>
          {decisionPrompt.side === 'offense' ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Typography
                  variant="caption"
                  sx={{ display: 'flex', alignItems: 'center', minWidth: 36, fontWeight: 700 }}
                >
                  <DirectionsRunIcon sx={{ mr: 0.4, fontSize: 16 }} /> Run
                </Typography>
                {RUN_CONCEPTS.map(concept => (
                  <Button
                    key={concept}
                    variant="contained"
                    size="small"
                    onClick={() => onDecision(decisionPrompt.type === 'try'
                      ? { kind: 'try_offense', concept }
                      : { kind: 'offense', concept })}
                  >
                    {CONCEPT_LABELS[concept]}
                  </Button>
                ))}
              </Stack>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Typography
                  variant="caption"
                  sx={{ display: 'flex', alignItems: 'center', minWidth: 36, fontWeight: 700 }}
                >
                  <SportsFootballIcon sx={{ mr: 0.4, fontSize: 16 }} /> Pass
                </Typography>
                {PASS_CONCEPTS.map(concept => (
                  <Button
                    key={concept}
                    variant="contained"
                    size="small"
                    onClick={() => onDecision(decisionPrompt.type === 'try'
                      ? { kind: 'try_offense', concept }
                      : { kind: 'offense', concept })}
                  >
                    {CONCEPT_LABELS[concept]}
                  </Button>
                ))}
              </Stack>
              {decisionPrompt.type === 'fourth_down' && (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onDecision({ kind: 'special_teams', concept: 'punt' })}
                  >
                    Punt
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onDecision({ kind: 'special_teams', concept: 'field_goal' })}
                  >
                    Field Goal
                  </Button>
                </Stack>
              )}
              {decisionPrompt.type === 'try' && decisionPrompt.allowExtraPoint && (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => onDecision({ kind: 'try', attempt: 'extra_point' })}
                  >
                    Kick Extra Point
                  </Button>
                </Stack>
              )}
              {decisionPrompt.type !== 'try' && (canShowSpike || canShowKneel) && (
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'flex', alignItems: 'center', minWidth: 36, fontWeight: 700 }}
                  >
                    Clock
                  </Typography>
                  {canShowSpike && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onDecision({ kind: 'clock_management', action: 'spike' })}
                    >
                      Spike
                    </Button>
                  )}
                  {canShowKneel && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onDecision({ kind: 'clock_management', action: 'kneel' })}
                    >
                      Kneel
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          ) : (
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {DEFENSIVE_INTENTS.map(intent => (
                <Button
                  key={intent}
                  variant="contained"
                  size="small"
                  onClick={() => onDecision(decisionPrompt.type === 'try'
                    ? { kind: 'try_defense', intent }
                    : { kind: 'defense', intent })}
                >
                  {DEFENSIVE_INTENT_LABELS[intent]}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          alignItems: { xs: 'stretch', sm: 'center' },
          p: { xs: 1.25, sm: 1.5 },
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2">Simulation controls</Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            Automatic controls let the simulator make every decision in their scope.
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: 'wrap',
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
