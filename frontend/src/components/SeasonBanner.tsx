import { Stack, Typography, Button, Menu, MenuItem } from '@mui/material';
import { Info } from '../interfaces';
import { ROUTES } from '../services/api';
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
            navigate(ROUTES.SEASON_SUMMARY);
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
                <Typography 
                    variant="body2" 
                    sx={{ 
                        fontWeight: 500,
                        color: 'text.secondary',
                        fontSize: '0.85rem'
                    }}
                >
                    {isEndOfSeason ? 'End of Season' : `Week ${info.currentWeek}`}
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    size="small"
                    onClick={handleClick}
                    aria-controls="week-menu"
                    aria-haspopup="true"
                    sx={{
                        px: 2,
                        py: 0.5,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 2,
                        minWidth: 'auto'
                    }}
                >
                    {isEndOfSeason ? 'Season Summary' : 'Advance'}
                </Button>
                <Menu
                    id="week-menu"
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                    PaperProps={{
                        elevation: 3,
                        sx: {
                            mt: 1,
                            borderRadius: 2,
                            minWidth: 180
                        }
                    }}
                >
                    {availableWeeks.map((week) => (
                        <MenuItem 
                            key={week} 
                            onClick={() => handleAdvance(week)}
                            sx={{
                                py: 1,
                                px: 2,
                                fontSize: '0.9rem',
                                '&:hover': {
                                    backgroundColor: 'rgba(25, 118, 210, 0.04)'
                                }
                            }}
                        >
                            Simulate to Week {week}
                        </MenuItem>
                    ))}
                    {/* Add End of Season option */}
                    <MenuItem 
                        onClick={() => handleAdvance(info.lastWeek + 1)}
                        sx={{ 
                            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                            py: 1,
                            px: 2,
                            fontSize: '0.9rem',
                            '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.04)'
                            }
                        }}
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
