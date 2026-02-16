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
import { useState, useEffect, useRef } from "react";
import {
    liveSimGame,
    prepareInteractiveLiveGame,
    finalizeGameSimulation,
} from "../../domain/sim";
import {
    simDrive,
    startInteractiveDrive,
    stepInteractiveDrive,
    buildGameData,
    finalizeGameResult,
    DRIVES_PER_TEAM,
    OT_START_YARD_LINE,
} from "../../domain/sim/engine";
import type { LiveSimModalProps, GameControlsProps } from '../../types/components';
import type { LeagueState } from '../../types/league';
import type { GameRecord, DriveRecord, PlayRecord, PlayerRecord } from '../../types/db';
import type { SimGame, StartersCache, InteractiveDriveState } from '../../types/sim';
import type { Team } from '../../types/domain';

type InteractiveContext = {
    league: LeagueState;
    record: GameRecord;
    teamsById: Map<number, Team>;
    starters: StartersCache;
    playersById: Map<number, PlayerRecord>;
    simGame: SimGame;
    preRecordA: string;
    preRecordB: string;
    userTeamId: number | null;
    driveNum: number;
    fieldPosition: number;
    inOvertime: boolean;
    otPossession: number;
    currentDriveState: InteractiveDriveState | null;
    currentOffense: Team | null;
    currentDefense: Team | null;
};

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

    const [decisionPrompt, setDecisionPrompt] = useState<GameControlsProps['decisionPrompt'] | null>(null);
    const [submittingDecision, setSubmittingDecision] = useState(false);

    const playsRef = useRef<Play[]>([]);
    const drivesRef = useRef<Map<number, Drive>>(new Map());
    const driveRecordsRef = useRef<DriveRecord[]>([]);
    const playRecordsRef = useRef<PlayRecord[]>([]);
    const interactiveContext = useRef<InteractiveContext | null>(null);

    // Calculate if playback is complete for regular sim
    const isPlaybackComplete = currentPlayIndex >= plays.length;

    // Mark game as complete when user has watched through all plays
    useEffect(() => {
        if (isPlaybackComplete && plays.length > 0 && !isGameComplete) {
            setIsGameComplete(true);
        }
    }, [isPlaybackComplete, plays.length, isGameComplete]);

    // Start simulation when modal opens
    useEffect(() => {
        if (open && gameId) {
            if (isUserGame) {
                startInteractiveSimulation();
            } else {
                startRegularSimulation();
            }
        }
    }, [open, gameId, isUserGame]);

    const startRegularSimulation = async () => {
        if (!gameId) return;

        try {
            resetInteractiveRefs();
            const response = await liveSimGame(gameId);
            handleRegularResponse(response);
        } catch (error) {
            console.error('❌ Error starting simulation:', error);
        }
    };

    const resetInteractiveRefs = () => {
        playsRef.current = [];
        drivesRef.current = new Map();
        driveRecordsRef.current = [];
        playRecordsRef.current = [];
        interactiveContext.current = null;
        setDecisionPrompt(null);
        setSubmittingDecision(false);
    };

    const startInteractiveSimulation = async () => {
        if (!gameId) return;

        try {
            resetInteractiveRefs();
            const response = await prepareInteractiveLiveGame(gameId);
            if (response.status === 'complete') {
                handleRegularResponse(response);
                return;
            }

            const context: InteractiveContext = {
                league: response.league,
                record: response.record,
                teamsById: response.teamsById,
                starters: response.starters,
                playersById: response.playersById,
                simGame: response.simGame,
                preRecordA: response.preRecordA,
                preRecordB: response.preRecordB,
                userTeamId: response.league.teams.find(team => team.name === response.league.info.team)?.id ?? null,
                driveNum: 0,
                fieldPosition: 20,
                inOvertime: false,
                otPossession: 0,
                currentDriveState: null,
                currentOffense: null,
                currentDefense: null,
            };
            interactiveContext.current = context;

            setPlays([]);
            setDrives([]);
            setCurrentPlayIndex(0);
            setIsGameComplete(false);
            setGameData(buildGameData(response.record, response.teamsById));

            await advanceToNextDrive();
        } catch (error) {
            console.error('❌ Error starting interactive simulation:', error);
        }
    };

    const handleRegularResponse = (response: any) => {
        // Store drives
        setDrives(response.drives);

        // Flatten drives into a single array of plays for navigation
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
        resetInteractiveRefs();
    };

    const buildDecisionPrompt = (state: InteractiveDriveState) => ({
        type: state.down === 4 ? 'fourth_down' : 'run_pass',
        down: state.down,
        yards_left: state.yardsLeft,
        field_position: state.fieldPosition,
        allow_sim_drive: true,
    }) as GameControlsProps['decisionPrompt'];

    const mapPlayRecord = (play: PlayRecord): Play => ({
        id: play.id,
        down: play.down,
        yardsLeft: play.yardsLeft,
        startingFP: play.startingFP,
        playType: play.playType,
        yardsGained: play.yardsGained,
        text: play.text,
        header: play.header,
        result: play.result,
        scoreA: play.scoreA,
        scoreB: play.scoreB,
    });

    const upsertDriveUi = (driveRecord: DriveRecord) => {
        const context = interactiveContext.current;
        if (!context) return null;
        const offense = context.teamsById.get(driveRecord.offenseId);
        const defense = context.teamsById.get(driveRecord.defenseId);
        const existing = drivesRef.current.get(driveRecord.id);
        if (existing) return existing;
        const created: Drive = {
            driveNum: driveRecord.driveNum,
            offense: offense?.name ?? '',
            defense: defense?.name ?? '',
            startingFP: driveRecord.startingFP,
            result: driveRecord.result,
            points: driveRecord.points,
            scoreAAfter: driveRecord.scoreAAfter,
            scoreBAfter: driveRecord.scoreBAfter,
            plays: [],
            yards: 0,
        };
        drivesRef.current.set(driveRecord.id, created);
        return created;
    };

    const addPlaysToDrive = (driveRecord: DriveRecord, newPlays: PlayRecord[], finalizeDrive = false) => {
        const driveUi = upsertDriveUi(driveRecord);
        if (!driveUi) return;

        const mappedPlays = newPlays.map(mapPlayRecord);
        driveUi.plays = [...driveUi.plays, ...mappedPlays];
        driveUi.yards = driveUi.plays.reduce((sum, play) => sum + play.yardsGained, 0);

        if (finalizeDrive) {
            driveUi.result = driveRecord.result;
            driveUi.points = driveRecord.points;
            driveUi.scoreAAfter = driveRecord.scoreAAfter;
            driveUi.scoreBAfter = driveRecord.scoreBAfter;
        }

        drivesRef.current.set(driveRecord.id, driveUi);
        setDrives(Array.from(drivesRef.current.values()).sort((a, b) => a.driveNum - b.driveNum));

        if (mappedPlays.length) {
            playsRef.current = [...playsRef.current, ...mappedPlays];
            setPlays(playsRef.current);
            setCurrentPlayIndex(playsRef.current.length - 1);
        }
    };

    const advanceDriveCounters = () => {
        const context = interactiveContext.current;
        if (!context) return;

        if (context.inOvertime) {
            context.otPossession += 1;
            context.driveNum += 1;
            if (context.otPossession >= 2) {
                if (context.simGame.scoreA !== context.simGame.scoreB) {
                    finishInteractiveGame();
                    return;
                }
                context.otPossession = 0;
            }
        } else {
            context.driveNum += 1;
        }

        advanceToNextDrive();
    };

    const applyDriveResult = (driveRecord: DriveRecord, playRecords: PlayRecord[], nextFieldPosition: number) => {
        const context = interactiveContext.current;
        if (!context) return;

        addPlaysToDrive(driveRecord, playRecords, true);
        playRecordsRef.current.push(...playRecords);
        driveRecordsRef.current.push(driveRecord);

        context.fieldPosition = nextFieldPosition;
        setGameData(prev => prev ? { ...prev, scoreA: context.simGame.scoreA, scoreB: context.simGame.scoreB } : prev);

        advanceDriveCounters();
    };

    const advanceToNextDrive = async () => {
        const context = interactiveContext.current;
        if (!context) return;

        if (!context.inOvertime) {
            if (context.driveNum >= DRIVES_PER_TEAM * 2) {
                if (context.simGame.scoreA === context.simGame.scoreB) {
                    context.inOvertime = true;
                    context.otPossession = 0;
                    context.simGame.overtime = 0;
                    context.driveNum = DRIVES_PER_TEAM * 2 + 1;
                } else {
                    finishInteractiveGame();
                    return;
                }
            }
        }

        if (context.inOvertime && context.otPossession === 0) {
            context.simGame.overtime += 1;
        }

        const isTeamA = context.inOvertime ? context.otPossession === 0 : context.driveNum % 2 === 0;
        const offense = isTeamA ? context.simGame.teamA : context.simGame.teamB;
        const defense = isTeamA ? context.simGame.teamB : context.simGame.teamA;
        const lead = isTeamA ? context.simGame.scoreA - context.simGame.scoreB : context.simGame.scoreB - context.simGame.scoreA;

        const fieldPosition = context.inOvertime
            ? OT_START_YARD_LINE
            : (context.driveNum === 0 || context.driveNum === DRIVES_PER_TEAM ? 20 : context.fieldPosition);

        context.fieldPosition = fieldPosition;
        context.currentOffense = offense;
        context.currentDefense = defense;

        const isUserOffense = context.userTeamId ? offense.id === context.userTeamId : false;
        if (!isUserOffense) {
            setDecisionPrompt(null);
            const driveResult = simDrive(
                context.league,
                context.simGame,
                fieldPosition,
                lead,
                offense,
                defense,
                context.driveNum,
                context.starters
            );
            context.simGame.scoreA = driveResult.record.scoreAAfter;
            context.simGame.scoreB = driveResult.record.scoreBAfter;
            applyDriveResult(driveResult.record, driveResult.plays, driveResult.nextFieldPosition);
            return;
        }

        const driveState = startInteractiveDrive(
            context.league,
            context.simGame,
            fieldPosition,
            lead,
            offense,
            defense,
            context.driveNum
        );
        context.currentDriveState = driveState;

        setDecisionPrompt(buildDecisionPrompt(driveState));
    };

    const finishInteractiveGame = async () => {
        const context = interactiveContext.current;
        if (!context) return;

        finalizeGameResult(context.simGame);
        setDecisionPrompt(null);
        setIsGameComplete(true);
        setCurrentPlayIndex(playsRef.current.length);

        try {
            const result = await finalizeGameSimulation({
                league: context.league,
                record: context.record,
                simGame: context.simGame,
                driveRecords: driveRecordsRef.current,
                playRecords: playRecordsRef.current,
                starters: context.starters,
                playersById: context.playersById,
                preRecordA: context.preRecordA,
                preRecordB: context.preRecordB,
            });
            setGameData(result.game);
            setDrives(result.drives);
        } catch (error) {
            console.error('❌ Error finalizing interactive game:', error);
        }
    };

    const handleDecision = async (decision: string) => {
        const context = interactiveContext.current;
        if (!context || !context.currentDriveState || !context.currentOffense || !context.currentDefense) return;

        setSubmittingDecision(true);
        try {
            if (decision === 'sim_drive') {
                let driveState = context.currentDriveState;
                const playBuffer: PlayRecord[] = [];
                let stepResult: ReturnType<typeof stepInteractiveDrive> | null = null;
                let guard = 0;
                while (guard < 200) {
                    stepResult = stepInteractiveDrive(
                        context.league,
                        context.simGame,
                        driveState,
                        'auto',
                        context.currentOffense,
                        context.currentDefense,
                        context.starters
                    );
                    playBuffer.push(stepResult.play);
                    driveState = stepResult.state as InteractiveDriveState;
                    if (stepResult.driveComplete) break;
                    guard += 1;
                }

                context.currentDriveState = driveState;
                addPlaysToDrive(driveState.drive, playBuffer, stepResult?.driveComplete ?? false);
                playRecordsRef.current.push(...playBuffer);

                if (stepResult?.driveComplete) {
                    driveRecordsRef.current.push(driveState.drive);
                    const nextFieldPosition = stepResult.nextFieldPosition ?? context.fieldPosition;
                    context.fieldPosition = nextFieldPosition;
                    setGameData(prev => prev ? { ...prev, scoreA: context.simGame.scoreA, scoreB: context.simGame.scoreB } : prev);
                    advanceDriveCounters();
                } else {
                    setDecisionPrompt(buildDecisionPrompt(driveState));
                }
                return;
            }

            const stepResult = stepInteractiveDrive(
                context.league,
                context.simGame,
                context.currentDriveState,
                decision === 'field_goal' ? 'field_goal' : decision === 'punt' ? 'punt' : decision === 'pass' ? 'pass' : 'run',
                context.currentOffense,
                context.currentDefense,
                context.starters
            );

            context.currentDriveState = stepResult.state as InteractiveDriveState;
            addPlaysToDrive(stepResult.state.drive, [stepResult.play], stepResult.driveComplete);
            playRecordsRef.current.push(stepResult.play);

            if (stepResult.driveComplete) {
                driveRecordsRef.current.push(stepResult.state.drive);
                const nextFieldPosition = stepResult.nextFieldPosition ?? context.fieldPosition;
                context.fieldPosition = nextFieldPosition;
                setGameData(prev => prev ? { ...prev, scoreA: context.simGame.scoreA, scoreB: context.simGame.scoreB } : prev);
                advanceDriveCounters();
            } else {
                setDecisionPrompt(buildDecisionPrompt(stepResult.state));
            }
        } finally {
            setSubmittingDecision(false);
        }
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
    const isTeamAOnOffense = currentDrive
        ? currentDrive.offense === gameData?.teamA.name
        : interactiveContext.current?.currentOffense?.id === gameData?.teamA.id;

    // Set up the simulation data structure
    const simLoop = () => {
        if (plays.length === 0) return;

        // Just set up the data - user controls progression with buttons
        setCurrentPlayIndex(0);
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
    const fieldPosition = currentPlay?.startingFP
        || interactiveContext.current?.currentDriveState?.fieldPosition
        || 20;

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
                            isInteractive={isUserGame}
                            isGameComplete={isGameComplete}
                            isPlaybackComplete={isPlaybackComplete}
                            startInteractiveSimulation={() => {}}
                            handleNextPlay={handleNextPlay}
                            handleNextDrive={handleNextDrive}
                            handleSimToEnd={handleSimToEnd}
                            decisionPrompt={decisionPrompt ?? undefined}
                            handleDecision={decisionPrompt ? handleDecision : undefined}
                            submittingDecision={submittingDecision}
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
