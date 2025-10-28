import { Box, Typography } from '@mui/material';
import { TeamLogo } from './TeamComponents';
import { GameData, Play } from '../types/game';

interface GameHeaderProps {
    gameData: GameData;
    currentPlay: Play | null;
    isTeamAOnOffense: boolean;
    plays: Play[];
    isPlaybackComplete: boolean;
    lastPlayText?: string;
}

const GameHeader = ({ 
    gameData, 
    currentPlay, 
    isTeamAOnOffense, 
    plays, 
    isPlaybackComplete,
    lastPlayText
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
        <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', mb: 3 }}>
            {/* Team A */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <Box sx={{ textAlign: 'center' }}>
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

            {/* Team B */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
    );
};

export default GameHeader;
