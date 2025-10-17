import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    IconButton,
    CircularProgress,
    LinearProgress,
    Paper,
    Slider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastForwardIcon from '@mui/icons-material/FastForward';
import { TeamLogo } from './TeamComponents';
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

interface GameInfo {
    id: number;
    teamA: any;
    teamB: any;
}

interface FinalResult {
    scoreA: number;
    scoreB: number;
    winner: string;
    headline: string;
    overtime: number;
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
    const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
    const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
    const [autoPlay, setAutoPlay] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1000); // ms between plays

    useEffect(() => {
        if (open && gameId) {
            simulateGame();
        }
    }, [open, gameId]);

    useEffect(() => {
        if (autoPlay && currentPlayIndex < plays.length - 1) {
            const timer = setTimeout(() => {
                setCurrentPlayIndex(prev => prev + 1);
            }, playSpeed);
            return () => clearTimeout(timer);
        } else if (currentPlayIndex >= plays.length - 1) {
            setAutoPlay(false);
        }
    }, [autoPlay, currentPlayIndex, plays.length, playSpeed]);

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
            setGameInfo(response.game_info);
            setFinalResult(response.final_result);
            setCurrentPlayIndex(0);
        } catch (error) {
            console.error('Error simulating game:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNextPlay = () => {
        if (currentPlayIndex < plays.length - 1) {
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
                setAutoPlay(false);
                return;
            }
            playCount += drives[i].plays.length;
        }
    };

    const handleSimToEnd = () => {
        setCurrentPlayIndex(plays.length - 1);
        setAutoPlay(false);
    };

    const toggleAutoPlay = () => {
        setAutoPlay(!autoPlay);
    };

    const handleClose = () => {
        setAutoPlay(false);
        setCurrentPlayIndex(0);
        setPlays([]);
        setDrives([]);
        setGameInfo(null);
        setFinalResult(null);
        onClose();
    };

    // Helper function to get completed drives up to current play
    const getCompletedDrives = () => {
        const completed: Drive[] = [];
        let playCount = 0;
        
        for (const drive of drives) {
            const driveEndIndex = playCount + drive.plays.length - 1;
            // Include drive if it's completely finished OR if game is complete and we're at/past this drive
            if (driveEndIndex < currentPlayIndex || (isGameComplete && currentPlayIndex >= playCount)) {
                completed.push(drive);
            } else {
                break;
            }
            playCount += drive.plays.length;
        }
        
        return completed;
    };

    if (!gameInfo || !finalResult) {
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

    const currentPlay = plays[currentPlayIndex];
    const progress = ((currentPlayIndex + 1) / plays.length) * 100;
    const isGameComplete = currentPlayIndex === plays.length - 1;

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2, height: '90vh' }
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
                            {/* Scoreboard */}
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                                {/* Team A */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <TeamLogo name={gameInfo.teamA.name} size={60} />
                                    <Box>
                                        <Typography variant="h5" fontWeight="bold">
                                            {gameInfo.teamA.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {gameInfo.teamA.record}
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Score */}
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h2" fontWeight="bold">
                                        {isGameComplete ? finalResult.scoreA : currentPlay.scoreA} - {isGameComplete ? finalResult.scoreB : currentPlay.scoreB}
                                    </Typography>
                                    {isGameComplete && finalResult.overtime > 0 && (
                                        <Typography variant="caption" color="error.main">
                                            {finalResult.overtime}OT
                                        </Typography>
                                    )}
                                </Box>

                                {/* Team B */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="h5" fontWeight="bold">
                                            {gameInfo.teamB.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {gameInfo.teamB.record}
                                        </Typography>
                                    </Box>
                                    <TeamLogo name={gameInfo.teamB.name} size={60} />
                                </Box>
                            </Box>
                        </Paper>

                        {/* Play Display */}
                        <Paper elevation={2} sx={{ p: 3, mb: 3, minHeight: 150 }}>
                            {isGameComplete ? (
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h3" fontWeight="bold" color="success.main" gutterBottom>
                                        GAME COMPLETE
                                    </Typography>
                                    <Typography variant="h6" gutterBottom>
                                        {finalResult.headline}
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontSize: '1.25rem' }}>
                                        {finalResult.winner} wins
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                                        {currentPlay.header}
                                    </Typography>
                                    <Typography variant="h5" fontWeight="medium" sx={{ mt: 2 }}>
                                        {currentPlay.text}
                                    </Typography>
                                    <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Play {currentPlayIndex + 1} of {plays.length}
                                        </Typography>
                                    </Box>
                                </>
                            )}
                        </Paper>

                        </Box>

                        {/* Right Column - Drive Summary */}
                        <Box sx={{ width: 280, minWidth: 280 }}>
                            <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    Drive Summary
                                </Typography>
                                <Box sx={{ flex: 1, overflow: 'auto' }}>
                                    {getCompletedDrives().length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                                            No completed drives yet
                                        </Typography>
                                    ) : (
                                        getCompletedDrives().map((drive, idx) => (
                                            <Box 
                                                key={idx}
                                                sx={{ 
                                                    mb: 1.5, 
                                                    p: 1.5, 
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 1,
                                                    '&:hover': { bgcolor: 'action.hover' }
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                    <Typography variant="caption" fontWeight="bold">
                                                        Drive #{drive.driveNum + 1}
                                                    </Typography>
                                                    <Typography 
                                                        variant="caption" 
                                                        sx={{ 
                                                            fontWeight: 'bold',
                                                            color: drive.points > 0 ? 'success.main' : 'text.secondary'
                                                        }}
                                                    >
                                                        {drive.points > 0 ? `+${drive.points}` : '0'} pts
                                                    </Typography>
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {drive.offense}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {drive.result}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {drive.plays.length} plays
                                                </Typography>
                                            </Box>
                                        ))
                                    )}
                                </Box>
                            </Paper>
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
                        {/* Progress bar */}
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Play {currentPlayIndex + 1} of {plays.length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {Math.round(progress)}%
                                </Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={progress} />
                        </Box>

                        {/* Control buttons */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Button
                                onClick={toggleAutoPlay}
                                variant="contained"
                                color={autoPlay ? "error" : "success"}
                                startIcon={autoPlay ? <PauseIcon /> : <PlayArrowIcon />}
                                disabled={isGameComplete}
                                size="large"
                            >
                                {autoPlay ? 'Pause' : 'Auto Play'}
                            </Button>

                            <Button
                                onClick={handleNextPlay}
                                disabled={currentPlayIndex >= plays.length - 1}
                                endIcon={<SkipNextIcon />}
                                variant="outlined"
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

                        {/* Speed slider */}
                        {!isGameComplete && (
                            <Box sx={{ mt: 2, px: 4 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                    Auto-play Speed
                                </Typography>
                                <Slider
                                    value={playSpeed}
                                    onChange={(_, value) => setPlaySpeed(value as number)}
                                    min={100}
                                    max={2000}
                                    step={100}
                                    marks={[
                                        { value: 100, label: 'Fast' },
                                        { value: 1000, label: 'Normal' },
                                        { value: 2000, label: 'Slow' }
                                    ]}
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(value) => `${value}ms`}
                                />
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default LiveSimModal;

