import { Stack, Typography, Button, Menu, MenuItem } from '@mui/material';
import { Info } from '../interfaces';
import { useState } from 'react';
import LoadingDialog from './LoadingDialog';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface SeasonBannerProps {
    info: Info & { lastWeek: number };
}

const SeasonBanner = ({ info }: SeasonBannerProps) => {
    const navigate = useNavigate();
    const [isSimulating, setIsSimulating] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isEndOfSeason = info.currentWeek > info.lastWeek;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!isEndOfSeason) {
            setAnchorEl(event.currentTarget);
        } else {
            handleEndOfSeason();
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleEndOfSeason = () => {
        setIsSimulating(true);
        setTimeout(() => {
            navigate('/summary');
            setIsSimulating(false);
        }, 500);
    };

    const handleAdvance = async (destWeek: number) => {
        setAnchorEl(null);
        setIsSimulating(true);
        try {
            await apiService.get(`/api/sim/${destWeek}/`);
            window.dispatchEvent(new Event('pageDataRefresh'));
        } catch (error) {
            console.error('Error simulating weeks:', error);
        } finally {
            setIsSimulating(false);
        }
    };

    // Generate array of available weeks to simulate to, starting from next week
    const availableWeeks = Array.from(
        { length: info.lastWeek - info.currentWeek },
        (_, i) => info.currentWeek + i + 1
    );

    return (
        <>
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography>
                    {isEndOfSeason ? 'End of Season' : `Week ${info.currentWeek}`}
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleClick}
                    aria-controls="week-menu"
                    aria-haspopup="true"
                >
                    {isEndOfSeason ? 'Season Summary' : 'Advance'}
                </Button>
                <Menu
                    id="week-menu"
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                >
                    {availableWeeks.map((week) => (
                        <MenuItem 
                            key={week} 
                            onClick={() => handleAdvance(week)}
                        >
                            Simulate to Week {week}
                        </MenuItem>
                    ))}
                    {/* Add End of Season option */}
                    <MenuItem 
                        onClick={() => handleAdvance(info.lastWeek + 1)}
                        sx={{ borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}
                    >
                        End of Season
                    </MenuItem>
                </Menu>
            </Stack>
            <LoadingDialog 
                open={isSimulating} 
                message={isEndOfSeason ? 'Loading Season Summary...' : 'Simulating games...'}
            />
        </>
    );
};

export default SeasonBanner;
