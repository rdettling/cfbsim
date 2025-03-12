import { AppBar, Toolbar, Button, Stack, Typography, Box, Menu, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import { useState } from 'react';
import { Conference, Team, Info } from '../interfaces';
import { TeamLogo } from './TeamComponents';
import SeasonBanner from './SeasonBanner';
import NonSeasonBanner from './NonSeasonBanner';
import { STAGES } from '../constants/stages'; // Adjust the path as necessary


interface NavbarProps {
    team: Team;
    currentStage: string;
    info: Info & { lastWeek: number };
    conferences: Conference[];
}

interface MenuState {
    [key: string]: HTMLElement | null;
}

const Navbar = ({ team, currentStage, info, conferences }: NavbarProps) => {
    const navigate = useNavigate();
    const currentStageInfo = STAGES.find(stage => stage.id === currentStage);
    const nextStageInfo = STAGES.find(stage => stage.id === currentStageInfo?.next);

    const [menuAnchors, setMenuAnchors] = useState<MenuState>({});

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

    const dropdownMenus = [
        {
            id: 'team',
            label: 'Team',
            items: [
                { label: 'Schedule', path: `/${team.name}/schedule` },
                { label: 'Roster', path: `/${team.name}/roster` },
                { label: 'History', path: `/${team.name}/history` }
            ]
        },
        {
            id: 'conferences',
            label: 'Conference Standings',
            items: [
                ...conferences.map(conf => ({
                    label: conf.confName,
                    path: `/standings/${conf.confName}`
                })),
                { label: 'Independent', path: '/standings/independent' }
            ]
        },
        {
            id: 'stats',
            label: 'Stats',
            items: [
                { label: 'Team', path: '/stats/team' },
                { label: 'Individual', path: '/stats/individual' }
            ]
        },
        {
            id: 'schedule',
            label: 'Schedule',
            items: Array.from({ length: info.lastWeek }, (_, i) => ({
                label: `Week ${i + 1}`,
                path: `/schedule/${i + 1}`
            }))
        }
    ];

    return (
        <AppBar position="static" color="default" sx={{ mb: 3 }}>
            <Toolbar>
                <TeamLogo name={info.team.name} size={40} />

                <Stack direction="row" spacing={2} sx={{ ml: 2 }}>
                    {currentStage === 'season' && (
                        <Button color="inherit" onClick={() => navigate('/dashboard')}>
                            Dashboard
                        </Button>
                    )}

                    {dropdownMenus.map(menu => (
                        <div key={menu.id}>
                            <Button color="inherit" onClick={handleMenuOpen(menu.id)}>
                                {menu.label}
                            </Button>
                            <Menu
                                anchorEl={menuAnchors[menu.id]}
                                open={Boolean(menuAnchors[menu.id])}
                                onClose={handleMenuClose(menu.id)}
                            >
                                {menu.items.map((item, index) => (
                                    <MenuItem
                                        key={`${menu.id}-${index}`}
                                        onClick={handleMenuClick(item.path, menu.id)}
                                    >
                                        {item.label}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </div>
                    ))}

                    <Button color="inherit" onClick={() => navigate('/rankings')}>
                        Rankings
                    </Button>
                    <Button color="inherit" onClick={() => navigate('/playoff')}>
                        Playoff
                    </Button>
                </Stack>

                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6">
                        {`${info.currentYear} ${currentStageInfo?.banner_label}`}
                    </Typography>

                    {currentStageInfo && (
                        currentStageInfo.season ? (
                            <SeasonBanner info={info} />
                        ) : (
                            nextStageInfo && (
                                <NonSeasonBanner currentStage={currentStageInfo} nextStage={nextStageInfo} />
                            )
                        )
                    )}

                    <Button color="inherit" onClick={() => navigate('/')} startIcon={<HomeIcon />}>
                        Home
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;