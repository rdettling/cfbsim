import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, ScheduleGame, Conference } from '../interfaces';
import { TeamLink, TeamLogo } from '../components/TeamComponents';
import {
    Container, Typography, Card, CardContent, Table,
    TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, Box, CircularProgress, Alert,
    Link as MuiLink
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

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
    <Card sx={{ mb: type === 'prev' ? 2 : 0 }}>
        <CardContent>
            <Typography variant="h6">{type === 'prev' ? 'Last week' : 'This week'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TeamLogo name={game.opponent.name} size={30} />
                <TeamLink name={game.opponent.name} onTeamClick={onTeamClick} />
                {type === 'prev' && (
                    <Typography>{game.result} ({game.score})</Typography>
                )}
            </Box>
            {type === 'curr' && (
                <Box sx={{ mb: 1 }}>
                    <Typography variant="body2">Spread: {game.spread}</Typography>
                    <Typography variant="body2">Moneyline: {game.moneyline}</Typography>
                </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <MuiLink href={`/game/${game.id}`} sx={{ textDecoration: 'none' }}>
                    {type === 'prev' ? 'Summary' : 'Preview'} →
                </MuiLink>
            </Box>
        </CardContent>
    </Card>
);

const TeamRow = ({ team, showRating = false, rank, onTeamClick }: { 
    team: Team, 
    showRating?: boolean, 
    rank?: number,
    onTeamClick: (name: string) => void 
}) => (
    <TableRow>
        {rank !== undefined && <TableCell>{rank}</TableCell>}
        <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamLogo name={team.name} size={30} />
                <TeamLink name={team.name} onTeamClick={onTeamClick} />
            </Box>
        </TableCell>
        {showRating && <TableCell>{team.rating}</TableCell>}
        {showRating ? (
            <>
                <TableCell>{team.confWins}-{team.confLosses}</TableCell>
                <TableCell>{team.totalWins}-{team.totalLosses}</TableCell>
            </>
        ) : (
            <TableCell>{team.totalWins}-{team.totalLosses}</TableCell>
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

    return (
        <>
            <Navbar team={data.team} currentStage={data.info.stage} info={data.info} conferences={data.conferences} />
            <Container>
                <Box sx={{ mb: 3, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <TeamLogo name={data.team.name} size={60} />
                    <Box>
                        <Typography variant="h2">#{data.team.ranking} {data.team.name} {data.team.mascot}</Typography>
                        <Typography variant="h5">Rating: {data.team.rating}</Typography>
                        <Typography variant="h5">{data.team.totalWins} - {data.team.totalLosses} ({data.team.confWins} - {data.team.confLosses})</Typography>
                    </Box>
                </Box>

                <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
                    <Box>
                        {data.prev_game?.opponent && <GameCard game={data.prev_game} type="prev" onTeamClick={handleTeamClick} />}
                        {data.curr_game?.opponent && <GameCard game={data.curr_game} type="curr" onTeamClick={handleTeamClick} />}
                    </Box>

                    <TableContainer component={Paper}>
                        <Typography variant="h5" align="center" sx={{ py: 2 }}>Conference Standings</Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Team</TableCell>
                                    <TableCell>Rating</TableCell>
                                    <TableCell>Conference Record</TableCell>
                                    <TableCell>Overall Record</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.confTeams.map(team => (
                                    <TeamRow key={team.name} team={team} showRating onTeamClick={handleTeamClick} />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TableContainer component={Paper}>
                        <Typography variant="h5" align="center" sx={{ py: 2 }}>AP Top 10</Typography>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Rank</TableCell>
                                    <TableCell>Team</TableCell>
                                    <TableCell>Record</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.top_10.map((team, index) => (
                                    <TeamRow key={team.name} team={team} rank={index + 1} onTeamClick={handleTeamClick} />
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
