import { Stack, Typography, Button, Menu, MenuItem } from '@mui/material';
import { ROUTES } from '../../constants/routes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingDialog from '../sim/LoadingDialog';
import { advanceWeeks } from '../../domain/sim';
import type { SeasonBannerProps } from '../../types/components';

const SeasonBanner = ({ info, primaryColor = '#1976d2', secondaryColor = '#ffffff' }: SeasonBannerProps) => {
    const navigate = useNavigate();
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationMessage, setSimulationMessage] = useState('');
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
        setSimulationMessage('Simulating to Season Summary');
        setIsSimulating(true);
        setTimeout(() => {
            navigate(ROUTES.SEASON_SUMMARY);
            setIsSimulating(false);
        }, 500);
    };

    const handleAdvance = async (destWeek: number) => {
        setAnchorEl(null);
        setSimulationMessage(`Simulating to Week ${destWeek}`);
        setIsSimulating(true);
        try {
            await advanceWeeks(destWeek);
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
                        minWidth: 'auto',
                        backgroundColor: primaryColor,
                        color: secondaryColor,
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: primaryColor,
                            opacity: 0.9,
                            boxShadow: 'none'
                        }
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
                                    backgroundColor: `${primaryColor}15`
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
                                backgroundColor: `${primaryColor}15`
                            }
                        }}
                    >
                        End of Season
                    </MenuItem>
                </Menu>
            </Stack>
            <LoadingDialog 
                open={isSimulating} 
                message={simulationMessage}
            />
        </>
    );
};

export default SeasonBanner;
