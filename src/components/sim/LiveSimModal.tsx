import {
    Dialog,
    DialogContent,
    Box,
    CircularProgress,
    IconButton,
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import DriveSummary from "../game/DriveSummary";
import FootballField from "../game/FootballField";
import GameHeader from "../game/GameHeader";
import GameControls from "../game/GameControls";
import { Play, Drive, GameData } from "../../types/game";
import { useState, useEffect } from "react";
import { liveSimGame } from "../../domain/sim";
import { useInteractiveSim } from './useInteractiveSim';
import type { LiveSimModalProps } from '../../types/components';

const LiveSimModal = ({
    open,
    onClose,
    gameId,
    isUserGame,
}: LiveSimModalProps) => {
    // Regular sim state only
    const [currentPlayIndex, setCurrentPlayIndex] = useState(0);
    const [plays, setPlays] = useState<Play[]>([]);
    const [drives, setDrives] = useState<Drive[]>([]);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [isGameComplete, setIsGameComplete] = useState(false);

    const interactive = useInteractiveSim({ gameId, enabled: isUserGame });
    const interactiveState = interactive.state;
    const interactiveActions = interactive.actions;

    const isPlaybackComplete = isUserGame ? interactiveState.isPlaybackComplete : currentPlayIndex >= plays.length;

    useEffect(() => {
        if (isUserGame) return;
        if (isPlaybackComplete && plays.length > 0 && !isGameComplete) {
            setIsGameComplete(true);
        }
    }, [isUserGame, isPlaybackComplete, plays.length, isGameComplete]);

    useEffect(() => {
        if (open && gameId) {
            if (isUserGame) {
                interactiveActions.start();
            } else {
                startRegularSimulation();
            }
        }
    }, [open, gameId, isUserGame]);

    const startRegularSimulation = async () => {
        if (!gameId) return;

        try {
            const response = await liveSimGame(gameId);
            handleRegularResponse(response);
        } catch (error) {
            console.error('❌ Error starting simulation:', error);
        }
    };

    const handleRegularResponse = (response: any) => {
        setDrives(response.drives);

        let allPlays: Play[] = [];
        if (response.drives) {
            response.drives.forEach((drive: Drive) => {
                drive.plays.forEach((play: Play) => {
                    allPlays.push(play);
                });
            });
        }

        setPlays(allPlays);
        setGameData(response.game);
        setCurrentPlayIndex(0);
        setIsGameComplete(false);
        simLoop();
    };

    const handleNextPlay = async () => {
        if (isUserGame) {
            await interactiveActions.simulateAutoPlays(1);
            return;
        }
        if (currentPlayIndex < plays.length) {
            setCurrentPlayIndex(prev => prev + 1);
        }
    };

    const handleNextDrive = async () => {
        if (isUserGame) {
            await interactiveActions.simulateAutoDrive();
            return;
        }
        let playCount = 0;
        for (let i = 0; i < drives.length; i++) {
            const driveEndIndex = playCount + drives[i].plays.length - 1;
            if (currentPlayIndex >= playCount && currentPlayIndex <= driveEndIndex) {
                const nextDriveStartIndex = driveEndIndex + 1;
                if (nextDriveStartIndex < plays.length) {
                    setCurrentPlayIndex(nextDriveStartIndex);
                } else {
                    setCurrentPlayIndex(plays.length);
                }
                return;
            }
            playCount += drives[i].plays.length;
        }
    };

    const handleSimToEnd = async () => {
        if (isUserGame) {
            await interactiveActions.simulateToEnd();
            return;
        }
        setCurrentPlayIndex(plays.length);
    };

    const reset = () => {
        setCurrentPlayIndex(0);
        setPlays([]);
        setDrives([]);
        setGameData(null);
        setIsGameComplete(false);
        interactiveActions.reset();
    };

    const currentPlay = currentPlayIndex !== undefined && plays.length > 0
        ? plays[currentPlayIndex]
        : null;

    const previousPlay = currentPlayIndex !== undefined && plays.length > 0 && currentPlayIndex > 0
        ? plays[currentPlayIndex - 1]
        : null;

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

    const simLoop = () => {
        if (plays.length === 0) return;
        setCurrentPlayIndex(0);
    };

    const getLastPlayText = () => {
        if (currentPlayIndex === 0) {
            return '';
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

    const fieldPosition = currentPlay?.startingFP || 20;

    const isFirstPlayOfDrive = () => {
        if (!currentDrive || !currentPlay) return false;

        let playCount = 0;
        for (const drive of drives) {
            if (drive === currentDrive) {
                return playCount === currentPlayIndex;
            }
            playCount += drive.plays.length;
        }
        return false;
    };

    const previousPlayYards = isFirstPlayOfDrive() ? 0 : (previousPlay?.yardsGained || 0);

    const handleClose = () => {
        reset();
        onClose();
    };

    const displayData = isUserGame ? interactiveState.gameData : gameData;

    if (!displayData) {
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

    const effectivePlays = isUserGame ? interactiveState.plays : plays;
    const effectiveDrives = isUserGame ? interactiveState.drives : drives;
    const effectiveCurrentPlayIndex = isUserGame ? interactiveState.currentPlayIndex : currentPlayIndex;

    const headerPlay = isUserGame ? interactiveState.displayPlay : currentPlay;
    const headerDrive = isUserGame ? interactiveState.displayDrive : currentDrive;
    const headerLastPlayText = isUserGame ? interactiveState.lastPlayText : getLastPlayText();
    const headerIsTeamAOnOffense = isUserGame ? interactiveState.isTeamAOnOffense : isTeamAOnOffense;

    const fieldYardLine = isUserGame ? interactiveState.fieldPosition : fieldPosition;
    const fieldDown = isUserGame ? (interactiveState.displayPlay?.down ?? 1) : (currentPlay?.down || 1);
    const fieldYardsToGo = isUserGame ? (interactiveState.displayPlay?.yardsLeft ?? 10) : (currentPlay?.yardsLeft || 10);
    const fieldPreviousPlayYards = isUserGame ? interactiveState.previousPlayYards : previousPlayYards;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
            <DialogContent sx={{ p: 0, height: "80vh", maxHeight: "80vh", position: 'relative' }}>
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
                        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>

                        <GameHeader
                            gameData={displayData}
                            currentPlay={headerPlay}
                            isTeamAOnOffense={headerIsTeamAOnOffense}
                            plays={effectivePlays}
                            isPlaybackComplete={isPlaybackComplete}
                            lastPlayText={headerLastPlayText}
                            currentDrive={headerDrive}
                        />

                        <Box sx={{ mt: 2 }}>
                                    <FootballField 
                                currentYardLine={fieldYardLine}
                                        teamA={displayData.teamA.name}
                                        teamB={displayData.teamB.name}
                                        isTeamAOnOffense={headerIsTeamAOnOffense}
                                down={fieldDown}
                                yardsToGo={fieldYardsToGo}
                                        previousPlayYards={fieldPreviousPlayYards}
                                        teamAColorPrimary={displayData.teamA.colorPrimary}
                                        teamAColorSecondary={displayData.teamA.colorSecondary}
                                        teamBColorPrimary={displayData.teamB.colorPrimary}
                                        teamBColorSecondary={displayData.teamB.colorSecondary}
                                    />
                        </Box>

                        <GameControls
                            isInteractive={isUserGame}
                            isGameComplete={isUserGame ? interactiveState.isGameComplete : isGameComplete}
                            isPlaybackComplete={isPlaybackComplete}
                            startInteractiveSimulation={() => {}}
                            handleNextPlay={handleNextPlay}
                            handleNextDrive={handleNextDrive}
                            handleSimToEnd={handleSimToEnd}
                            decisionPrompt={isUserGame && interactiveState.isUserOffenseNow ? interactiveState.decisionPrompt ?? undefined : undefined}
                            handleDecision={isUserGame && interactiveState.isUserOffenseNow && interactiveState.decisionPrompt ? interactiveActions.handleDecision : undefined}
                            submittingDecision={interactiveState.submittingDecision}
                        />
                        </Box>

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
                                drives={effectiveDrives as any}
                                currentPlayIndex={effectiveCurrentPlayIndex}
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
