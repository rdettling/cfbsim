import { AppBar, Toolbar, Button, Stack, Typography, Box, Menu, MenuItem, Divider, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import { useState } from 'react';
import { Conference, Team, Info } from '../interfaces';
import { TeamLogo } from './TeamComponents';
import SeasonBanner from './SeasonBanner';
import NonSeasonBanner from './NonSeasonBanner';
import { STAGES } from '../constants/stages';
import { apiService } from '../services/api';
import GameSelectionModal from './GameSelectionModal';
import LiveSimModal from './LiveSimModal';

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
    const [gameSelectionOpen, setGameSelectionOpen] = useState(false);
    const [liveSimOpen, setLiveSimOpen] = useState(false);
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

    // Team colors with fallbacks
    const primaryColor = info.colorPrimary || team.colorPrimary || '#1976d2';
    const secondaryColor = info.colorSecondary || team.colorSecondary || '#ffffff';

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

    // Live sim handlers
    const handleLiveSimClick = () => {
        setGameSelectionOpen(true);
    };

    const handleGameSelect = (gameId: number) => {
        setSelectedGameId(gameId);
        setLiveSimOpen(true);
    };

    const handleLiveSimClose = () => {
        setLiveSimOpen(false);
        setSelectedGameId(null);
        // Refresh the page to show updated data
        window.location.reload();
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
                borderTop: `3px solid ${primaryColor}`,
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
                                    backgroundColor: `${primaryColor}15`
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
                                        backgroundColor: `${primaryColor}15`
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
                                                backgroundColor: `${primaryColor}15`
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
                                backgroundColor: `${primaryColor}15`
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
                                backgroundColor: `${primaryColor}15`
                            }
                        }}
                    >
                        PLAYOFF
                    </Button>
                </Stack>

                {/* Live Sim Modals */}
                <GameSelectionModal
                    open={gameSelectionOpen}
                    onClose={() => setGameSelectionOpen(false)}
                    onGameSelect={handleGameSelect}
                />
                <LiveSimModal
                    open={liveSimOpen}
                    onClose={handleLiveSimClose}
                    gameId={selectedGameId}
                />

                {/* Right Section - Redesigned */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Season Info - Compact Display */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5,
                        px: 2,
                        py: 0.75,
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        borderRadius: 2,
                        border: `1px solid ${primaryColor}20`,
                        borderLeft: `3px solid ${primaryColor}`
                    }}>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                fontWeight: 700,
                                color: 'text.primary',
                                fontSize: '1.1rem',
                                lineHeight: 1
                            }}
                        >
                            {info.currentYear}
                        </Typography>
                        <Divider orientation="vertical" flexItem sx={{ height: 24, mx: 0.5 }} />
                        <Chip 
                            label={currentStageInfo?.banner_label || ''}
                            size="small"
                            sx={{
                                height: 24,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                backgroundColor: `${primaryColor}1A`,
                                color: primaryColor
                            }}
                        />
                    </Box>

                    {/* Simulation Controls - Grouped (Week/Advance + Live Sim) */}
                    {currentStage === 'season' && (
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            backgroundColor: `${primaryColor}0A`,
                            borderRadius: 2,
                            border: `1px solid ${primaryColor}26`
                        }}>
                            <SeasonBanner info={info} primaryColor={primaryColor} secondaryColor={secondaryColor} />
                            <Divider orientation="vertical" flexItem sx={{ height: 24, mx: 0.5 }} />
                            <Button 
                                variant="contained"
                                onClick={handleLiveSimClick}
                                size="small"
                                sx={{
                                    px: 2,
                                    py: 0.5,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    borderRadius: 1.5,
                                    boxShadow: 'none',
                                    backgroundColor: primaryColor,
                                    color: secondaryColor,
                                    '&:hover': {
                                        boxShadow: 'none',
                                        backgroundColor: primaryColor,
                                        opacity: 0.9
                                    }
                                }}
                            >
                                Live Sim
                            </Button>
                        </Box>
                    )}

                    {/* Non-season stage info */}
                    {currentStage !== 'season' && currentStageInfo && nextStageInfo && (
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            backgroundColor: 'rgba(0, 0, 0, 0.02)',
                            borderRadius: 2,
                            border: '1px solid rgba(0, 0, 0, 0.08)'
                        }}>
                            <NonSeasonBanner 
                                currentStage={currentStageInfo} 
                                nextStage={nextStageInfo}
                                primaryColor={primaryColor}
                                secondaryColor={secondaryColor}
                            />
                        </Box>
                    )}

                    {/* Settings Button - Icon Only */}
                    <Button 
                        color="inherit" 
                        onClick={() => navigate('/settings')}
                        sx={{
                            minWidth: 'auto',
                            width: 40,
                            height: 40,
                            p: 0,
                            borderRadius: 2,
                            color: 'text.secondary',
                            '&:hover': {
                                backgroundColor: `${primaryColor}15`,
                                color: primaryColor
                            }
                        }}
                        aria-label="Settings"
                    >
                        <SettingsIcon />
                    </Button>

                    {/* Home Button - Icon Only */}
                    <Button 
                        color="inherit" 
                        onClick={navigateWithApi('/', () => apiService.getHome())}
                        sx={{
                            minWidth: 'auto',
                            width: 40,
                            height: 40,
                            p: 0,
                            borderRadius: 2,
                            color: 'text.secondary',
                            '&:hover': {
                                backgroundColor: `${primaryColor}15`,
                                color: primaryColor
                            }
                        }}
                        aria-label="Home"
                    >
                        <HomeIcon />
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;