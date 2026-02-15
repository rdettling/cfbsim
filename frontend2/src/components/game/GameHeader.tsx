import { Box, Typography, Link } from '@mui/material';
import { TeamLogo } from '../team/TeamComponents';
import type { GameHeaderProps } from '../../types/components';

const GameHeader = ({ 
    gameData, 
    currentPlay, 
    isTeamAOnOffense, 
    plays, 
    isPlaybackComplete,
    lastPlayText,
    currentDrive
}: GameHeaderProps) => {
    // Possession indicator component
    const PossessionIndicator = () => (
        <img 
            src="/logos/football.png" 
            alt="Football" 
            style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain'
            }}
        />
    );

    return (
        <Box sx={{ mb: 3 }}>
            {/* Game Base Label */}
            <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', mb: 2, fontWeight: 'bold' }}>
                {gameData.base_label}
            </Typography>

            {/* Teams and Score Row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                {/* Team A */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                    <TeamLogo name={gameData.teamA.name} size={60} />
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h5" fontWeight="bold">
                                {gameData.teamA.name}
                            </Typography>
                            {isTeamAOnOffense && <PossessionIndicator />}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {gameData.teamA.record}
                        </Typography>
                    </Box>
                </Box>

                {/* Score */}
                <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h2" fontWeight="bold">
                        {(() => {
                            if (currentPlay) {
                                // Show current play score
                                return `${currentPlay.scoreA} - ${currentPlay.scoreB}`;
                            } else if (isPlaybackComplete && plays.length > 0) {
                                // Show final score from last play
                                const lastPlay = plays[plays.length - 1];
                                return `${lastPlay.scoreA} - ${lastPlay.scoreB}`;
                            } else {
                                // Show original game data score
                                return `${gameData.scoreA} - ${gameData.scoreB}`;
                            }
                        })()}
                    </Typography>
                </Box>

                {/* Team B */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
                    <Box sx={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                            {!isTeamAOnOffense && <PossessionIndicator />}
                            <Typography variant="h5" fontWeight="bold">
                                {gameData.teamB.name}
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {gameData.teamB.record}
                        </Typography>
                    </Box>
                    <TeamLogo name={gameData.teamB.name} size={60} />
                </Box>
            </Box>

            {/* Drive and Play Info */}
            <Box sx={{ textAlign: 'center' }}>
                {/* Drive Number or Final */}
                <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                    {isPlaybackComplete ? 'FINAL' : `Drive ${(currentDrive?.driveNum || 0) + 1}`}
                </Typography>
                
                {/* Game Headline Link (only when game is over) */}
                {isPlaybackComplete && gameData.headline && (
                    <Link 
                        href={`/game/${gameData.id}`} 
                        sx={{ 
                            textDecoration: 'none',
                            color: 'primary.main',
                            '&:hover': {
                                textDecoration: 'underline'
                            }
                        }}
                    >
                        <Typography variant="body1" sx={{ mt: 1, fontWeight: 'medium' }}>
                            {gameData.headline}
                        </Typography>
                    </Link>
                )}
                
                {/* Horizontal separator line */}
                {!isPlaybackComplete && (currentPlay?.header || lastPlayText) && (
                    <Box sx={{ 
                        width: '60%', 
                        height: '1px', 
                        bgcolor: 'divider', 
                        mx: 'auto', 
                        mt: 1, 
                        mb: 1 
                    }} />
                )}
                
                {/* Down and Distance */}
                {currentPlay?.header && !isPlaybackComplete && (
                    <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
                        {currentPlay.header}
                    </Typography>
                )}
                
                {/* Last Play Text */}
                {lastPlayText && !isPlaybackComplete && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        LAST PLAY: {lastPlayText}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default GameHeader;
