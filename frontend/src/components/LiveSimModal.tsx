import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    IconButton,
    CircularProgress,
    Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastForwardIcon from '@mui/icons-material/FastForward';
import { TeamLogo } from './TeamComponents';
import DriveSummary from './DriveSummary';
import FootballField from './FootballField';
import { apiService } from '../services/api';

interface Play {
    id: number;
    down: number;
    yardsLeft: number;
    startingFP: number;
    playType: string;
    yardsGained: number;
    text: string;
    header: string;
    result: string;
    scoreA: number;
    scoreB: number;
}

interface Drive {
    driveNum: number;
    offense: string;
    defense: string;
    startingFP: number;
    result: string;
    points: number;
    plays: Play[];
}

interface GameData {
    id: number;
    teamA: {
        name: string;
        record: string;
        colorPrimary: string;
        colorSecondary: string;
    };
    teamB: {
        name: string;
        record: string;
        colorPrimary: string;
        colorSecondary: string;
    };
    scoreA: number;
    scoreB: number;
    winner: {
        name: string;
    };
    headline: string;
    overtime: number;
    weekPlayed: number;
    year: number;
}


interface LiveSimModalProps {
    open: boolean;
    onClose: () => void;
    gameId: number | null;
}

const LiveSimModal = ({ open, onClose, gameId }: LiveSimModalProps) => {
    const [loading, setLoading] = useState(false);
    const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
    const [plays, setPlays] = useState<Play[]>([]);
    const [drives, setDrives] = useState<Drive[]>([]);
    const [gameData, setGameData] = useState<GameData | null>(null);

    useEffect(() => {
        if (open && gameId) {
            simulateGame();
        }
    }, [open, gameId]);

    const simulateGame = async () => {
        if (!gameId) return;
        
        setLoading(true);
        try {
            const response = await apiService.liveSimGame(gameId) as any;
            
            // Store drives
            setDrives(response.drives);
            
            // Flatten drives into a single array of plays for navigation
            const allPlays: Play[] = [];
            response.drives.forEach((drive: Drive) => {
                drive.plays.forEach((play: Play) => {
                    allPlays.push(play);
                });
            });
            
            setPlays(allPlays);
            setGameData(response.game);
            setCurrentPlayIndex(0);
        } catch (error) {
            console.error('Error simulating game:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNextPlay = () => {
        if (currentPlayIndex < plays.length) {
            setCurrentPlayIndex(prev => prev + 1);
        }
    };

    const handleNextDrive = () => {
        // Find the current drive
        let playCount = 0;
        for (let i = 0; i < drives.length; i++) {
            const driveEndIndex = playCount + drives[i].plays.length - 1;
            if (currentPlayIndex >= playCount && currentPlayIndex <= driveEndIndex) {
                // Found current drive, move to start of next drive (or end of game if last drive)
                const nextDriveStartIndex = driveEndIndex + 1;
                if (nextDriveStartIndex < plays.length) {
                    setCurrentPlayIndex(nextDriveStartIndex);
                } else {
                    // On last drive, jump to end of game
                    setCurrentPlayIndex(plays.length - 1);
                }
                return;
            }
            playCount += drives[i].plays.length;
        }
    };

    const handleSimToEnd = () => {
        setCurrentPlayIndex(plays.length);
    };

    const handleClose = () => {
        setCurrentPlayIndex(0);
        setPlays([]);
        setDrives([]);
        setGameData(null);
        onClose();
    };


    if (!gameData) {
        return (
            <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        {loading ? <CircularProgress /> : <Typography>Loading...</Typography>}
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    const isGameComplete = currentPlayIndex >= plays.length;
    const currentPlay = isGameComplete ? plays[plays.length - 1] : plays[currentPlayIndex];

    // Helper function to find current drive
    const getCurrentDrive = () => {
        let playCount = 0;
        for (const drive of drives) {
            const driveEndIndex = playCount + drive.plays.length - 1;
            if (currentPlayIndex >= playCount && currentPlayIndex <= driveEndIndex) {
                return drive;
            }
            playCount += drive.plays.length;
        }
        return null;
    };

    const currentDrive = getCurrentDrive();
    const isTeamAOnOffense = currentDrive?.offense === gameData.teamA.name;
    
    // Check if previous play is from the same drive
    const isFirstPlayOfDrive = () => {
        if (currentPlayIndex === 0) return true;
        let playCount = 0;
        for (const drive of drives) {
            if (currentPlayIndex === playCount) return true;
            playCount += drive.plays.length;
        }
        return false;
    };
    
    const previousPlayYards = currentPlayIndex > 0 && !isFirstPlayOfDrive() ? plays[currentPlayIndex - 1].yardsGained : undefined;
    const fieldYardLine = isTeamAOnOffense ? currentPlay.startingFP : (100 - currentPlay.startingFP);

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
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, height: '95vh', width: '95vw' }
            }}
        >
            <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header with close button */}
                <Box sx={{ 
                    p: 2, 
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Typography variant="h5" fontWeight="bold">
                        Live Simulation
                    </Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <CircularProgress size={60} />
                    </Box>
                ) : (
                    <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', gap: 2, p: 3 }}>
                        {/* Left Column - Main Game View */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {/* Combined Header */}
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <>
                                        {/* Scoreboard */}
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
                                                    {isGameComplete ? gameData.scoreA : currentPlay.scoreA} - {isGameComplete ? gameData.scoreB : currentPlay.scoreB}
                                                </Typography>
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

                                        {/* Current Play Info or Final Result */}
                                        {isGameComplete ? (
                                            <Box sx={{ 
                                                pt: 2, 
                                                borderTop: '1px solid', 
                                                borderColor: 'divider',
                                                px: 2,
                                                textAlign: 'center'
                                            }}>
                                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                                    FINAL: {gameData.headline}
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    href={`/game/${gameData.id}`}
                                                    sx={{ mt: 1 }}
                                                >
                                                    View Game Summary
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Box sx={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                gap: 3,
                                                pt: 2, 
                                                borderTop: '1px solid', 
                                                borderColor: 'divider',
                                                px: 2
                                            }}>
                                                {/* Down & Distance */}
                                                <Box sx={{ flex: 1, textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                                                        Current Down & Distance
                                                    </Typography>
                                                    <Typography variant="h6" color="primary.main">
                                                        {currentPlay.header}
                                                    </Typography>
                                                </Box>
                                                
                                                {/* Divider */}
                                                <Box sx={{ width: '1px', height: '40px', bgcolor: 'divider' }} />
                                                
                                                {/* Last Play */}
                                                <Box sx={{ flex: 2, textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
                                                        Last Play
                                                    </Typography>
                                                    {currentPlayIndex > 0 ? (
                                                        <Typography variant="h6" fontWeight="medium">
                                                            {plays[currentPlayIndex - 1].text}
                                                        </Typography>
                                                    ) : (
                                                        <Typography variant="h6" fontWeight="medium" color="text.secondary">
                                                            Game starting...
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        )}
                                </>
                            </Paper>

                            {/* Football Field Visualization */}
                            <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                                {currentDrive && (
                                    <FootballField 
                                        currentYardLine={fieldYardLine}
                                        teamA={gameData.teamA.name}
                                        teamB={gameData.teamB.name}
                                        isTeamAOnOffense={isTeamAOnOffense}
                                        down={currentPlay.down}
                                        yardsToGo={currentPlay.yardsLeft}
                                        previousPlayYards={previousPlayYards}
                                        teamAColorPrimary={gameData.teamA.colorPrimary}
                                        teamAColorSecondary={gameData.teamA.colorSecondary}
                                        teamBColorPrimary={gameData.teamB.colorPrimary}
                                        teamBColorSecondary={gameData.teamB.colorSecondary}
                                    />
                                )}
                            </Paper>

                        </Box>

                        {/* Right Column - Drive Summary */}
                        <Box sx={{ width: 280, minWidth: 280 }}>
                            <DriveSummary 
                                drives={drives}
                                currentPlayIndex={currentPlayIndex}
                                totalPlays={plays.length}
                                isGameComplete={isGameComplete}
                                variant="modal"
                            />
                        </Box>
                    </Box>
                )}

                {/* Controls Footer */}
                {!loading && (
                    <Box sx={{ 
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        p: 2,
                        backgroundColor: 'background.paper'
                    }}>
                        {/* Control buttons */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Button
                                onClick={handleNextPlay}
                                disabled={isGameComplete}
                                endIcon={<SkipNextIcon />}
                                variant="contained"
                                size="large"
                            >
                                Next Play
                            </Button>

                            <Button
                                onClick={handleNextDrive}
                                disabled={isGameComplete}
                                endIcon={<FastForwardIcon />}
                                variant="outlined"
                                size="large"
                            >
                                Next Drive
                            </Button>

                            <Button
                                onClick={handleSimToEnd}
                                disabled={isGameComplete}
                                variant="outlined"
                                size="large"
                            >
                                Sim to End
                            </Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default LiveSimModal;

