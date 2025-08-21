import { AppBar, Toolbar, Button, Stack, Typography, Box, Menu, MenuItem, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import { useState } from 'react';
import { Conference, Team, Info } from '../interfaces';
import { TeamLogo } from './TeamComponents';
import SeasonBanner from './SeasonBanner';
import NonSeasonBanner from './NonSeasonBanner';
import { STAGES } from '../constants/stages';
import { apiService } from '../services/api';

interface NavbarProps {
    team: Team;
    currentStage: string;
    info: Info & { lastWeek: number };
    conferences: Conference[];
}

const Navbar = ({ team, currentStage, info, conferences }: NavbarProps) => {
    const navigate = useNavigate();
    const currentStageInfo = STAGES.find(stage => stage.id === currentStage);
    const nextStageInfo = STAGES.find(stage => stage.id === currentStageInfo?.next);
    const [menuAnchors, setMenuAnchors] = useState<Record<string, HTMLElement | null>>({});

    // Menu handling functions
    const handleMenuOpen = (menu: string) => (event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchors({ ...menuAnchors, [menu]: event.currentTarget });
    };

    const handleMenuClose = (menu: string) => () => {
        setMenuAnchors({ ...menuAnchors, [menu]: null });
    };

    const handleMenuClick = (path: string, menu: string) => () => {
        navigate(path);
        handleMenuClose(menu)();
    };

    // API-based navigation
    const navigateWithApi = (path: string, apiCall: () => Promise<any>) => () => {
        apiCall()
            .then(() => navigate(path))
            .catch(err => console.error(`Error navigating to ${path}:`, err));
    };

    // Dropdown menu configurations
    const dropdownMenus = [
        {
            id: 'team',
            label: 'TEAM',
            items: [
                { label: 'Schedule', path: `/${team.name}/schedule` },
                { label: 'Roster', path: `/${team.name}/roster` },
                { label: 'History', path: `/${team.name}/history` }
            ]
        },
        {
            id: 'conferences',
            label: 'CONFERENCE STANDINGS',
            items: [
                ...conferences.map(conf => {
                    const confName = Object.keys(conf)[0];
                    return {
                        label: confName,
                        path: `/standings/${confName}`
                    };
                }),
                { label: 'Independent', path: '/standings/independent' }
            ]
        },
        {
            id: 'stats',
            label: 'STATS',
            items: [
                { label: 'Team', path: '/stats/team' },
                { label: 'Individual', path: '/stats/individual' },
                { label: 'Ratings', path: '/stats/ratings' }
            ]
        },
        {
            id: 'schedule',
            label: 'SCHEDULE',
            items: Array.from({ length: info.lastWeek }, (_, i) => ({
                label: `Week ${i + 1}`,
                path: `/schedule/${i + 1}`
            }))
        }
    ];

    return (
        <AppBar 
            position="static" 
            color="default" 
            elevation={2}
            sx={{ 
                mb: 3,
                backgroundColor: 'white',
                borderBottom: '1px solid',
                borderColor: 'divider'
            }}
        >
            <Toolbar sx={{ py: 1, minHeight: '64px !important' }}>
                {/* Left Section - Team Logo */}
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
                    <TeamLogo name={team.name} size={40} />
                </Box>

                {/* Center Section - Navigation */}
                <Stack direction="row" spacing={0} sx={{ flex: 1 }}>
                    {currentStage === 'season' && (
                        <Button 
                            color="inherit" 
                            onClick={navigateWithApi('/dashboard', apiService.getDashboard)}
                            sx={{
                                px: 2,
                                py: 1,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                color: 'text.primary',
                                '&:hover': {
                                    backgroundColor: 'rgba(25, 118, 210, 0.04)'
                                }
                            }}
                        >
                            DASHBOARD
                        </Button>
                    )}

                    {dropdownMenus.map(menu => (
                        <div key={menu.id}>
                            <Button 
                                color="inherit" 
                                onClick={handleMenuOpen(menu.id)}
                                sx={{
                                    px: 2,
                                    py: 1,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    color: 'text.primary',
                                    '&:hover': {
                                        backgroundColor: 'rgba(25, 118, 210, 0.04)'
                                    }
                                }}
                            >
                                {menu.label}
                            </Button>
                            <Menu
                                anchorEl={menuAnchors[menu.id]}
                                open={Boolean(menuAnchors[menu.id])}
                                onClose={handleMenuClose(menu.id)}
                                PaperProps={{
                                    elevation: 3,
                                    sx: {
                                        mt: 1,
                                        borderRadius: 2,
                                        minWidth: 160
                                    }
                                }}
                            >
                                {menu.items.map((item, index) => (
                                    <MenuItem
                                        key={`${menu.id}-${index}`}
                                        onClick={handleMenuClick(item.path, menu.id)}
                                        sx={{
                                            py: 1.5,
                                            px: 2,
                                            fontSize: '0.95rem',
                                            '&:hover': {
                                                backgroundColor: 'rgba(25, 118, 210, 0.04)'
                                            }
                                        }}
                                    >
                                        {item.label}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </div>
                    ))}

                    <Button 
                        color="inherit" 
                        onClick={navigateWithApi('/rankings', apiService.getRankings)}
                        sx={{
                            px: 2,
                            py: 1,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: 'text.primary',
                            '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.04)'
                            }
                        }}
                    >
                        RANKINGS
                    </Button>
                    
                    <Button 
                        color="inherit" 
                        onClick={navigateWithApi('/playoff', apiService.getPlayoff)}
                        sx={{
                            px: 2,
                            py: 1,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: 'text.primary',
                            '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.04)'
                            }
                        }}
                    >
                        PLAYOFF
                    </Button>
                </Stack>

                {/* Right Section - Season Info and Home */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {/* Season Info Card */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        border: '1px solid rgba(0, 0, 0, 0.08)'
                    }}>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                fontWeight: 600,
                                color: 'text.primary',
                                fontSize: '1rem'
                            }}
                        >
                            {info.currentYear}
                        </Typography>

                        <Divider orientation="vertical" flexItem sx={{ height: 20 }} />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    fontWeight: 500,
                                    color: 'text.secondary',
                                    fontSize: '0.8rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}
                            >
                                {currentStageInfo?.banner_label}
                            </Typography>
                            
                            {/* Banner */}
                            {currentStageInfo && (
                                currentStageInfo.season ? (
                                    <SeasonBanner info={info} />
                                ) : (
                                    nextStageInfo && (
                                        <NonSeasonBanner currentStage={currentStageInfo} nextStage={nextStageInfo} />
                                    )
                                )
                            )}
                        </Box>
                    </Box>

                    {/* Home Button */}
                    <Button 
                        color="inherit" 
                        onClick={navigateWithApi('/', () => apiService.getHome())}
                        startIcon={<HomeIcon />}
                        sx={{
                            px: 2,
                            py: 1,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: 'text.primary',
                            borderRadius: 2,
                            '&:hover': {
                                backgroundColor: 'rgba(25, 118, 210, 0.04)'
                            }
                        }}
                    >
                        HOME
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;