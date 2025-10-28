import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

// Types for plays bank simulation
interface PlayData {
    playType: string;
    yardsGained: number;
    result: string;
}

interface PlaysBank {
    teamA: {
        run: PlayData[];
        pass: PlayData[];
        punt: PlayData[];
        field_goal: PlayData[];
    };
    teamB: {
        run: PlayData[];
        pass: PlayData[];
        punt: PlayData[];
        field_goal: PlayData[];
    };
}

interface GameState {
    score_a: number;
    score_b: number;
    field_position: number;
    down: number;
    yards_left: number;
    current_drive_num: number;
    current_play_index: number;
    overtime: number;
    is_user_team_on_offense: boolean;
    used_plays: any[];
    drives: any[];
}

interface Drive {
    driveNum: number;
    offense: string;
    defense: string;
    startingFP: number;
    result: string;
    points: number;
    scoreAAfter: number;
    scoreBAfter: number;
}

interface Play {
    playType: string;
    yardsGained: number;
    result: string;
    startingFP: number;
    down: number;
    yardsLeft: number;
    scoreA: number;
    scoreB: number;
    text: string;
    offense: string;
    defense: string;
}

export const usePlaysBankSimulation = (gameId: number | null, open: boolean, isUserGame: boolean) => {
    const [loading, setLoading] = useState(false);
    const [playsBank, setPlaysBank] = useState<PlaysBank | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [gameData, setGameData] = useState<any>(null);
    const [currentPlay, setCurrentPlay] = useState<Play | null>(null);
    const [plays, setPlays] = useState<Play[]>([]);
    const [drives, setDrives] = useState<Drive[]>([]);
    const [isGameComplete, setIsGameComplete] = useState(false);
    const [decisionPrompt, setDecisionPrompt] = useState<any>(null);
    const [submittingDecision, setSubmittingDecision] = useState(false);

    // Play indices for each team/play type
    const [playIndices, setPlayIndices] = useState({
        teamA: { run: 0, pass: 0, punt: 0, field_goal: 0 },
        teamB: { run: 0, pass: 0, punt: 0, field_goal: 0 }
    });

    // Start simulation when modal opens
    useEffect(() => {
        if (open && gameId && isUserGame) {
            console.log('🎮 Starting plays bank simulation for game:', gameId);
            startPlaysBankSimulation();
        }
    }, [open, gameId, isUserGame]);

    const startPlaysBankSimulation = async () => {
        if (!gameId) return;
        
        setLoading(true);
        try {
            const response = await apiService.startInteractiveSim(gameId) as any;
            console.log('📊 Plays bank response:', response);
            
            setPlaysBank(response.plays_bank);
            setGameState(response.game_state);
            setGameData(response.game);
            setDecisionPrompt(response.decision_needed);
            setPlays([]);
            setDrives([]);
            setIsGameComplete(false);
            setPlayIndices({
                teamA: { run: 0, pass: 0, punt: 0, field_goal: 0 },
                teamB: { run: 0, pass: 0, punt: 0, field_goal: 0 }
            });
        } catch (error) {
            console.error('❌ Error starting plays bank simulation:', error);
        } finally {
            setLoading(false);
        }
    };

    const getNextPlay = useCallback((playType: string): PlayData | null => {
        if (!playsBank || !gameState) return null;
        
        const currentTeam = gameState.is_user_team_on_offense ? 'teamA' : 'teamB';
        const teamPlays = playsBank[currentTeam][playType as keyof typeof playsBank['teamA']];
        
        if (!teamPlays || teamPlays.length === 0) return null;
        
        const currentIndex = playIndices[currentTeam][playType as keyof typeof playIndices['teamA']];
        const play = teamPlays[currentIndex];
        
        // Update index for next time
        setPlayIndices(prev => ({
            ...prev,
            [currentTeam]: {
                ...prev[currentTeam],
                [playType]: (currentIndex + 1) % teamPlays.length
            }
        }));
        
        return play;
    }, [playsBank, gameState, playIndices]);

    const createPlayObject = useCallback((playData: PlayData): Play => {
        if (!gameState || !gameData) throw new Error('Game state or data not available');
        
        const currentTeam = gameState.is_user_team_on_offense ? 'teamA' : 'teamB';
        const offense = currentTeam === 'teamA' ? gameData.teamA.name : gameData.teamB.name;
        const defense = currentTeam === 'teamA' ? gameData.teamB.name : gameData.teamA.name;
        
        // Create play text based on play type and result
        let text = '';
        if (playData.playType === 'run') {
            if (playData.result === 'touchdown') {
                text = `Touchdown! ${playData.yardsGained} yard run`;
            } else if (playData.result === 'fumble') {
                text = `Fumble on ${playData.yardsGained} yard run`;
            } else {
                text = `Run for ${playData.yardsGained} yards`;
            }
        } else if (playData.playType === 'pass') {
            if (playData.result === 'touchdown') {
                text = `Touchdown! ${playData.yardsGained} yard pass`;
            } else if (playData.result === 'interception') {
                text = `Interception on pass attempt`;
            } else if (playData.result === 'incomplete pass') {
                text = `Incomplete pass`;
            } else {
                text = `Pass complete for ${playData.yardsGained} yards`;
            }
        } else if (playData.playType === 'punt') {
            text = `Punt`;
        } else if (playData.playType === 'field_goal') {
            text = playData.result === 'made field goal' ? 'Field goal is good' : 'Field goal is no good';
        }
        
        return {
            playType: playData.playType,
            yardsGained: playData.yardsGained,
            result: playData.result,
            startingFP: gameState.field_position,
            down: gameState.down,
            yardsLeft: gameState.yards_left,
            scoreA: gameState.score_a,
            scoreB: gameState.score_b,
            text,
            offense,
            defense
        };
    }, [gameState, gameData]);

    const updateGameState = useCallback((play: Play) => {
        if (!gameState) return;
        
        const newState = { ...gameState };
        
        // Update field position and yards
        newState.field_position += play.yardsGained;
        newState.yards_left -= play.yardsGained;
        
        // Update scores if touchdown
        if (play.result === 'touchdown') {
            if (newState.is_user_team_on_offense) {
                newState.score_a += 7;
            } else {
                newState.score_b += 7;
            }
        }
        
        // Check for first down
        if (newState.yards_left <= 0) {
            newState.down = 1;
            newState.yards_left = 100 - newState.field_position;
            if (newState.yards_left > 10) newState.yards_left = 10;
        } else {
            newState.down += 1;
        }
        
        // Check for drive-ending results
        if (play.result === 'touchdown' || play.result === 'interception' || play.result === 'fumble') {
            // End current drive
            const drive: Drive = {
                driveNum: newState.current_drive_num,
                offense: newState.is_user_team_on_offense ? 'teamA' : 'teamB',
                defense: newState.is_user_team_on_offense ? 'teamB' : 'teamA',
                startingFP: newState.field_position - play.yardsGained,
                result: play.result,
                points: play.result === 'touchdown' ? 7 : 0,
                scoreAAfter: newState.score_a,
                scoreBAfter: newState.score_b
            };
            
            newState.drives.push(drive);
            setDrives(prev => [...prev, drive]);
            
            // Start new drive
            newState.current_drive_num += 1;
            newState.field_position = 20; // Start at 20 yard line
            newState.down = 1;
            newState.yards_left = 10;
            newState.is_user_team_on_offense = newState.current_drive_num % 2 === 1;
        } else if (newState.down > 4) {
            // Turnover on downs
            const drive: Drive = {
                driveNum: newState.current_drive_num,
                offense: newState.is_user_team_on_offense ? 'teamA' : 'teamB',
                defense: newState.is_user_team_on_offense ? 'teamB' : 'teamA',
                startingFP: newState.field_position - play.yardsGained,
                result: 'turnover on downs',
                points: 0,
                scoreAAfter: newState.score_a,
                scoreBAfter: newState.score_b
            };
            
            newState.drives.push(drive);
            setDrives(prev => [...prev, drive]);
            
            // Start new drive
            newState.current_drive_num += 1;
            newState.field_position = 100 - newState.field_position; // Flip field
            newState.down = 1;
            newState.yards_left = 100 - newState.field_position;
            if (newState.yards_left > 10) newState.yards_left = 10;
            newState.is_user_team_on_offense = newState.current_drive_num % 2 === 1;
        }
        
        // Add play to used plays
        newState.used_plays.push(play);
        
        setGameState(newState);
        setPlays(prev => [...prev, play]);
        setCurrentPlay(play);
        
        // Check if game is complete
        if (newState.current_drive_num > 20 || (newState.score_a !== newState.score_b && newState.current_drive_num > 8)) {
            setIsGameComplete(true);
        }
    }, [gameState]);

    const handleDecision = useCallback(async (decision: string) => {
        if (!gameState || !playsBank) return;
        
        setSubmittingDecision(true);
        setDecisionPrompt(null);
        
        try {
            let playData: PlayData | null = null;
            
            if (decision === 'run') {
                playData = getNextPlay('run');
            } else if (decision === 'pass') {
                playData = getNextPlay('pass');
            } else if (decision === 'punt') {
                playData = getNextPlay('punt');
            } else if (decision === 'field_goal') {
                playData = getNextPlay('field_goal');
            } else if (decision === 'go_run') {
                playData = getNextPlay('run');
            } else if (decision === 'go_pass') {
                playData = getNextPlay('pass');
            }
            
            if (playData) {
                const play = createPlayObject(playData);
                updateGameState(play);
                
                // Check if we need another decision
                if (!isGameComplete && gameState.is_user_team_on_offense && gameState.down < 4) {
                    setDecisionPrompt({
                        type: 'run_pass',
                        down: gameState.down,
                        yards_left: gameState.yards_left,
                        field_position: gameState.field_position
                    });
                } else if (!isGameComplete && gameState.is_user_team_on_offense && gameState.down === 4) {
                    setDecisionPrompt({
                        type: 'fourth_down',
                        down: 4,
                        yards_left: gameState.yards_left,
                        field_position: gameState.field_position,
                        options: ['go', 'punt', 'field_goal']
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error handling decision:', error);
        } finally {
            setSubmittingDecision(false);
        }
    }, [gameState, playsBank, getNextPlay, createPlayObject, updateGameState, isGameComplete]);

    const completeGame = useCallback(async () => {
        if (!gameId || !gameState) return;
        
        try {
            const gameData = {
                used_plays: gameState.used_plays,
                drives: gameState.drives,
                score_a: gameState.score_a,
                score_b: gameState.score_b
            };
            
            await apiService.completeInteractiveSim(gameId, gameData);
            console.log('✅ Game completed and saved');
        } catch (error) {
            console.error('❌ Error completing game:', error);
        }
    }, [gameId, gameState]);

    const exitSimulation = useCallback(async () => {
        if (!gameId) return;
        
        try {
            await apiService.exitInteractiveSim(gameId);
            console.log('🚪 Exited simulation');
        } catch (error) {
            console.error('❌ Error exiting simulation:', error);
        }
    }, [gameId]);

    const reset = useCallback(() => {
        setLoading(false);
        setPlaysBank(null);
        setGameState(null);
        setGameData(null);
        setCurrentPlay(null);
        setPlays([]);
        setDrives([]);
        setIsGameComplete(false);
        setDecisionPrompt(null);
        setSubmittingDecision(false);
        setPlayIndices({
            teamA: { run: 0, pass: 0, punt: 0, field_goal: 0 },
            teamB: { run: 0, pass: 0, punt: 0, field_goal: 0 }
        });
    }, []);

    return {
        loading,
        playsBank,
        gameState,
        gameData,
        currentPlay,
        plays,
        drives,
        isGameComplete,
        decisionPrompt,
        submittingDecision,
        handleDecision,
        completeGame,
        exitSimulation,
        reset
    };
};
