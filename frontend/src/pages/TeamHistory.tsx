import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiService, usePageRefresh, getTeamHistoryRoute, getTeamScheduleRoute } from "../services/api";
import { Team, Info, Conference } from "../interfaces";
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Paper,
    Link,
    CircularProgress,
    Alert,
    Typography,
    Box,
    Stack,
} from '@mui/material';
import {
    Schedule,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import TeamHeader from '../components/TeamHeader';
import { ConfLogo } from '../components/TeamComponents';

interface YearHistory {
    year: number;
    prestige: number;
    rating: number;
    conference: string;
    wins: number;
    losses: number;
    rank: number;
    has_games: boolean;
}

interface HistoryData {
    info: Info;
    team: Team;
    years: YearHistory[];
    conferences: Conference[];
    teams: Team[];
}

const TeamHistory = () => {
    const { teamName } = useParams();
    const [data, setData] = useState<HistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Add usePageRefresh for automatic data updates
    usePageRefresh<HistoryData>(setData);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                if (teamName) {
                    const responseData = await apiService.getTeamHistory<HistoryData>(teamName);
                    setData(responseData);
                }
            } catch (error) {
                setError('Failed to load team history');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        document.title = teamName ? `${teamName} History` : 'Team History';
        return () => { document.title = 'College Football'; };
    }, [teamName]);

    const handleTeamChange = (newTeam: string) => {
        navigate(getTeamHistoryRoute(newTeam));
    };

    const getRankDisplay = (rank: number) => {
        if (rank === 0) return 'N/A';
        return `#${rank}`;
    };

    const getPrestigeStars = (prestige: number) => {
        // Prestige is already 1-7, just return it directly
        return Math.min(Math.max(prestige, 1), 7);
    };

    const PrestigeStars = ({ prestige }: { prestige: number }) => {
        const starCount = getPrestigeStars(prestige);
        const isProduction = () => window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const getBasePath = () => isProduction() ? '/static' : '';
        const starPath = `${getBasePath()}/logos/star.png`;

        return (
            <Stack direction="row" spacing={0.5}>
                {Array.from({ length: starCount }, (_, i) => (
                    <Box
                        key={i}
                        component="img"
                        src={starPath}
                        sx={{ width: 16, height: 16 }}
                        alt="star"
                    />
                ))}
            </Stack>
        );
    };

    if (loading) return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
        </Box>
    );
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No history data available</Alert>;

    const totalWins = data.years.reduce((sum, year) => sum + year.wins, 0);
    const totalLosses = data.years.reduce((sum, year) => sum + year.losses, 0);

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <TeamHeader 
                    team={data.team}
                    teams={data.teams}
                    onTeamChange={handleTeamChange}
                />

                {/* History Table */}
                <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ 
                        bgcolor: data.team.colorPrimary || 'primary.main', 
                        color: 'white', 
                        p: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Schedule />
                            Team History
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            All-Time: {totalWins}-{totalLosses}
                        </Typography>
                    </Box>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: data.team.colorPrimary || 'primary.main' }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Year</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Prestige</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Conference</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Record</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rank</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.years.map((year) => (
                                    <TableRow 
                                        key={year.year}
                                        sx={{ 
                                            '&:hover': { 
                                                bgcolor: `${data.team.colorSecondary || 'grey.100'}20`
                                            },
                                            '&:nth-of-type(odd)': { bgcolor: 'grey.25' }
                                        }}
                                    >
                                        <TableCell>
                                            {year.has_games ? (
                                                <Link
                                                    component="button"
                                                    onClick={() => navigate(`${getTeamScheduleRoute(teamName || '')}?year=${year.year}`)}
                                                    sx={{ 
                                                        cursor: 'pointer',
                                                        textDecoration: 'none',
                                                        color: 'primary.main',
                                                        fontWeight: 'bold',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                >
                                                    {year.year}
                                                </Link>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    {year.year}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <PrestigeStars prestige={year.prestige} />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="bold">
                                                {year.rating}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            {year.conference === 'Independent' ? (
                                                <Typography variant="body2">
                                                    Independent
                                                </Typography>
                                            ) : (
                                                <ConfLogo name={year.conference} size={30} />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="bold">
                                                {year.wins}-{year.losses}
                                                {year.rank === 1 && ' 🏆'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: 'inline-block',
                                                    px: 1,
                                                    py: 0.5,
                                                    borderRadius: 1,
                                                    backgroundColor: year.rank <= 25 ? `${data.team.colorPrimary || 'primary.main'}` : 'transparent',
                                                    border: year.rank <= 25 ? `1px solid ${data.team.colorPrimary || 'primary.main'}` : 'none',
                                                    color: year.rank <= 25 ? 'white' : 'black',
                                                    fontWeight: year.rank <= 25 ? 'bold' : 'normal',
                                                }}
                                            >
                                                {getRankDisplay(year.rank)}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Container>
        </>
    );
};

export default TeamHistory;
