import {
    Dialog,
    DialogContent,
    Box,
    CircularProgress,
} from "@mui/material";
import DriveSummary from "./DriveSummary";
import FootballField from "./FootballField";
import GameHeader from "./GameHeader";
import GameControls from "./GameControls";
import { usePlaysBankSimulation } from "../hooks/usePlaysBankSimulation";
import { useState, useEffect } from "react";

interface InteractiveSimModalProps {
    open: boolean;
    onClose: () => void;
    gameId: number | null;
}

const InteractiveSimModal = ({
    open,
    onClose,
    gameId,
}: InteractiveSimModalProps) => {
    // Interactive sim hook
    const {
        currentPlay,
        gameData,
        plays,
        drives,
        isGameComplete,
        decisionPrompt,
        submittingDecision,
        handleDecision,
        completeGame,
        exitSimulation,
        reset
    } = usePlaysBankSimulation(gameId, open, true);

    const isTeamAOnOffense = currentPlay?.offense === gameData?.teamA.name;
    const fieldPosition = currentPlay?.startingFP || 20;
    const previousPlayYards = currentPlay?.yardsGained || 0;

    // Get the last play text using nested loops
    const getLastPlayText = () => {
        return currentPlay?.text || '';
    };

    const handleClose = async () => {
        if (!isGameComplete) {
            await exitSimulation();
        }
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
            <DialogContent sx={{ p: 0, minHeight: "80vh" }}>
                <Box sx={{ display: "flex", height: "100%" }}>
                    {/* Left side - Main content */}
                    <Box sx={{ flex: 1, p: 3 }}>
                        {/* Game Header */}
                        <GameHeader
                            gameData={gameData}
                            currentPlay={currentPlay}
                            isTeamAOnOffense={isTeamAOnOffense}
                            plays={plays}
                            isPlaybackComplete={isGameComplete}
                            lastPlayText={getLastPlayText()}
                        />

                        {/* Game Controls with Decision Panel */}
                        <GameControls
                            isInteractive={true}
                            isGameComplete={isGameComplete}
                            isPlaybackComplete={isGameComplete}
                            startInteractiveSimulation={() => {}}
                            handleNextPlay={() => handleDecision("auto")}
                            handleNextDrive={() => handleDecision("auto")}
                            handleSimToEnd={() => completeGame()}
                            decisionPrompt={decisionPrompt}
                            handleDecision={handleDecision}
                            submittingDecision={submittingDecision}
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
                    </Box>

                    {/* Right side - Drive Summary */}
                    <Box
                        sx={{
                            width: 400,
                            backgroundColor: "grey.50",
                            borderLeft: "1px solid",
                            borderColor: "divider",
                            p: 2,
                        }}
                    >
                        <DriveSummary
                            drives={drives as any}
                            currentPlayIndex={plays.length}
                            variant="modal"
                        />
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default InteractiveSimModal;
