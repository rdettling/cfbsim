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
import { useEffect } from "react";
import { useInteractiveSim } from './useInteractiveSim';
import type { LiveSimModalProps } from '../../types/components';

const LiveSimModal = ({
    open,
    onClose,
    gameId,
    isUserGame,
}: LiveSimModalProps) => {
    const sim = useInteractiveSim({ gameId, allowUserDecision: isUserGame });
    const { state, actions } = sim;

    useEffect(() => {
        if (open && gameId) {
            actions.start();
        }
    }, [open, gameId]);

    const handleClose = () => {
        actions.reset();
        onClose();
    };

    if (!state.gameData) {
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

    const homeTeam = state.gameData.homeTeamId
        ? (state.gameData.homeTeamId === state.gameData.teamA.id ? state.gameData.teamA : state.gameData.teamB)
        : state.gameData.teamA;

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
                        gameData={state.gameData}
                        currentPlay={state.displayPlay}
                        isTeamAOnOffense={state.isTeamAOnOffense}
                        plays={state.plays}
                        isPlaybackComplete={state.isPlaybackComplete}
                        currentDrive={state.displayDrive}
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2.4fr 1fr' }, gap: 2, flex: 1, minHeight: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
                            <Box sx={{ background: 'rgba(255,255,255,0.9)', borderRadius: 3, p: 2, boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)' }}>
                                <FootballField 
                                    currentYardLine={state.fieldPosition}
                                    teamA={state.gameData.teamA.name}
                                    teamB={state.gameData.teamB.name}
                                    homeTeamName={homeTeam.name}
                                    homeTeamMascot={homeTeam.mascot}
                                    homeTeamColorPrimary={homeTeam.colorPrimary}
                                    homeTeamColorSecondary={homeTeam.colorSecondary}
                                    isTeamAOnOffense={state.isTeamAOnOffense}
                                    down={state.displayPlay?.down ?? 1}
                                    yardsToGo={state.displayPlay?.yardsLeft ?? 10}
                                    previousPlayYards={state.previousPlayYards}
                                    teamAColorPrimary={state.gameData.teamA.colorPrimary}
                                    teamAColorSecondary={state.gameData.teamA.colorSecondary}
                                    teamBColorPrimary={state.gameData.teamB.colorPrimary}
                                    teamBColorSecondary={state.gameData.teamB.colorSecondary}
                                />
                            </Box>

                            <Box sx={{ background: 'rgba(255,255,255,0.92)', borderRadius: 3, p: 2.5, boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Box sx={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
                                        {state.displayPlay?.header ?? 'Waiting for snap'}
                                    </Box>
                                    <Box sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                                        Drive {(state.displayDrive?.driveNum || 0) + 1}
                                    </Box>
                                </Box>
                                <Box sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
                                    {state.lastPlayText ? `Last play: ${state.lastPlayText}` : 'No plays yet'}
                                </Box>
                            </Box>

                            <Box sx={{ background: 'rgba(255,255,255,0.95)', borderRadius: 3, overflow: 'hidden', boxShadow: '0 12px 26px rgba(15, 23, 42, 0.08)' }}>
                                <GameControls
                                    isInteractive
                                    isGameComplete={state.isGameComplete}
                                    isPlaybackComplete={state.isPlaybackComplete}
                                    startInteractiveSimulation={() => {}}
                                    handleNextPlay={() => actions.simulateAutoPlays(1)}
                                    handleNextDrive={actions.simulateAutoDrive}
                                    handleSimToEnd={actions.simulateToEnd}
                                    decisionPrompt={isUserGame && state.isUserOffenseNow ? state.decisionPrompt ?? undefined : undefined}
                                    handleDecision={isUserGame && state.isUserOffenseNow && state.decisionPrompt ? actions.handleDecision : undefined}
                                    submittingDecision={state.submittingDecision}
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
                                    drives={state.drives as any}
                                    currentPlayIndex={state.currentPlayIndex}
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
