import { Stack, Typography, Button } from '@mui/material';
import { Info } from '../interfaces';
import axios from 'axios';
import { useState } from 'react';
import { API_BASE_URL } from '../config';
import LoadingDialog from './LoadingDialog';
import { useNavigate } from 'react-router-dom';

interface SeasonBannerProps {
    info: Info & { lastWeek: number };
}

const SeasonBanner = ({ info }: SeasonBannerProps) => {
    const navigate = useNavigate();
    const [isSimulating, setIsSimulating] = useState(false);
    const isEndOfSeason = info.currentWeek > info.lastWeek;

    const handleAdvance = async () => {
        if (isEndOfSeason) {
            setIsSimulating(true);
            setTimeout(() => {
                navigate('/summary');
                setIsSimulating(false);
            }, 500);
        } else {
            setIsSimulating(true);
            try {
                await axios.get(`${API_BASE_URL}/api/sim`);
                window.dispatchEvent(new Event('pageDataRefresh'));
            } catch (error) {
                console.error('Error simulating week:', error);
            } finally {
                setIsSimulating(false);
            }
        }
    };

    return (
        <>
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography>
                    {isEndOfSeason ? 'End of Season' : `Week ${info.currentWeek}`}
                </Typography>
                <Button variant="contained" color="primary" onClick={handleAdvance}>
                    {isEndOfSeason ? 'Season Summary' : 'Advance'}
                </Button>
            </Stack>
            <LoadingDialog 
                open={isSimulating} 
                message={isEndOfSeason ? 'Loading Season Summary...' : `Simulating Week ${info.currentWeek}...`}
            />
        </>
    );
};

export default SeasonBanner;
