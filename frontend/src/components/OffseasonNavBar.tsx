import { AppBar, Toolbar, Button, Stack, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';

interface OffseasonNavBarProps {
    team: {
        id: number;
        name: string;
    };
    currentStage: string;
}

const OFFSEASON_STAGES = [
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
        label: 'Start Season',
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

const OffseasonNavBar = ({ team, currentStage }: OffseasonNavBarProps) => {
    const navigate = useNavigate();
    const currentStageInfo = OFFSEASON_STAGES.find(stage => stage.id === currentStage);
    const nextStagePath = OFFSEASON_STAGES.find(stage => stage.id === currentStageInfo?.next)?.path;

    return (
        <AppBar position="static" color="default" sx={{ mb: 3 }}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
                {/* Team Info */}
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width: 40, height: 40 }}>
                        <img
                            src={`/assets/logos/teams/${team.name}.png`}
                            alt={`${team.name} logo`}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    </Box>
                    <Typography variant="h6">{team.name}</Typography>
                </Stack>

                {/* Year Offseason Text */}
                {currentStageInfo?.offseason && (
                    <Typography variant="h6">
                        2024 Offseason
                    </Typography>
                )}

                {/* Advance Button */}
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>
                        Next Stage: {OFFSEASON_STAGES.find(stage => stage.id === currentStageInfo?.next)?.label}
                    </Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => navigate(nextStagePath || '/')}
                    >
                        Advance
                    </Button>
                </Stack>

                {/* Home Button */}
                <Button
                    color="inherit"
                    onClick={() => navigate('/')}
                    startIcon={<HomeIcon />}
                >
                    Home
                </Button>
            </Toolbar>
        </AppBar>
    );
};

export default OffseasonNavBar;