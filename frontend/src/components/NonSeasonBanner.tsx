import { Stack, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import LoadingDialog from './LoadingDialog';

interface NonSeasonBannerProps {
    currentStage: {
        id: string;
        label: string;
        path: string;
        next: string;
        season: boolean;
    };
    nextStage: {
        id: string;
        label: string;
        path: string;
        next: string;
        season: boolean;
    };
}

const NonSeasonBanner = ({ currentStage, nextStage }: NonSeasonBannerProps) => {
    const navigate = useNavigate();
    const [isSimulating, setIsSimulating] = useState(false);

    const handleStageChange = (path: string) => {
        setIsSimulating(true);
        // Add small delay to show loading state
        setTimeout(() => {
            navigate(path);
            setIsSimulating(false);
        }, 500);
    };


    return (
        <>
            <Stack direction="row" spacing={1} alignItems="center">
                <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={() => handleStageChange(currentStage.path)}
                    sx={{
                        px: 1.5,
                        py: 0.3,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 1.5,
                        minWidth: 'auto',
                        position: 'relative'
                    }}
                >
                    {currentStage.label}
                </Button>

                <Typography 
                    variant="caption" 
                    sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        mx: 0.5
                    }}
                >
                    →
                </Typography>

                <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => handleStageChange(nextStage.path)}
                    sx={{
                        px: 1.5,
                        py: 0.3,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 1.5,
                        minWidth: 'auto',
                        borderWidth: '1px',
                        '&:hover': {
                            backgroundColor: 'rgba(25, 118, 210, 0.04)',
                            borderWidth: '1px'
                        }
                    }}
                >
                    {nextStage.label}
                </Button>
            </Stack>
            <LoadingDialog 
                open={isSimulating} 
                message={`Simulating to ${nextStage.label}`}
            />
        </>
    );
};

export default NonSeasonBanner;
