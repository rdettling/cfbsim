import { Box, Typography } from '@mui/material';

interface FootballFieldProps {
    currentYardLine: number;
    teamA: string;
    teamB: string;
    isTeamAOnOffense: boolean;
    down: number;
    yardsToGo: number;
    previousPlayYards?: number;  // Yards gained (positive) or lost (negative) on previous play
    teamAColorPrimary?: string;
    teamAColorSecondary?: string;
    teamBColorPrimary?: string;
    teamBColorSecondary?: string;
}

const FootballField = ({ currentYardLine, teamA, teamB, isTeamAOnOffense, down, yardsToGo, previousPlayYards, teamAColorPrimary, teamAColorSecondary, teamBColorPrimary, teamBColorSecondary }: FootballFieldProps) => {
    // Field dimensions based on yards
    const PIXELS_PER_YARD = 7;
    const END_ZONE_YARDS = 10;
    const FIELD_YARDS = 100;
    const FIELD_WIDTH_YARDS = 53;
    const YARD_LINE_NUMBER_SIZE = '1.5rem';
    const END_ZONE_TEXT_SIZE = '1.8rem';
    
    // Calculate dimensions in pixels
    const endZoneWidth = END_ZONE_YARDS * PIXELS_PER_YARD;
    const fieldWidth = FIELD_YARDS * PIXELS_PER_YARD;
    const totalWidth = endZoneWidth + fieldWidth + endZoneWidth;
    const fieldHeight = FIELD_WIDTH_YARDS * PIXELS_PER_YARD;
    
    // Helper function to convert yard line to pixel position
    const yardToPixels = (yard: number): number => endZoneWidth + (yard * PIXELS_PER_YARD);
    
    // Calculate positions
    const ballPosition = yardToPixels(currentYardLine);
    const firstDownYardLine = isTeamAOnOffense ? 
        Math.min(100, currentYardLine + yardsToGo) : 
        Math.max(0, currentYardLine - yardsToGo);
    const firstDownPosition = yardToPixels(firstDownYardLine);
    
    // Calculate previous play zone
    const previousPlayZone = previousPlayYards && previousPlayYards !== 0 ? {
        left: Math.min(
            yardToPixels(Math.max(0, Math.min(100, currentYardLine - previousPlayYards * (isTeamAOnOffense ? 1 : -1)))),
            ballPosition
        ),
        width: Math.abs(previousPlayYards * PIXELS_PER_YARD),
        isGain: previousPlayYards > 0,
        yards: previousPlayYards
    } : null;
    
    // Yard line markers (every 10 yards, excluding goal lines)
    const yardLines = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    
    // Helper to format down text
    const getDownText = (d: number) => ['1st', '2nd', '3rd', '4th'][d - 1] || '4th';
    
    // Vertical line component
    const VerticalLine = ({ left, width, color, zIndex, shadow }: { left: number; width: number; color: string; zIndex: number; shadow?: string }) => (
        <Box sx={{ position: 'absolute', left, top: 0, bottom: 0, width, bgcolor: color, zIndex, ...(shadow && { boxShadow: shadow }) }} />
    );

    return (
        <Box sx={{ 
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            py: 2
        }}>
            <Box sx={{ 
                width: totalWidth,
                height: fieldHeight,
                position: 'relative',
                bgcolor: '#2e7d32', // Darker green for grass
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex'
            }}>
                {/* Team A End Zone */}
                <Box
                    sx={{
                        width: endZoneWidth,
                        bgcolor: teamAColorPrimary || 'primary.main',
                        opacity: 0.9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}
                >
                    <Typography
                        sx={{
                            color: teamAColorSecondary || 'white',
                            fontWeight: 'bold',
                            fontSize: END_ZONE_TEXT_SIZE,
                            transform: 'rotate(-90deg)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {teamA}
                    </Typography>
                </Box>

                {/* Main Field (100 yards) */}
                <Box
                    sx={{
                        width: fieldWidth,
                        position: 'relative',
                        height: '100%'
                    }}
                >
                    {/* Yard line markers */}
                    {yardLines.map((yard) => (
                        <Box key={yard} sx={{ position: 'absolute', left: yard * PIXELS_PER_YARD, top: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box sx={{ width: 3, height: '100%', bgcolor: 'white', opacity: 0.9 }} />
                            <Typography sx={{ position: 'absolute', top: 8, color: 'white', fontWeight: 'bold', fontSize: YARD_LINE_NUMBER_SIZE, textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
                                {yard <= 50 ? yard : 100 - yard}
                            </Typography>
                        </Box>
                    ))}
                </Box>

                {/* Team B End Zone */}
                <Box
                    sx={{
                        width: endZoneWidth,
                        bgcolor: teamBColorPrimary || 'secondary.main',
                        opacity: 0.9,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Typography
                        sx={{
                            color: teamBColorSecondary || 'white',
                            fontWeight: 'bold',
                            fontSize: END_ZONE_TEXT_SIZE,
                            transform: 'rotate(90deg)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {teamB}
                    </Typography>
                </Box>

                {/* Down and Distance Display */}
                <Box sx={{
                    position: 'absolute',
                    left: ballPosition,
                    top: '25%',
                    transform: isTeamAOnOffense ? 'translateX(-100%)' : 'translateX(0%)',
                    bgcolor: 'rgba(33, 150, 243, 0.8)',
                    zIndex: 6,
                    px: 2,
                    py: 0.5,
                    borderRadius: 1
                }}>
                    <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', textShadow: '1px 1px 3px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>
                        {getDownText(down)} & {yardsToGo}
                    </Typography>
                </Box>

                {/* Previous Play Yards Gained/Lost Zone */}
                {previousPlayZone && (
                    <Box sx={{
                        position: 'absolute',
                        left: previousPlayZone.left,
                        top: '75%',
                        height: '15%',
                        width: previousPlayZone.width,
                        bgcolor: previousPlayZone.isGain ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)',
                        zIndex: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}>
                            {previousPlayZone.isGain ? '+' : ''}{previousPlayZone.yards} YDS
                        </Typography>
                    </Box>
                )}

                {/* Goal Lines */}
                <VerticalLine left={endZoneWidth} width={3} color="rgba(255, 255, 255, 0.9)" zIndex={4} />
                <VerticalLine left={endZoneWidth + fieldWidth} width={3} color="rgba(255, 255, 255, 0.9)" zIndex={4} />

                {/* Line of Scrimmage (Blue) */}
                <VerticalLine left={ballPosition} width={4} color="#2196F3" zIndex={5} shadow="0 0 8px rgba(33, 150, 243, 0.8)" />

                {/* First Down Line (Yellow) */}
                <VerticalLine left={firstDownPosition} width={4} color="#FFD700" zIndex={5} shadow="0 0 8px rgba(255, 215, 0, 0.8)" />

                {/* Ball position indicator */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: ballPosition,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 28,
                        height: 28,
                        zIndex: 10
                    }}
                >
                    <img 
                        src="/logos/football.png" 
                        alt="Football" 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(2px 2px 6px rgba(0,0,0,0.7))'
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default FootballField;
