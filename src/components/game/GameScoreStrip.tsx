import { Box, Stack, Typography } from '@mui/material';
import type { SimMatchup } from '../../types/components';
import { TeamLogo } from '../team/TeamLogo';

type GameScoreStripProps = {
  matchup: SimMatchup;
  isPlaybackComplete: boolean;
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
    sx={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
  />
);

const TeamIdentity = ({
  name,
  record,
  possession,
  timeoutsRemaining,
  showTimeouts,
  align,
}: {
  name: string;
  record: string;
  possession: boolean;
  timeoutsRemaining: number;
  showTimeouts: boolean;
  align: 'left' | 'right';
}) => (
  <Stack
    direction={align === 'left' ? 'row' : 'row-reverse'}
    spacing={{ xs: 0.75, sm: 1.25 }}
    sx={{
      alignItems: 'center',
      minWidth: 0,
      justifySelf: align === 'left' ? 'start' : 'end',
    }}
  >
    <TeamLogo name={name} size={40} />
    <Box sx={{ minWidth: 0, textAlign: align }}>
      <Stack
        direction={align === 'left' ? 'row' : 'row-reverse'}
        spacing={0.5}
        sx={{
          alignItems: 'center',
        }}
      >
        <Typography
          variant="subtitle2"
          title={name}
          sx={{
            maxWidth: { xs: 86, sm: 180, md: 240 },
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Typography>
        {possession && <PossessionIndicator />}
      </Stack>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {record}
      </Typography>
      {showTimeouts && (
        <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          TO {Array.from({ length: 3 }, (_, index) => index < timeoutsRemaining ? '●' : '○').join('')}
        </Typography>
      )}
    </Box>
  </Stack>
);

const GameScoreStrip = ({ matchup, isPlaybackComplete }: GameScoreStripProps) => {
  const periodLabel = matchup.inOvertime
    ? matchup.overtimeCount > 1
      ? `${matchup.overtimeCount}OT`
      : 'OT'
    : `Q${matchup.quarter}`;
  const status = isPlaybackComplete
    ? 'Final'
    : matchup.inOvertime
      ? periodLabel
      : `${periodLabel} · ${formatClock(matchup.clockSecondsLeft)}`;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: { xs: 1, sm: 2 },
        px: { xs: 1.25, sm: 2 },
        py: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: 'background.paper',
      }}
    >
      <TeamIdentity
        name={matchup.awayTeam.name}
        record={matchup.awayTeam.record}
        possession={!isPlaybackComplete && matchup.isAwayOnOffense}
        timeoutsRemaining={matchup.awayTimeoutsRemaining}
        showTimeouts={!isPlaybackComplete && !matchup.inOvertime}
        align="left"
      />
      <Box sx={{ textAlign: 'center', minWidth: { xs: 76, sm: 112 } }}>
        <Typography
          component="p"
          sx={{
            fontSize: { xs: '1.35rem', sm: '1.75rem' },
            fontWeight: 700,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {matchup.awayScore}–{matchup.homeScore}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
          }}
        >
          {status}
        </Typography>
      </Box>
      <TeamIdentity
        name={matchup.homeTeam.name}
        record={matchup.homeTeam.record}
        possession={!isPlaybackComplete && !matchup.isAwayOnOffense}
        timeoutsRemaining={matchup.homeTimeoutsRemaining}
        showTimeouts={!isPlaybackComplete && !matchup.inOvertime}
        align="right"
      />
    </Box>
  );
};

export default GameScoreStrip;
