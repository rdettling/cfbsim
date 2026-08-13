import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { ClockTempo } from '../../types/db';
import type { GameSimUserSide, SimulationDecision } from './gameSimTypes';

type GameSimManagementControlsProps = {
  managementSide: Exclude<GameSimUserSide, null>;
  selectedTempo: ClockTempo | 'auto';
  timeoutAfterPlay: boolean;
  canUseTimeout: boolean;
  canShowSpike: boolean;
  canShowKneel: boolean;
  disabled: boolean;
  onDecision: (decision: SimulationDecision) => void;
  onTempoChange: (tempo: ClockTempo | 'auto') => void;
  onTimeoutChange: (armed: boolean) => void;
};

const TEMPO_OPTIONS: Array<{ value: ClockTempo | 'auto'; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'normal', label: 'Normal' },
  { value: 'hurry_up', label: 'Hurry' },
  { value: 'chew_clock', label: 'Chew' },
];

const GameSimManagementControls = ({
  managementSide,
  selectedTempo,
  timeoutAfterPlay,
  canUseTimeout,
  canShowSpike,
  canShowKneel,
  disabled,
  onDecision,
  onTempoChange,
  onTimeoutChange,
}: GameSimManagementControlsProps) => (
  <Box
    component="section"
    aria-label="Game management"
    sx={{
      p: { xs: 1.25, sm: 1.5, lg: 1 },
      borderBottom: { xs: '1px solid', lg: 0 },
      borderColor: 'divider',
      minWidth: 0,
    }}
  >
    <Stack
      spacing={{ xs: 1.1, lg: 0 }}
      sx={{
        display: { lg: 'grid' },
        gridTemplateColumns: { lg: 'minmax(180px, 1fr) auto auto' },
        alignItems: { lg: 'flex-end' },
        gap: { lg: 0.75 },
        minWidth: 0,
      }}
    >
      {managementSide === 'offense' && (
        <Stack
          spacing={{ xs: 0.5, lg: 0.25 }}
          sx={{ minWidth: { lg: 180 } }}
        >
          <Typography
            variant="subtitle2"
            sx={{ fontSize: { lg: '0.75rem' }, whiteSpace: { lg: 'nowrap' } }}
          >
            Tempo
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            fullWidth
            value={selectedTempo}
            onChange={(_, tempo: ClockTempo | 'auto' | null) => {
              if (tempo) onTempoChange(tempo);
            }}
            aria-label="Offensive tempo"
            disabled={disabled}
            sx={{
              '& .MuiToggleButton-root': {
                minHeight: { lg: 30 },
                py: { lg: 0.25 },
                px: { lg: 0.75 },
                fontSize: { lg: '0.75rem' },
                lineHeight: { lg: 1.35 },
              },
            }}
          >
            {TEMPO_OPTIONS.map(option => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      )}
      {(canShowSpike || canShowKneel) && (
        <Stack spacing={{ xs: 0.6, lg: 0.25 }} role="group" aria-label="Clock action calls">
          <Typography
            variant="caption"
            sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', fontWeight: 700 }}
          >
            Clock action
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            sx={{
              flexWrap: { xs: 'wrap', lg: 'nowrap' },
              '& .MuiButton-root': {
                minHeight: { lg: 30 },
                py: { lg: 0.25 },
                lineHeight: { lg: 1.35 },
              },
            }}
          >
            {canShowSpike && (
              <Button
                variant="outlined"
                size="small"
                disabled={disabled}
                onClick={() => onDecision({ kind: 'clock_management', action: 'spike' })}
              >
                Spike
              </Button>
            )}
            {canShowKneel && (
              <Button
                variant="outlined"
                size="small"
                disabled={disabled}
                onClick={() => onDecision({ kind: 'clock_management', action: 'kneel' })}
              >
                Kneel
              </Button>
            )}
          </Stack>
        </Stack>
      )}
      <Button
        size="small"
        variant={timeoutAfterPlay ? 'contained' : 'outlined'}
        color={timeoutAfterPlay ? 'warning' : 'primary'}
        disabled={disabled || !canUseTimeout}
        onClick={() => onTimeoutChange(!timeoutAfterPlay)}
        sx={{
          minHeight: { lg: 30 },
          py: { lg: 0.25 },
          px: { lg: 0.75 },
          lineHeight: { lg: 1.35 },
          whiteSpace: { lg: 'nowrap' },
        }}
      >
        {!canUseTimeout
          ? 'Timeout unavailable'
          : timeoutAfterPlay
            ? 'Timeout armed'
            : 'Timeout after play'}
      </Button>
    </Stack>
  </Box>
);

export default GameSimManagementControls;
