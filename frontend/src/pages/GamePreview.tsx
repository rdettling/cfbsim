import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Box,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Link as MuiLink,
    CircularProgress,
    Alert,
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useParams, useNavigate } from 'react-router-dom';

interface Player {
    id: number;
    first: string;
    last: string;
    pos: string;
    rating: number;
}

interface Game {
    id: number;
    label: string;
    weekPlayed: number;
    year: number;
    teamA: Team;
    teamB: Team;
    rankATOG: number;
    rankBTOG: number;
    spreadA: number;
    spreadB: number;
    moneylineA: number;
    moneylineB: number;
    winProbA: number;
    winProbB: number;
}

interface GamePreviewData {
    info: Info;
    game: Game;
    conferences: Conference[];
    top_players: Player[][];
}

const GAME_PREVIEW_URL = (id: string) => `${API_BASE_URL}/api/game/${id}`;

const GamePreview = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<GamePreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGamePreview = async () => {
            try {
                setLoading(true);
                const response = await axios.get(GAME_PREVIEW_URL(id!));
                setData(response.data);
            } catch (error) {
                setError('Failed to load game preview data');
                console.error('Error fetching game preview:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchGamePreview();
        }
    }, [id]);

    useEffect(() => {
        if (data?.game) {
            document.title = `${data.game.teamA.name} vs ${data.game.teamB.name}`;
        }
        return () => {
            document.title = 'College Football';
        };
    }, [data?.game]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    return (
        <>
            <Navbar
                team={data.info.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <Typography variant="h2" align="center" gutterBottom>
                    {data.game.label}
                </Typography>
                <Typography variant="h5" align="center" gutterBottom>
                    Week {data.game.weekPlayed} - {data.game.year}
                </Typography>

                <Grid container spacing={4} sx={{ mb: 4 }}>
                    {/* Team A Card */}
                    <Grid item xs={5}>
                        <Paper sx={{ p: 3, height: '100%', textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                                <Box
                                    component="img"
                                    src={`/logos/teams/${data.game.teamA.name}.png`}
                                    sx={{ width: 60, height: 60 }}
                                    alt={data.game.teamA.name}
                                />
                                <Typography variant="h4" component="span">#{data.game.rankATOG}</Typography>
                                <Typography variant="h4">{data.game.teamA.name}</Typography>
                            </Box>
                            <Typography>{data.game.teamA.conference}</Typography>
                        </Paper>
                    </Grid>

                    {/* VS */}
                    <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="h3">VS</Typography>
                    </Grid>

                    {/* Team B Card */}
                    <Grid item xs={5}>
                        <Paper sx={{ p: 3, height: '100%', textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                                <Box
                                    component="img"
                                    src={`/logos/teams/${data.game.teamB.name}.png`}
                                    sx={{ width: 60, height: 60 }}
                                    alt={data.game.teamB.name}
                                />
                                <Typography variant="h4" component="span">#{data.game.rankBTOG}</Typography>
                                <Typography variant="h4">{data.game.teamB.name}</Typography>
                            </Box>
                            <Typography>{data.game.teamB.conference}</Typography>
                        </Paper>
                    </Grid>
                </Grid>

                <Grid container spacing={4}>
                    {/* Odds and Predictions */}
                    <Grid item xs={4}>
                        <Paper>
                            <Typography variant="h5" align="center" sx={{ p: 2 }}>
                                Odds and Predictions
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell></TableCell>
                                            <TableCell align="center">{data.game.teamA.abbreviation}</TableCell>
                                            <TableCell align="center">{data.game.teamB.abbreviation}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Spread</TableCell>
                                            <TableCell align="center">{data.game.spreadA}</TableCell>
                                            <TableCell align="center">{data.game.spreadB}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Moneyline</TableCell>
                                            <TableCell align="center">{data.game.moneylineA}</TableCell>
                                            <TableCell align="center">{data.game.moneylineB}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                    {/* Key Players */}
                    <Grid item xs={4}>
                        <Paper>
                            <Typography variant="h5" align="center" sx={{ p: 2 }}>
                                Key Players
                            </Typography>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="center">
                                                <Box
                                                    component="img"
                                                    src={`/logos/teams/${data.game.teamA.name}.png`}
                                                    sx={{ width: 30, height: 30 }}
                                                    alt={data.game.teamA.name}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box
                                                    component="img"
                                                    src={`/logos/teams/${data.game.teamB.name}.png`}
                                                    sx={{ width: 30, height: 30 }}
                                                    alt={data.game.teamB.name}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Array.from({ length: 5 }).map((_, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    {data.top_players[0][index] && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <MuiLink href={`/players/${data.top_players[0][index].id}`}>
                                                                {data.top_players[0][index].first} {data.top_players[0][index].last} ({data.top_players[0][index].pos})
                                                            </MuiLink>
                                                            <Typography>{data.top_players[0][index].rating}</Typography>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {data.top_players[1][index] && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <MuiLink href={`/players/${data.top_players[1][index].id}`}>
                                                                {data.top_players[1][index].first} {data.top_players[1][index].last} ({data.top_players[1][index].pos})
                                                            </MuiLink>
                                                            <Typography>{data.top_players[1][index].rating}</Typography>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                    {/* Team Stats */}
                    <Grid item xs={4}>
                        <Paper>
                            <Typography variant="h5" align="center" sx={{ p: 2 }}>
                                Team Stats
                            </Typography>
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                                <Typography color="text.secondary">
                                    Stats will be added later
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Button
                        variant="contained"
                        onClick={() => navigate('/dashboard')}
                    >
                        Back to Dashboard
                    </Button>
                </Box>
            </Container>
        </>
    );
};

export default GamePreview;