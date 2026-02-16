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
import GameScoreStrip from "../game/GameScoreStrip";
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
            <DialogContent sx={{ p: 0, height: "88vh", maxHeight: "88vh", position: 'relative', background: 'linear-gradient(180deg, #f7f2ea 0%, #eef2f7 60%, #e7eef2 100%)' }}>
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

                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2, p: 3, fontFamily: '"IBM Plex Sans", sans-serif' }}>
                    <GameScoreStrip
                        gameData={displayData}
                        currentPlay={headerPlay}
                        isTeamAOnOffense={headerIsTeamAOnOffense}
                        plays={effectivePlays}
                        isPlaybackComplete={isPlaybackComplete}
                        currentDrive={headerDrive}
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2.4fr 1fr' }, gap: 2, flex: 1, minHeight: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
                            <Box sx={{ background: 'rgba(255,255,255,0.9)', borderRadius: 3, p: 2, boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)' }}>
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

                            <Box sx={{ background: 'rgba(255,255,255,0.92)', borderRadius: 3, p: 2.5, boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Box sx={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
                                        {headerPlay?.header ?? 'Waiting for snap'}
                                    </Box>
                                    <Box sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                                        Drive {(headerDrive?.driveNum || 0) + 1}
                                    </Box>
                                </Box>
                                <Box sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                                    {headerLastPlayText ? `Last play: ${headerLastPlayText}` : 'No plays yet'}
                                </Box>
                            </Box>

                            <Box sx={{ background: 'rgba(255,255,255,0.95)', borderRadius: 3, overflow: 'hidden', boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)' }}>
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
                        </Box>

                        <Box
                            sx={{
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,255,0.95) 100%)',
                                borderRadius: 3,
                                p: 2,
                                boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0
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
                                    background: 'rgba(0,0,0,0.08)',
                                    borderRadius: '3px',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    background: 'rgba(0,0,0,0.25)',
                                    borderRadius: '3px',
                                },
                                '&::-webkit-scrollbar-thumb:hover': {
                                    background: 'rgba(0,0,0,0.45)',
                                }
                            }}>
                                <DriveSummary 
                                    drives={effectiveDrives as any}
                                    currentPlayIndex={effectiveCurrentPlayIndex}
                                    variant="modal"
                                    includeCurrentDrive
                                />
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default LiveSimModal;
