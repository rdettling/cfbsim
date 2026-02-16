import { Box, Button, Typography } from '@mui/material';
import type { ReactNode } from 'react';
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
    let decisionSection: ReactNode = null;
    if (decisionPrompt && handleDecision) {
        const { type, down, yards_left, field_position } = decisionPrompt;

        if (type === 'run_pass') {
            const location = field_position <= 50 ? 'OWN' : 'OPP';
            const yardLine = field_position <= 50 ? field_position : 100 - field_position;

            decisionSection = (
                <Box sx={{ 
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    p: 2.5,
                    background: 'linear-gradient(135deg, rgba(17,24,39,0.92) 0%, rgba(30,64,175,0.9) 55%, rgba(59,130,246,0.9) 100%)',
                    color: 'white'
                }}>
                    <Typography variant="h6" fontWeight={700} textAlign="center" sx={{ mb: 2, fontFamily: '"Space Grotesk", sans-serif' }}>
                        {down}st & {yards_left} at {location} {yardLine}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<DirectionsRunIcon />}
                            onClick={() => handleDecision('run')}
                            disabled={submittingDecision}
                            sx={{ minWidth: 120, borderRadius: 2, fontWeight: 700 }}
                        >
                            RUN
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<SportsSoccerIcon />}
                            onClick={() => handleDecision('pass')}
                            disabled={submittingDecision}
                            sx={{ minWidth: 120, borderRadius: 2, fontWeight: 700 }}
                        >
                            PASS
                        </Button>
                    </Box>
                </Box>
            );
        }

        if (type === 'fourth_down') {
            const location = field_position <= 50 ? 'OWN' : 'OPP';
            const yardLine = field_position <= 50 ? field_position : 100 - field_position;

            decisionSection = (
                <Box sx={{ 
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    p: 2.5,
                    background: 'linear-gradient(135deg, rgba(120,53,15,0.92) 0%, rgba(217,119,6,0.9) 60%, rgba(245,158,11,0.9) 100%)',
                    color: 'white'
                }}>
                    <Typography variant="h6" fontWeight={700} textAlign="center" sx={{ mb: 2, fontFamily: '"Space Grotesk", sans-serif' }}>
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
                            sx={{ borderRadius: 2, fontWeight: 700 }}
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
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            PASS
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => handleDecision('punt')}
                            disabled={submittingDecision}
                            size="small"
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            PUNT
                        </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => handleDecision('field_goal')}
                            disabled={submittingDecision}
                            size="small"
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                            FG
                        </Button>
                    </Box>
                </Box>
            );
        }
    }

    if (isInteractive) {
        return (
            <Box>
                {decisionSection}
                <Box sx={{ 
                    borderTop: decisionSection ? 'none' : '1px solid',
                    borderColor: 'divider',
                    p: 2,
                    display: 'flex',
                    gap: 2,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(245,247,255,0.95) 100%)'
                }}>
                    <Button
                        variant="outlined"
                        startIcon={<SkipNextIcon />}
                        onClick={handleNextPlay}
                        disabled={isGameComplete || submittingDecision}
                        sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                        Sim Play
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<SkipNextIcon />}
                        onClick={handleNextDrive}
                        disabled={isGameComplete || submittingDecision}
                        sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                        Sim Drive
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<FastForwardIcon />}
                        onClick={handleSimToEnd}
                        disabled={isGameComplete || submittingDecision}
                        sx={{ borderRadius: 2, fontWeight: 700 }}
                    >
                        Sim to End of Game
                    </Button>
                </Box>
            </Box>
        );
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
