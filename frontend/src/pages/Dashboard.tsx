import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Team, Info, Game, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Link as MuiLink,
    CircularProgress,
    Alert
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface DashboardData {
    info: Info;
    prev_game: Game | null;
    curr_game: Game | null;
    team: Team;
    confTeams: Team[];
    top_10: Team[];
    conferences: Conference[];
}

// API URL constants
const DASHBOARD_URL = `${API_BASE_URL}/api/dashboard`;

const Dashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const response = await axios.get(DASHBOARD_URL);
                setData(response.data);
            } catch (error) {
                setError('Failed to load dashboard data');
                console.error('Error fetching dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    useEffect(() => {
        if (data?.team.name) {
            document.title = `${data.team.name} Dashboard`;
        }
        return () => {
            document.title = 'College Football';
        };
    }, [data?.team.name]);

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <Box sx={{ mb: 3, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Box
                        component="img"
                        src={`/logos/teams/${data.team.name}.png`}
                        sx={{ width: 60, height: 60 }}
                        alt={data.team.name}
                    />
                    <Box>
                        <Typography variant="h2">
                            #{data.team.ranking} {data.team.name} {data.team.mascot}
                        </Typography>
                        <Typography variant="h5">Rating: {data.team.rating}</Typography>
                        <Typography variant="h5">
                            {data.team.totalWins} - {data.team.totalLosses} (
                            {data.team.confWins} - {data.team.confLosses})
                        </Typography>
                    </Box>
                </Box>

                <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
                    <Box>
                        {data?.prev_game?.opponent && (
                            <Card sx={{ mb: 2 }}>
                                <CardContent>
                                    <Typography variant="h6">Last week</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Box
                                            component="img"
                                            src={`/logos/teams/${data.prev_game.opponent.name}.png`}
                                            sx={{ width: 30, height: 30 }}
                                            alt={data.prev_game.opponent.name}
                                        />
                                        <MuiLink
                                            component="button"
                                            onClick={() => handleTeamClick(data?.prev_game?.opponent?.name || '')}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            #{data.prev_game!.opponent!.ranking} {data.prev_game!.opponent!.name}
                                        </MuiLink>
                                        <Typography>
                                            {data.prev_game.result} ({data.prev_game.score})
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        )}

                        {data?.curr_game?.opponent && (
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">This week</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Box
                                            component="img"
                                            src={`/logos/teams/${data.curr_game!.opponent!.name}.png`}
                                            sx={{ width: 30, height: 30 }}
                                            alt={data.curr_game!.opponent!.name}
                                        />
                                        <MuiLink
                                            component="button"
                                            onClick={() => handleTeamClick(data.curr_game!.opponent!.name)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            #{data.curr_game!.opponent!.ranking} {data.curr_game!.opponent!.name}
                                        </MuiLink>
                                    </Box>
                                </CardContent>
                            </Card>
                        )}
                    </Box>

                    <Box>
                        <Typography variant="h5" align="center" gutterBottom>
                            Conference Standings
                        </Typography>
                        <TableContainer component={Paper}>
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
                                    {data.confTeams.map((team) => (
                                        <TableRow key={team.name}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box
                                                        component="img"
                                                        src={`/logos/teams/${team.name}.png`}
                                                        sx={{ width: 30, height: 30 }}
                                                        alt={team.name}
                                                    />
                                                    <MuiLink
                                                        component="button"
                                                        onClick={() => handleTeamClick(team.name)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        {team.name}
                                                    </MuiLink>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{team.rating}</TableCell>
                                            <TableCell>{team.confWins}-{team.confLosses}</TableCell>
                                            <TableCell>{team.totalWins}-{team.totalLosses}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

                    <Box>
                        <Typography variant="h5" align="center" gutterBottom>
                            AP Top 10
                        </Typography>
                        <TableContainer component={Paper}>
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
                                        <TableRow key={team.name}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box
                                                        component="img"
                                                        src={`/logos/teams/${team.name}.png`}
                                                        sx={{ width: 30, height: 30 }}
                                                        alt={team.name}
                                                    />
                                                    <MuiLink
                                                        component="button"
                                                        onClick={() => handleTeamClick(team.name)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        {team.name}
                                                    </MuiLink>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{team.totalWins}-{team.totalLosses}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                </Box>
            </Container>
            
            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

export default Dashboard;
