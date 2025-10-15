import { useState } from 'react';
import { apiService } from '../services/api';
import { Team, Info, ScheduleGame, Conference } from '../interfaces';
import { TeamInfoModal, ConfLogo, TeamLogo } from '../components/TeamComponents';
import {
    Typography, Card, CardContent, Table,
    TableBody, TableCell, TableContainer, TableHead, Chip,
    TableRow, Paper, Box, Link as MuiLink, Button, Grid
} from '@mui/material';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface DashboardData {
    info: Info;
    prev_game: ScheduleGame | null;
    curr_game: ScheduleGame | null;
    team: Team;
    confTeams: Team[];
    top_10: Team[];
    conferences: Conference[];
}

// Types for component props
interface GameCardProps {
    game: ScheduleGame;
    type: 'prev' | 'curr';
    onTeamClick: (name: string) => void;
}

interface TeamRowProps {
    team: Team;
    showRating?: boolean;
    rank?: number;
    highlight?: boolean;
    onTeamClick: (name: string) => void;
}

// Game card with clickable team name
const GameCard = ({ game, type, onTeamClick }: GameCardProps) => (
    <Card elevation={3} sx={{ 
        mb: 2, 
        borderLeft: type === 'prev' ? 
            `5px solid ${game.result?.includes('W') ? 'green' : game.result?.includes('L') ? 'red' : 'grey'}` : 
            '5px solid #1976d2', 
        '&:hover': { transform: 'translateY(-3px)' },
        transition: 'transform 0.2s',
    }}>
        <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                {type === 'prev' ? 'Last Week' : 'This Week'}
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TeamLogo name={game.opponent.name} size={40} />
                    <Box>
                        <MuiLink
                            component="button"
                            onClick={() => onTeamClick(game.opponent.name)}
                            sx={{ cursor: 'pointer', textDecoration: 'none', fontWeight: 'bold' }}
                        >
                            {game.opponent.ranking > 0 ? `#${game.opponent.ranking} ` : ''}{game.opponent.name}
                        </MuiLink>
                        <Typography variant="body2" color="text.secondary">
                            {game.opponent.record}
                        </Typography>
                    </Box>
                </Box>
                
                {type === 'prev' && (
                    <Chip 
                        label={game.result} 
                        color={game.result?.includes('W') ? 'success' : 'error'} 
                        size="medium"
                        sx={{ fontWeight: 'bold' }}
                    />
                )}
            </Box>
            
            {type === 'prev' && (
                <Box sx={{ textAlign: 'center', mb: 1 }}>
                    <Typography variant="h5" fontWeight="bold">{game.score}</Typography>
                </Box>
            )}
            
            {type === 'curr' && (
                <Box sx={{ mb: 2, p: 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Spread: <strong>{game.spread}</strong></Typography>
                        <Typography variant="body2">Moneyline: <strong>{game.moneyline}</strong></Typography>
                    </Box>
                </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <MuiLink href={`/game/${game.id}`} sx={{ textDecoration: 'none' }}>
                    <Button size="small" variant="outlined">
                        {type === 'prev' ? 'Game Summary' : 'Game Preview'}
                    </Button>
                </MuiLink>
            </Box>
        </CardContent>
    </Card>
);

// Team row with clickable team name
const TeamRow = ({ team, showRating = false, rank, highlight = false, onTeamClick }: TeamRowProps) => (
    <TableRow 
        sx={{
            bgcolor: highlight ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
        }}
    >
        {rank !== undefined && <TableCell sx={{ fontWeight: 'bold', width: '40px' }}>{rank}</TableCell>}
        <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamLogo name={team.name} size={30} />
                <MuiLink
                    component="button"
                    onClick={() => onTeamClick(team.name)}
                    sx={{ cursor: 'pointer', textDecoration: 'none', fontWeight: team.ranking <= 25 ? 'bold' : 'normal' }}
                >
                    {team.ranking <= 25 && `#${team.ranking} `}{team.name}
                </MuiLink>
            </Box>
        </TableCell>
        {showRating && <TableCell align="center">{team.rating}</TableCell>}
        {showRating ? (
            <>
                <TableCell align="center">{team.confWins}-{team.confLosses}</TableCell>
                <TableCell align="center">{team.totalWins}-{team.totalLosses}</TableCell>
            </>
        ) : (
            <TableCell align="center">{team.totalWins}-{team.totalLosses}</TableCell>
        )}
    </TableRow>
);

const Dashboard = () => {
    // Modal state for team info
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => apiService.getDashboard<DashboardData>(),
        autoRefreshOnGameChange: true
    });

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const confName = data?.team.conference;

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences
            } : undefined}
            containerMaxWidth="lg"
        >
                {data && (
                    <>
                        {/* Team Header with Conference Logo */}
                        <Paper elevation={2} sx={{ mb: 4, p: 3, borderRadius: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={1}>
                                    <TeamLogo name={data.team.name} size={80} />
                                </Grid>
                                <Grid item xs={12} md={9}>
                                    <Typography variant="h3" fontWeight="bold" gutterBottom>
                                        {data.team.ranking > 0 && `#${data.team.ranking} `}{data.team.name} {data.team.mascot}
                                    </Typography>
                                    <Typography variant="h6">
                                        Record: <strong>{data.team.record}</strong>
                                    
                                        &nbsp;&nbsp;•&nbsp;&nbsp;Rating: <strong>{data.team.rating}</strong>
                                    </Typography>
                                </Grid>
                                {confName && (
                                    <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <ConfLogo name={confName} size={60} />
                                            <Typography variant="subtitle1" sx={{ mt: 1 }}>{confName}</Typography>
                                        </Box>
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>

                        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={3}>
                            {/* Game Cards Section */}
                            <Box>
                                <Typography variant="h5" sx={{ mb: 2, borderBottom: '2px solid', borderColor: 'primary.main', pb: 1 }}>
                                    Games
                                </Typography>
                                {data.prev_game?.opponent && <GameCard game={data.prev_game} type="prev" onTeamClick={handleTeamClick} />}
                                {data.curr_game?.opponent && <GameCard game={data.curr_game} type="curr" onTeamClick={handleTeamClick} />}
                                {!data.prev_game?.opponent && !data.curr_game?.opponent && (
                                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                                        <Typography variant="body2" color="info.dark">No recent or upcoming games available</Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* Conference Standings Section */}
                            <TableContainer component={Paper} elevation={3}>
                                <Box sx={{ bgcolor: data.team.colorPrimary || 'primary.main', color: 'white', p: 2 }}>
                                    <Typography variant="h5" align="center">
                                        {confName ? `${confName} Standings` : 'Independent Teams'}
                                    </Typography>
                                </Box>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
                                            <TableCell>Team</TableCell>
                                            <TableCell align="center">Rating</TableCell>
                                            <TableCell align="center">Conf</TableCell>
                                            <TableCell align="center">Overall</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.confTeams.map(team => (
                                            <TeamRow 
                                                key={team.name} 
                                                team={team} 
                                                showRating 
                                                highlight={team.name === data.team.name}
                                                onTeamClick={handleTeamClick} 
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* AP Top 10 Section */}
                            <TableContainer component={Paper} elevation={3}>
                                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 2 }}>
                                    <Typography variant="h5" align="center">AP Top 10</Typography>
                                </Box>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
                                            <TableCell>Rank</TableCell>
                                            <TableCell>Team</TableCell>
                                            <TableCell align="center">Record</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.top_10.map((team, index) => (
                                            <TeamRow 
                                                key={team.name} 
                                                team={team} 
                                                rank={index + 1} 
                                                highlight={team.name === data.team.name}
                                                onTeamClick={handleTeamClick} 
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </>
                )}
            
            <TeamInfoModal 
                teamName={selectedTeam} 
                open={modalOpen} 
                onClose={() => setModalOpen(false)} 
            />
        </PageLayout>
    );
};

export default Dashboard;
