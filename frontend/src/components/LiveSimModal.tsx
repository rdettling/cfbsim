import {
    Dialog,
    DialogContent,
    Box,
    CircularProgress,
    IconButton,
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import DriveSummary from "./DriveSummary";
import FootballField from "./FootballField";
import GameHeader from "./GameHeader";
import GameControls from "./GameControls";
import { apiService } from "../services/api";
import { Play, Drive, GameData } from "../types/game";
import { useState, useEffect } from "react";

interface LiveSimModalProps {
    open: boolean;
    onClose: () => void;
    gameId: number | null;
}

const LiveSimModal = ({
    open,
    onClose,
    gameId,
}: LiveSimModalProps) => {
    // Regular sim state only
    const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
    const [plays, setPlays] = useState<Play[]>([]);
    const [drives, setDrives] = useState<Drive[]>([]);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [isGameComplete, setIsGameComplete] = useState(false);

    // Calculate if playback is complete for regular sim
    const isPlaybackComplete = currentPlayIndex >= plays.length;

    // Mark game as complete when user has watched through all plays
    useEffect(() => {
        if (isPlaybackComplete && plays.length > 0 && !isGameComplete) {
            setIsGameComplete(true);
        }
    }, [isPlaybackComplete, plays.length, isGameComplete]);

    // Start regular simulation when modal opens
    useEffect(() => {
        if (open && gameId) {
            console.log('🎬 Starting regular simulation for game:', gameId);
            startRegularSimulation();
        }
    }, [open, gameId]);

    const startRegularSimulation = async () => {
        if (!gameId) return;
        
        try {
            const response = await apiService.liveSimGame(gameId) as any;
            handleRegularResponse(response);
        } catch (error) {
            console.error('❌ Error starting simulation:', error);
        }
    };

    const handleRegularResponse = (response: any) => {
        console.log('📡 Live Sim API Response:', response);
        
        // Store drives
        setDrives(response.drives);
        
        // Flatten drives into a single array of plays for navigation
        let allPlays: Play[] = [];
        if (response.drives) {
            response.drives.forEach((drive: Drive) => {
                console.log('🏃 Drive:', drive);
                drive.plays.forEach((play: Play) => {
                    console.log('⚽ Play:', play);
                    allPlays.push(play);
                });
            });
        }
        
        console.log('📋 All Plays Flattened:', allPlays);
        
        setPlays(allPlays);
        setGameData(response.game);
        setCurrentPlayIndex(0);
        setIsGameComplete(false);
        
        // Start the simulation loop
        simLoop();
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
                    setCurrentPlayIndex(plays.length);
                }
                return;
            }
            playCount += drives[i].plays.length;
        }
    };

    const handleSimToEnd = () => {
        setCurrentPlayIndex(plays.length);
    };

    const reset = () => {
        setCurrentPlayIndex(0);
        setPlays([]);
        setDrives([]);
        setGameData(null);
        setIsGameComplete(false);
    };

    // Simple regular sim data
    const currentPlay = currentPlayIndex !== undefined && plays.length > 0
        ? plays[currentPlayIndex]
        : null;
    
    const previousPlay = currentPlayIndex !== undefined && plays.length > 0 && currentPlayIndex > 0
        ? plays[currentPlayIndex - 1]
        : null;
    
    // Get the current drive to determine offense
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
    const isTeamAOnOffense = currentDrive?.offense === gameData?.teamA.name;
    
    // Debug the offense comparison
    useEffect(() => {
        if (currentPlay && gameData && currentDrive) {
            console.log('🔍 Offense Debug:', {
                currentDriveOffense: currentDrive.offense,
                teamAName: gameData.teamA.name,
                teamBName: gameData.teamB.name,
                isTeamAOnOffense,
                comparison: currentDrive.offense === gameData.teamA.name
            });
        }
    }, [currentPlay, gameData, currentDrive, isTeamAOnOffense]);

    // Debug logging for play data
    useEffect(() => {
        if (currentPlay) {
            console.log('🎮 Current Play Debug:', {
                playIndex: currentPlayIndex,
                totalPlays: plays.length,
                currentPlay: currentPlay,
                previousPlay: previousPlay,
                isTeamAOnOffense,
                gameData: gameData
            });
        }
    }, [currentPlay, currentPlayIndex, plays.length, previousPlay, isTeamAOnOffense, gameData]);

    // Set up the simulation data structure
    const simLoop = () => {
        if (plays.length === 0) return;
        
        // Just set up the data - user controls progression with buttons
        setCurrentPlayIndex(0);
        console.log('🎮 Simulation ready with', plays.length, 'plays across', drives.length, 'drives');
    };

    // Get the last play text using simple double nested loops
    const getLastPlayText = () => {
        if (currentPlayIndex === 0) {
            return ''; // No previous play
        }
        
        let playCount = 0;
        for (const drive of drives) {
            for (const play of drive.plays) {
                if (playCount === currentPlayIndex - 1) {
                    return play.text;
                }
                playCount++;
            }
        }
        
        return '';
    };

    // Simple calculations
    const fieldPosition = currentPlay?.startingFP || 20;
    
    // Check if this is the first play of a drive
    const isFirstPlayOfDrive = () => {
        if (!currentDrive || !currentPlay) return false;
        
        let playCount = 0;
        for (const drive of drives) {
            if (drive === currentDrive) {
                // This is the current drive, check if current play is the first play
                return playCount === currentPlayIndex;
            }
            playCount += drive.plays.length;
        }
        return false;
    };
    
    const previousPlayYards = isFirstPlayOfDrive() ? 0 : (previousPlay?.yardsGained || 0);

    // Debug logging for FootballField props
    useEffect(() => {
        if (currentPlay) {
            console.log('🏈 FootballField Props Debug:', {
                currentYardLine: fieldPosition,
                teamA: gameData?.teamA.name,
                teamB: gameData?.teamB.name,
                isTeamAOnOffense,
                down: currentPlay.down,
                yardsToGo: currentPlay.yardsLeft,
                previousPlayYards,
                teamAColorPrimary: gameData?.teamA.colorPrimary,
                teamAColorSecondary: gameData?.teamA.colorSecondary,
                teamBColorPrimary: gameData?.teamB.colorPrimary,
                teamBColorSecondary: gameData?.teamB.colorSecondary,
                currentPlayIndex,
                totalPlays: plays.length,
                currentPlay: currentPlay
            });
        }
    }, [currentPlay, fieldPosition, isTeamAOnOffense, previousPlayYards, gameData, currentPlayIndex, plays.length]);

    const handleClose = () => {
        reset();
        onClose();
    };

    if (!gameData) {
        return (
            <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
                <DialogContent>
                    <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                        minHeight="400px"
                    >
                        <CircularProgress />
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
            <DialogContent sx={{ p: 0, height: "80vh", maxHeight: "80vh", position: 'relative' }}>
                {/* Close Button */}
                <IconButton
                    onClick={handleClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        zIndex: 10,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 1)',
                        }
                    }}
                >
                    <CloseIcon />
                </IconButton>
                
                <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
                        {/* Left side - Main content */}
                        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>

                        {/* Game Header */}
                        <GameHeader
                            gameData={gameData}
                            currentPlay={currentPlay}
                            isTeamAOnOffense={isTeamAOnOffense}
                            plays={plays}
                            isPlaybackComplete={isPlaybackComplete}
                            lastPlayText={getLastPlayText()}
                            currentDrive={currentDrive}
                        />

                        {/* Football Field */}
                        <Box sx={{ mt: 2 }}>
                                    <FootballField 
                                currentYardLine={fieldPosition}
                                        teamA={gameData.teamA.name}
                                        teamB={gameData.teamB.name}
                                        isTeamAOnOffense={isTeamAOnOffense}
                                down={currentPlay?.down || 1}
                                yardsToGo={currentPlay?.yardsLeft || 10}
                                        previousPlayYards={previousPlayYards}
                                        teamAColorPrimary={gameData.teamA.colorPrimary}
                                        teamAColorSecondary={gameData.teamA.colorSecondary}
                                        teamBColorPrimary={gameData.teamB.colorPrimary}
                                        teamBColorSecondary={gameData.teamB.colorSecondary}
                                    />
                        </Box>

                        {/* Game Controls */}
                        <GameControls
                            isInteractive={false}
                            isGameComplete={isGameComplete}
                            isPlaybackComplete={isPlaybackComplete}
                            startInteractiveSimulation={() => {}}
                            handleNextPlay={handleNextPlay}
                            handleNextDrive={handleNextDrive}
                            handleSimToEnd={handleSimToEnd}
                        />
                        </Box>

                    {/* Right side - Drive Summary */}
                    <Box
                        sx={{
                            width: 400,
                            backgroundColor: "grey.50",
                            borderLeft: "1px solid",
                            borderColor: "divider",
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ 
                            flex: 1, 
                            overflowY: 'auto',
                            pr: 1,
                            '&::-webkit-scrollbar': {
                                width: '6px',
                            },
                            '&::-webkit-scrollbar-track': {
                                background: 'rgba(0,0,0,0.1)',
                                borderRadius: '3px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '3px',
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                                background: 'rgba(0,0,0,0.5)',
                            }
                        }}>
                            <DriveSummary 
                                drives={drives as any}
                                currentPlayIndex={currentPlayIndex}
                                variant="modal"
                            />
                        </Box>
                    </Box>
                    </Box>
            </DialogContent>
        </Dialog>
    );
};

export default LiveSimModal;
