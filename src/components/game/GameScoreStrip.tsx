import { Box, Typography } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';
import type { GameScoreStripProps } from '../../types/components';

const GameScoreStrip = ({
  gameData,
  currentPlay,
  isTeamAOnOffense,
  plays,
  isPlaybackComplete,
  currentDrive,
}: GameScoreStripProps) => {
  const PossessionIndicator = () => (
    <img
      src="/logos/football.png"
      alt="Football"
      style={{ width: 22, height: 22, objectFit: 'contain' }}
    />
  );

  const scoreText = (() => {
    if (currentPlay) {
      return `${currentPlay.scoreA} - ${currentPlay.scoreB}`;
    }
    if (isPlaybackComplete && plays.length > 0) {
      const lastPlay = plays[plays.length - 1];
      return `${lastPlay.scoreA} - ${lastPlay.scoreB}`;
    }
    return `${gameData.scoreA} - ${gameData.scoreB}`;
  })();

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
        <TeamLogo name={gameData.teamA.name} size={44} />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif' }}>
              {gameData.teamA.name}
            </Typography>
            {isTeamAOnOffense && <PossessionIndicator />}
          </Box>
          <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>{gameData.teamA.record}</Typography>
        </Box>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '2rem', fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
          {scoreText}
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', opacity: 0.85 }}>
          {isPlaybackComplete ? 'FINAL' : `Drive ${(currentDrive?.driveNum || 0) + 1}`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end' }}>
        <Box sx={{ textAlign: 'right' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
            {!isTeamAOnOffense && <PossessionIndicator />}
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif' }}>
              {gameData.teamB.name}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>{gameData.teamB.record}</Typography>
        </Box>
        <TeamLogo name={gameData.teamB.name} size={44} />
      </Box>
    </Box>
  );
};

export default GameScoreStrip;
