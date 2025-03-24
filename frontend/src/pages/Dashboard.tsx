import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, ScheduleGame, Conference } from '../interfaces';
import { TeamLogo, TeamInfoModal, ConfLogo } from '../components/TeamComponents';
import {
    Container, Typography, Card, CardContent, Table,
    TableBody, TableCell, TableContainer, TableHead, Chip,
    TableRow, Paper, Box, CircularProgress, Alert,
    Link as MuiLink, Button, Grid
} from '@mui/material';
import Navbar from '../components/Navbar';

interface DashboardData {
    info: Info;
    prev_game: ScheduleGame | null;
    curr_game: ScheduleGame | null;
    team: Team;
    confTeams: Team[];
    top_10: Team[];
    conferences: Conference[];
}

const GameCard = ({ game, type, onTeamClick }: { game: ScheduleGame, type: 'prev' | 'curr', onTeamClick: (name: string) => void }) => (
    <Card elevation={3} sx={{ 
        mb: 2, 
        borderLeft: type === 'prev' ? 
            `5px solid ${game.result?.includes('W') ? 'green' : game.result?.includes('L') ? 'red' : 'grey'}` : 
            '5px solid #1976d2', 
        transition: 'transform 0.2s',
        '&:hover': {
            transform: 'translateY(-3px)'
        }
    }}>
        <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                {type === 'prev' ? 'Last Week' : 'This Week'}
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TeamLogo name={game.opponent.name} size={40} />
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {game.opponent.ranking > 0 ? `#${game.opponent.ranking} ` : ''}{game.opponent.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {game.opponent.record}
                        </Typography>
                    </Box>
                </Box>
                
                {type === 'prev' && (
                    <Chip 
                        label={game.result} 
                        color={game.result?.includes('W') ? 'success' : game.result?.includes('L') ? 'error' : 'default'} 
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
                <Box sx={{ mb: 2, px: 1, py: 0.5, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Spread: <strong>{game.spread}</strong></Typography>
                        <Typography variant="body2">Moneyline: <strong>{game.moneyline}</strong></Typography>
                    </Box>
                </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button size="small" onClick={() => onTeamClick(game.opponent.name)}>
                    Team Info
                </Button>
                
                <MuiLink href={`/game/${game.id}`} sx={{ textDecoration: 'none' }}>
                    <Button size="small" variant="outlined">
                        {type === 'prev' ? 'Game Summary' : 'Game Preview'}
                    </Button>
                </MuiLink>
            </Box>
        </CardContent>
    </Card>
);

const TeamRow = ({ team, showRating = false, rank, highlight = false, onTeamClick }: { 
    team: Team, 
    showRating?: boolean, 
    rank?: number,
    highlight?: boolean,
    onTeamClick: (name: string) => void 
}) => (
    <TableRow 
        sx={{
            backgroundColor: highlight ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
        }}
    >
        {rank !== undefined && (
            <TableCell sx={{ fontWeight: 'bold', width: '40px' }}>
                {rank}
            </TableCell>
        )}
        <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamLogo name={team.name} size={30} />
                <Box>
                    <MuiLink
                        component="button"
                        onClick={() => onTeamClick(team.name)}
                        sx={{ cursor: 'pointer', textDecoration: 'none', fontWeight: team.ranking <= 25 ? 'bold' : 'normal' }}
                    >
                        {team.ranking <= 25 && `#${team.ranking} `}{team.name}
                    </MuiLink>
                </Box>
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
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const fetchDashboard = async () => {
        try {
            const responseData = await apiService.getDashboard<DashboardData>();
            setData(responseData);
        } catch (error) {
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    usePageRefresh<DashboardData>(setData);

    useEffect(() => {
        document.title = data?.team.name ? `${data.team.name} Dashboard` : 'College Football';
        return () => { document.title = 'College Football'; };
    }, [data?.team.name]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const confName = data.team.conference;

    return (
        <>
            <Navbar team={data.team} currentStage={data.info.stage} info={data.info} conferences={data.conferences} />
            <Container>
                {/* Team Header with Conference Logo */}
                <Paper 
                    elevation={2} 
                    sx={{ 
                        mb: 4, 
                        p: 3, 
                        borderRadius: 2,
                        background: `linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url(${data.team.colorPrimary})`
                    }}
                >
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={1}>
                            <TeamLogo name={data.team.name} size={80} />
                        </Grid>
                        <Grid item xs={12} md={9}>
                            <Typography variant="h3" fontWeight="bold" gutterBottom>
                                {data.team.ranking > 0 && `#${data.team.ranking} `}{data.team.name} {data.team.mascot}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                <Typography variant="h6">
                                    Record: <strong>{data.team.totalWins}-{data.team.totalLosses}</strong>
                                    {data.team.conference && (
                                        <> (<strong>{data.team.confWins}-{data.team.confLosses}</strong> in conference)</>
                                    )}
                                </Typography>
                                <Typography variant="h6">Rating: <strong>{data.team.rating}</strong></Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {confName && (
                                <Box sx={{ textAlign: 'center' }}>
                                    <ConfLogo name={confName} size={60} />
                                    <Typography variant="subtitle1" sx={{ mt: 1 }}>{confName}</Typography>
                                </Box>
                            )}
                        </Grid>
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
                            <Alert severity="info">No recent or upcoming games available</Alert>
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
            </Container>
            
            <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

export default Dashboard;
