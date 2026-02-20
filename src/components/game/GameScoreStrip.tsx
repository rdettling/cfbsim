import { Box, Typography } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';
import type { GameScoreStripProps } from '../../types/components';

const GameScoreStrip = ({
  matchup,
  isPlaybackComplete,
}: GameScoreStripProps) => {
  const PossessionIndicator = () => (
    <img
      src="/logos/football.png"
      alt="Football"
      style={{ width: 22, height: 22, objectFit: 'contain' }}
    />
  );

  const scoreText = `${matchup.awayScore} - ${matchup.homeScore}`;
  const isAwayOnOffense = matchup.isAwayOnOffense;
  const isHomeOnOffense = !matchup.isAwayOnOffense;
  const formatClock = (totalSeconds: number) => {
    const minutes = Math.max(0, Math.floor(totalSeconds / 60));
    const seconds = Math.max(0, totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  const periodLabel = matchup.inOvertime
    ? (matchup.overtimeCount > 1 ? `${matchup.overtimeCount}OT` : 'OT')
    : `Q${matchup.quarter}`;
  const clockLabel = matchup.inOvertime ? '' : formatClock(matchup.clockSecondsLeft);

  return (
    <Box
      sx={{
        background: 'linear-gradient(90deg, rgba(17,24,39,0.96) 0%, rgba(30,64,175,0.9) 50%, rgba(17,24,39,0.96) 100%)',
        borderRadius: 3,
        px: 3,
        py: 2,
        color: 'white',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 16px 32px rgba(15, 23, 42, 0.2)',
        fontFamily: '"IBM Plex Sans", sans-serif',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TeamLogo name={matchup.awayTeam.name} size={44} />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif' }}>
              {matchup.awayTeam.name}
            </Typography>
            {isAwayOnOffense && <PossessionIndicator />}
          </Box>
          <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>{matchup.awayTeam.record}</Typography>
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '2rem', fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
          {scoreText}
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', opacity: 0.85 }}>
          {isPlaybackComplete
            ? 'FINAL'
            : `${periodLabel}${clockLabel ? ` ${clockLabel}` : ''}`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end' }}>
        <Box sx={{ textAlign: 'right' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
            {isHomeOnOffense && <PossessionIndicator />}
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif' }}>
              {matchup.homeTeam.name}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>{matchup.homeTeam.record}</Typography>
        </Box>
        <TeamLogo name={matchup.homeTeam.name} size={44} />
      </Box>
    </Box>
  );
};

export default GameScoreStrip;
