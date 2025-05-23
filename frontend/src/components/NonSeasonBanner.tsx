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
    const [isLoading, setIsLoading] = useState(false);

    const handleStageChange = (path: string) => {
        setIsLoading(true);
        // Add small delay to show loading state
        setTimeout(() => {
            navigate(path);
            setIsLoading(false);
        }, 500);
    };


    return (
        <>
            <Stack direction="row" spacing={4} alignItems="center">
                <Stack alignItems="center">
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleStageChange(currentStage.path)}
                    >
                        {currentStage.label}
                    </Button>
                    <Typography variant="caption">Current Stage</Typography>
                </Stack>

                <Stack alignItems="center">
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => handleStageChange(nextStage.path)}
                    >
                        {nextStage.label}
                    </Button>
                    <Typography variant="caption">Next Stage</Typography>
                </Stack>
            </Stack>
            <LoadingDialog 
                open={isLoading} 
                message={`Loading ${nextStage.label}...`}
            />
        </>
    );
};

export default NonSeasonBanner;
