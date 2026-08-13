import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import type { SimMatchup } from '../../types/components';
import { TeamLogo } from '../team/TeamLogo';

type GameSimHeaderProps = {
  matchup: SimMatchup;
  isComplete: boolean;
  canClose: boolean;
  onClose: () => void;
};

const formatClock = (totalSeconds: number) => {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PossessionIndicator = () => (
  <Box
    component="img"
    src="/logos/football.png"
    alt="Possession"
    sx={{ width: 17, height: 17, objectFit: 'contain', flexShrink: 0 }}
  />
);

const TeamIdentity = ({
  name,
  ranking,
  record,
  possession,
  timeoutsRemaining,
  showTimeouts,
  align,
}: {
  name: string;
  ranking: number;
  record: string;
  possession: boolean;
  timeoutsRemaining: number;
  showTimeouts: boolean;
  align: 'left' | 'right';
}) => (
  <Stack
    direction={align === 'left' ? 'row' : 'row-reverse'}
    spacing={{ xs: 0.6, sm: 1 }}
    sx={{
      alignItems: 'center',
      minWidth: 0,
      width: '100%',
      overflow: 'hidden',
      pr: align === 'right' ? { xs: 5.5, sm: 6 } : 0,
    }}
  >
    <TeamLogo name={name} size={32} />
    <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden', textAlign: align }}>
      <Stack
        direction={align === 'left' ? 'row' : 'row-reverse'}
        spacing={0.5}
        sx={{ alignItems: 'center', minWidth: 0, width: '100%', overflow: 'hidden' }}
      >
        <Typography
          variant="subtitle2"
          title={name}
          sx={{
            minWidth: 0,
            flex: 1,
            maxWidth: { xs: 70, sm: 180, md: 240 },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ranking > 0 ? `#${ranking} ${name}` : name}
        </Typography>
        {possession && <PossessionIndicator />}
      </Stack>
      <Typography component="p" variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.25 }}>
        {record}
      </Typography>
      {showTimeouts && (
        <Typography
          component="p"
          variant="caption"
          aria-label={`${timeoutsRemaining} timeouts remaining`}
          sx={{ color: 'text.secondary', letterSpacing: 0.8, lineHeight: 1.25 }}
        >
          TO {Array.from(
            { length: 3 },
            (_, index) => index < timeoutsRemaining ? '●' : '○',
          ).join('')}
        </Typography>
      )}
    </Box>
  </Stack>
);

const GameSimHeader = ({ matchup, isComplete, canClose, onClose }: GameSimHeaderProps) => {
  const periodLabel = matchup.inOvertime
    ? matchup.overtimeCount > 1
      ? `${matchup.overtimeCount}OT`
      : 'OT'
    : `Q${matchup.quarter}`;
  const status = isComplete
    ? 'Final'
    : matchup.inOvertime
      ? periodLabel
      : `${periodLabel} · ${formatClock(matchup.clockSecondsLeft)}`;

  return (
    <Paper
      component="header"
      variant="outlined"
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: { xs: 0.75, sm: 1.5 },
        px: { xs: 1, sm: 1.5 },
        py: 1,
        flexShrink: 0,
      }}
    >
      <TeamIdentity
        name={matchup.awayTeam.name}
        ranking={matchup.awayTeam.ranking}
        record={matchup.awayTeam.record}
        possession={!isComplete && matchup.isAwayOnOffense}
        timeoutsRemaining={matchup.awayTimeoutsRemaining}
        showTimeouts={!isComplete && !matchup.inOvertime}
        align="left"
      />
      <Box sx={{ textAlign: 'center', minWidth: { xs: 62, sm: 104 } }}>
        <Typography
          component="p"
          sx={{
            fontSize: { xs: '1.3rem', sm: '1.75rem' },
            fontWeight: 700,
            lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {matchup.awayScore}–{matchup.homeScore}
        </Typography>
        <Typography component="p" variant="caption" sx={{ color: 'text.secondary' }}>
          {status}
        </Typography>
      </Box>
      <TeamIdentity
        name={matchup.homeTeam.name}
        ranking={matchup.homeTeam.ranking}
        record={matchup.homeTeam.record}
        possession={!isComplete && !matchup.isAwayOnOffense}
        timeoutsRemaining={matchup.homeTimeoutsRemaining}
        showTimeouts={!isComplete && !matchup.inOvertime}
        align="right"
      />
      <IconButton
        onClick={onClose}
        disabled={!canClose}
        aria-label="Close live simulation"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <CloseIcon />
      </IconButton>
    </Paper>
  );
};

export default GameSimHeader;
