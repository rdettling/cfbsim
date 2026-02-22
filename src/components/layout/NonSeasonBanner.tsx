import { Box, Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import LoadingDialog from '../sim/LoadingDialog';
import type { NonSeasonBannerProps } from '../../types/components';

const NonSeasonBanner = ({ currentStage, nextStage, primaryColor = '#1976d2', secondaryColor = '#ffffff' }: NonSeasonBannerProps) => {
    const navigate = useNavigate();
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationMessage, setSimulationMessage] = useState('');

    const handleStageChange = (path: string, label: string) => {
        setSimulationMessage(`Simulating to ${label}`);
        setIsSimulating(true);
        setTimeout(() => {
            navigate(path);
            setIsSimulating(false);
        }, 500);
    };


    return (
        <>
            <Stack direction="row" spacing={0.9} alignItems="center">
                <Box
                    sx={{
                        px: 1.2,
                        py: 0.45,
                        borderRadius: 1.4,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper',
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {currentStage.label}
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleStageChange(nextStage.path, nextStage.label)}
                    sx={{
                        px: 1.6,
                        py: 0.45,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        borderRadius: 1.4,
                        minWidth: 'auto',
                        boxShadow: 'none',
                        backgroundColor: primaryColor,
                        color: secondaryColor,
                        '&:hover': {
                            backgroundColor: primaryColor,
                            opacity: 0.9,
                            boxShadow: 'none',
                        },
                    }}
                >
                    Next: {nextStage.label}
                </Button>

                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleStageChange(currentStage.path, currentStage.label)}
                    sx={{
                        px: 1.4,
                        py: 0.45,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 1.4,
                        minWidth: 'auto',
                        borderColor: primaryColor,
                        color: primaryColor,
                        '&:hover': {
                            backgroundColor: `${primaryColor}12`,
                            borderColor: primaryColor,
                        },
                    }}
                >
                    Open {currentStage.label}
                </Button>
            </Stack>
            <LoadingDialog 
                open={isSimulating} 
                message={simulationMessage}
            />
        </>
    );
};

export default NonSeasonBanner;
