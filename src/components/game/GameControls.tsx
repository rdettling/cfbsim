import { Box, Button, Typography } from '@mui/material';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastForwardIcon from '@mui/icons-material/FastForward';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import type { GameControlsProps } from '../../types/components';

const GameControls = ({
    isInteractive,
    isGameComplete,
    isPlaybackComplete,
    startInteractiveSimulation,
    handleNextPlay,
    handleNextDrive,
    handleSimToEnd,
    decisionPrompt,
    handleDecision,
    submittingDecision = false
}: GameControlsProps) => {
    // Render decision buttons if we have a decision prompt
    if (decisionPrompt && handleDecision) {
        const { type, down, yards_left, field_position } = decisionPrompt;
        
        if (type === 'run_pass') {
            const location = field_position <= 50 ? 'OWN' : 'OPP';
            const yardLine = field_position <= 50 ? field_position : 100 - field_position;
            
            return (
                <Box sx={{ 
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    p: 2,
                    backgroundColor: 'primary.main',
                    color: 'white'
                }}>
                    <Typography variant="h6" fontWeight="bold" textAlign="center" sx={{ mb: 2 }}>
                        {down}st & {yards_left} at {location} {yardLine}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<DirectionsRunIcon />}
                            onClick={() => handleDecision('run')}
                            disabled={submittingDecision}
                            sx={{ minWidth: 120 }}
                        >
                            RUN
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<SportsSoccerIcon />}
                            onClick={() => handleDecision('pass')}
                            disabled={submittingDecision}
                            sx={{ minWidth: 120 }}
                        >
                            PASS
                        </Button>
                        {decisionPrompt.allow_sim_drive && (
                            <Button
                                variant="outlined"
                                color="inherit"
                                startIcon={<FastForwardIcon />}
                                onClick={() => handleDecision('sim_drive')}
                                disabled={submittingDecision}
                                sx={{ minWidth: 140 }}
                            >
                                SIM DRIVE
                            </Button>
                        )}
                    </Box>
                </Box>
            );
        }
        
        if (type === 'fourth_down') {
            const location = field_position <= 50 ? 'OWN' : 'OPP';
            const yardLine = field_position <= 50 ? field_position : 100 - field_position;
            
            return (
                <Box sx={{ 
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    p: 2,
                    backgroundColor: 'warning.main',
                    color: 'white'
                }}>
                    <Typography variant="h6" fontWeight="bold" textAlign="center" sx={{ mb: 2 }}>
                        4th & {yards_left} at {location} {yardLine}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<DirectionsRunIcon />}
                            onClick={() => handleDecision('run')}
                            disabled={submittingDecision}
                            size="small"
                        >
                            RUN
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<SportsSoccerIcon />}
                            onClick={() => handleDecision('pass')}
                            disabled={submittingDecision}
                            size="small"
                        >
                            PASS
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => handleDecision('punt')}
                            disabled={submittingDecision}
                            size="small"
                        >
                            PUNT
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => handleDecision('field_goal')}
                            disabled={submittingDecision}
                            size="small"
                        >
                            FG
                        </Button>
                        {decisionPrompt.allow_sim_drive && (
                            <Button
                                variant="outlined"
                                color="inherit"
                                startIcon={<FastForwardIcon />}
                                onClick={() => handleDecision('sim_drive')}
                                disabled={submittingDecision}
                                size="small"
                            >
                                SIM DRIVE
                            </Button>
                        )}
                    </Box>
                </Box>
            );
        }
    }

    if (isInteractive) {
        return null;
    }

    // Regular game controls
    return (
        <Box sx={{ 
            borderTop: '1px solid',
            borderColor: 'divider',
            p: 2,
            display: 'flex',
            gap: 2,
            justifyContent: 'center',
            flexWrap: 'wrap'
        }}>
            {isInteractive && !isGameComplete && (
                <Button
                    variant="contained"
                    color="primary"
                    onClick={startInteractiveSimulation}
                    disabled={isGameComplete}
                >
                    Start Interactive Simulation
                </Button>
            )}
            
            <Button
                variant="outlined"
                startIcon={<SkipNextIcon />}
                onClick={handleNextPlay}
                disabled={!isInteractive && isPlaybackComplete}
            >
                {isInteractive ? 'Continue Simulation' : 'Next Play'}
            </Button>
            
            <Button
                variant="outlined"
                startIcon={<SkipNextIcon />}
                onClick={handleNextDrive}
                disabled={!isInteractive && isPlaybackComplete}
            >
                Next Drive
            </Button>
            
            <Button
                variant="contained"
                color="secondary"
                startIcon={<FastForwardIcon />}
                onClick={handleSimToEnd}
                disabled={isGameComplete}
            >
                Sim to End
            </Button>
        </Box>
    );
};

export default GameControls;
