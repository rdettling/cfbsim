import { Box, Typography } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';
import type { GameScoreStripProps } from '../../types/components';
import { resolveHomeAway, resolveHomeAwayScores } from '../../domain/utils/gameDisplay';

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
      const { awayScore, homeScore } = resolveHomeAwayScores(
        gameData,
        currentPlay.scoreA,
        currentPlay.scoreB
      );
      return `${awayScore} - ${homeScore}`;
    }
    if (isPlaybackComplete && plays.length > 0) {
      const lastPlay = plays[plays.length - 1];
      const { awayScore, homeScore } = resolveHomeAwayScores(
        gameData,
        lastPlay.scoreA,
        lastPlay.scoreB
      );
      return `${awayScore} - ${homeScore}`;
    }
    const { awayScore, homeScore } = resolveHomeAwayScores(
      gameData,
      gameData.scoreA,
      gameData.scoreB
    );
    return `${awayScore} - ${homeScore}`;
  })();

  const { home, away } = resolveHomeAway({
    teamA: gameData.teamA,
    teamB: gameData.teamB,
    homeTeamId: gameData.homeTeamId ?? null,
    awayTeamId: gameData.awayTeamId ?? null,
  });

  const isAwayOnOffense = away.id === gameData.teamA.id ? isTeamAOnOffense : !isTeamAOnOffense;
  const isHomeOnOffense = !isAwayOnOffense;

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
        <TeamLogo name={away.name} size={44} />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif' }}>
              {away.name}
            </Typography>
            {isAwayOnOffense && <PossessionIndicator />}
          </Box>
          <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>{away.record}</Typography>
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
            {isHomeOnOffense && <PossessionIndicator />}
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: '"Space Grotesk", sans-serif' }}>
              {home.name}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>{home.record}</Typography>
        </Box>
        <TeamLogo name={home.name} size={44} />
      </Box>
    </Box>
  );
};

export default GameScoreStrip;
