import { AppBar, Toolbar, Button, Stack, Typography, Box, Menu, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import { useState } from 'react';
import { Conference, Team, Info } from '../interfaces';

interface NavbarProps {
    team: Pick<Team, 'id' | 'name'>;
    currentStage: string;
    info: Pick<Info, 'currentYear' | 'currentWeek'>;
    conferences: Conference[];
}

const STAGES = [
    {
        id: 'roster_progression',
        label: 'Roster Progression',
        path: '/roster_progression',
        next: 'noncon',
        offseason: true
    },
    {
        id: 'noncon',
        label: 'Non-Conference Scheduling',
        path: '/noncon',
        next: 'season',
        offseason: true
    },
    {
        id: 'season',
        label: 'Season',
        path: '/dashboard',
        next: 'summary',
        offseason: false
    },
    {
        id: 'summary',
        label: 'Season Summary',
        path: '/summary',
        next: 'roster_progression',
        offseason: false
    }
] as const;

const Navbar = ({ team, currentStage, info, conferences }: NavbarProps) => {
    const navigate = useNavigate();
    const currentStageInfo = STAGES.find(stage => stage.id === currentStage);
    const nextStagePath = STAGES.find(stage => stage.id === currentStageInfo?.next)?.path;
    
    // Add state for dropdown menus
    const [teamAnchorEl, setTeamAnchorEl] = useState<null | HTMLElement>(null);
    const [confAnchorEl, setConfAnchorEl] = useState<null | HTMLElement>(null);
    const [statsAnchorEl, setStatsAnchorEl] = useState<null | HTMLElement>(null);
    const [scheduleAnchorEl, setScheduleAnchorEl] = useState<null | HTMLElement>(null);

    const handleAdvance = () => {
        if (nextStagePath) {
            navigate(nextStagePath);
        }
    };

    return (
        <AppBar position="static" color="default" sx={{ mb: 3 }}>
            <Toolbar>
                {/* Team Logo and Name */}
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width: 40, height: 40 }}>
                        <img
                            src={`/logos/teams/${info.team.name}.png`}
                            alt={`${info.team.name} logo`}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    </Box>
                </Stack>

                {/* Navigation Links */}
                <Stack direction="row" spacing={2} sx={{ ml: 2 }}>
                    {currentStage === 'season' && (
                        <Button color="inherit" onClick={() => navigate('/dashboard')}>
                            Dashboard
                        </Button>
                    )}

                    {/* Team Dropdown */}
                    <Button 
                        color="inherit"
                        onClick={(e) => setTeamAnchorEl(e.currentTarget)}
                    >
                        Team
                    </Button>
                    <Menu
                        anchorEl={teamAnchorEl}
                        open={Boolean(teamAnchorEl)}
                        onClose={() => setTeamAnchorEl(null)}
                    >
                        <MenuItem onClick={() => { navigate(`/${team.name}/schedule`); setTeamAnchorEl(null); }}>
                            Schedule
                        </MenuItem>
                        <MenuItem onClick={() => { navigate(`/${team.name}/roster`); setTeamAnchorEl(null); }}>
                            Roster
                        </MenuItem>
                        <MenuItem onClick={() => { navigate(`/${team.name}/history`); setTeamAnchorEl(null); }}>
                            History
                        </MenuItem>
                    </Menu>

                    {/* Conference Standings Dropdown */}
                    <Button 
                        color="inherit"
                        onClick={(e) => setConfAnchorEl(e.currentTarget)}
                    >
                        Conference Standings
                    </Button>
                    <Menu
                        anchorEl={confAnchorEl}
                        open={Boolean(confAnchorEl)}
                        onClose={() => setConfAnchorEl(null)}
                    >
                        {conferences.map((conf) => (
                            <MenuItem 
                                key={`conf-${conf.id}`}
                                onClick={() => {
                                    navigate(`/standings/${conf.confName}`);
                                    setConfAnchorEl(null);
                                }}
                            >
                                {conf.confName}
                            </MenuItem>
                        ))}
                        <MenuItem 
                            key="conf-independent"
                            onClick={() => {
                                navigate('/standings/independent');
                                setConfAnchorEl(null);
                            }}
                        >
                            Independent
                        </MenuItem>
                    </Menu>

                    {/* Stats Dropdown */}
                    <Button 
                        color="inherit"
                        onClick={(e) => setStatsAnchorEl(e.currentTarget)}
                    >
                        Stats
                    </Button>
                    <Menu
                        anchorEl={statsAnchorEl}
                        open={Boolean(statsAnchorEl)}
                        onClose={() => setStatsAnchorEl(null)}
                    >
                        <MenuItem onClick={() => { navigate('/stats/team'); setStatsAnchorEl(null); }}>
                            Team
                        </MenuItem>
                        <MenuItem onClick={() => { navigate('/stats/individual'); setStatsAnchorEl(null); }}>
                            Individual
                        </MenuItem>
                    </Menu>

                    {/* Rankings Link */}
                    <Button 
                        color="inherit"
                        onClick={() => navigate('/rankings')}
                    >
                        Rankings
                    </Button>

                    {/* Schedule Dropdown */}
                    <Button 
                        color="inherit"
                        onClick={(e) => setScheduleAnchorEl(e.currentTarget)}
                    >
                        Schedule
                    </Button>
                    <Menu
                        anchorEl={scheduleAnchorEl}
                        open={Boolean(scheduleAnchorEl)}
                        onClose={() => setScheduleAnchorEl(null)}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(week => (
                            <MenuItem 
                                key={week}
                                onClick={() => { 
                                    navigate(`/schedule/${week}`);
                                    setScheduleAnchorEl(null);
                                }}
                            >
                                Week {week}
                            </MenuItem>
                        ))}
                    </Menu>

                    {/* Playoff Link */}
                    <Button 
                        color="inherit"
                        onClick={() => navigate('/playoff')}
                    >
                        Playoff
                    </Button>
                </Stack>

                {/* Year/Stage Info and Advance Button - Keep existing code */}
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6">
                        {currentStageInfo?.offseason ? `${info.currentYear} Offseason` : `${info.currentYear} Season`}
                    </Typography>
                    
                    <Stack direction="row" spacing={1} alignItems="center">
                        {currentStageInfo?.id === 'season' ? (
                            <Typography>Week {info.currentWeek}</Typography>
                        ) : !(currentStageInfo?.offseason && STAGES.find(stage => stage.id === currentStageInfo?.next)?.offseason) && (
                            <Typography>
                                Advance to: {STAGES.find(stage => stage.id === currentStageInfo?.next)?.label}
                            </Typography>
                        )}
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleAdvance}
                        >
                            Advance
                        </Button>
                    </Stack>

                    <Button
                        color="inherit"
                        onClick={() => navigate('/')}
                        startIcon={<HomeIcon />}
                    >
                        Home
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;