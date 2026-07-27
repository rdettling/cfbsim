import { Box, ButtonBase, Chip, Paper, Stack, Typography } from '@mui/material';
import type { RosterPositionCutPreview } from '../../types/roster';

interface PositionLimitsPanelProps {
  positions: RosterPositionCutPreview[];
  selectedPosition: string;
  onSelect: (position: string, hasCuts: boolean) => void;
}

export const PositionLimitsPanel = ({
  positions,
  selectedPosition,
  onSelect,
}: PositionLimitsPanelProps) => (
  <Paper
    component="section"
    aria-labelledby="position-limits-title"
    variant="outlined"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
      overflow: 'hidden',
    }}
  >
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography id="position-limits-title" component="h2" variant="h6">
        Position Limits
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
        }}
      >
        Select a position to filter projected cuts.
      </Typography>
    </Box>

    <Stack sx={{ minHeight: 0, overflowY: 'auto' }}>
      {positions.map((position, index) => {
        const overLimit = position.projectedCuts > 0;
        const selected = selectedPosition === position.position;
        return (
          <ButtonBase
            key={position.position}
            component="button"
            onClick={() => onSelect(position.position, overLimit)}
            aria-pressed={selected}
            sx={{
              display: 'block',
              width: '100%',
              px: { xs: 1.5, md: 2 },
              py: 1.1,
              textAlign: 'left',
              bgcolor: selected ? 'action.selected' : 'transparent',
              borderBottom: index === positions.length - 1 ? 0 : '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack
                direction="row"
                spacing={1.25}
                sx={{
                  alignItems: 'center',
                }}
              >
                <Typography sx={{ width: 30, fontWeight: 700 }}>
                  {position.position.toUpperCase()}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                  }}
                >
                  {position.activePlayers} active · limit {position.rosterLimit} ·{' '}
                  {position.projectedPlayers} after
                </Typography>
              </Stack>
              <Chip
                size="small"
                variant="outlined"
                color={overLimit ? 'warning' : 'default'}
                label={
                  overLimit
                    ? `${position.projectedCuts} ${position.projectedCuts === 1 ? 'cut' : 'cuts'}`
                    : 'Within limit'
                }
              />
            </Stack>
          </ButtonBase>
        );
      })}
    </Stack>
  </Paper>
);
