import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiService, usePageRefresh, getTeamScheduleRoute, getGameRoute } from '../services/api';
import { Team, ScheduleGame, Info, Conference } from '../interfaces';
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Box,
    Stack,
    TableContainer,
    Paper,
    Link,
    CircularProgress,
    Alert,
    Chip,
    Typography,
    Button
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import TeamHeader from '../components/TeamHeader';
import { TeamLogo, TeamInfoModal } from '../components/TeamComponents';

interface ScheduleData {
    info: Info;
    team: Team;
    games: ScheduleGame[];
    conferences: Conference[];
    teams: Team[];
    years: string[];
}

const TeamSchedule = () => {
    const { teamName } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState<ScheduleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    // Get year from URL or default to current year
    const year = searchParams.get('year') || data?.info.currentYear?.toString();

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            if (teamName) {
                const responseData = await apiService.getTeamSchedule<ScheduleData>(
                    teamName, 
                    year || undefined
                );
                setData(responseData);
                document.title = `${responseData.team.name} Schedule`;
            }
        } catch (err) {
            setError('Failed to load schedule');
            console.error('Error fetching schedule:', err);
        } finally {
            setLoading(false);
        }
    };

    // Use the new usePageRefresh from api.ts
    usePageRefresh<ScheduleData>(setData);

    useEffect(() => {
        setModalOpen(false); // Close modal on navigation
        fetchSchedule();
    }, [teamName, year]);

    useEffect(() => {
        if (data?.team.name) {
            document.title = `${data.team.name} Schedule`;
        }
        return () => {
            document.title = 'College Football'; // Reset on unmount
        };
    }, [data?.team.name]);

    const handleTeamChange = (newTeam: string) => {
        setSearchParams(params => {
            if (year) params.set('year', year);
            return params;
        });
        navigate(getTeamScheduleRoute(newTeam));
    };

    const handleYearChange = (newYear: string) => {
        setSearchParams(params => {
            params.set('year', newYear);
            return params;
        });
    };

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No schedule data available</Alert>;

    // Result styling colors - slightly darker
    const resultStyles = {
        win: 'rgba(46, 125, 50, 0.15)',
        loss: 'rgba(211, 47, 47, 0.15)',
        neutral: 'inherit'
    };

    const navbarProps = {
        team: data.team,
        currentStage: data.info.stage,
        info: data.info,
        conferences: data.conferences,
    };

    return (
        <>
            <Navbar {...navbarProps} />
            <Container>
                <TeamHeader 
                    team={data.team}
                    teams={data.teams}
                    years={data.years}
                    onTeamChange={handleTeamChange}
                    onYearChange={handleYearChange}
                    selectedYear={year || data.info.currentYear?.toString() || ''}
                />
                
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h5" sx={{ 
                        mb: 2, 
                        pb: 1, 
                        borderBottom: '2px solid', 
                        borderColor: data.team.colorPrimary || 'primary.main' 
                    }}>
                        Season Schedule
                    </Typography>
                </Box>
                
                {/* Schedule Table */}
                <TableContainer component={Paper} elevation={3} sx={{ mb: 4 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ 
                                bgcolor: data.team.colorPrimary || 'primary.main',
                                '& th': { color: 'white', fontWeight: 'bold' }
                            }}>
                                <TableCell>Week</TableCell>
                                <TableCell>Opponent</TableCell>
                                <TableCell align="center">Rating</TableCell>
                                <TableCell align="center">Record</TableCell>
                                <TableCell align="center">Spread</TableCell>
                                <TableCell align="center">Result</TableCell>
                                <TableCell>Notes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.games.map((game) => (
                                <TableRow
                                    key={game.weekPlayed}
                                    sx={{
                                        backgroundColor: game.result === 'W' 
                                            ? resultStyles.win 
                                            : game.result === 'L' 
                                                ? resultStyles.loss 
                                                : resultStyles.neutral,
                                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.07)' }
                                    }}
                                >
                                    <TableCell>{game.weekPlayed}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <TeamLogo name={game.opponent.name} size={30} />
                                            <Link
                                                component="button"
                                                onClick={() => {
                                                    setSelectedTeam(game.opponent.name);
                                                    setModalOpen(true);
                                                }}
                                                sx={{ 
                                                    cursor: 'pointer', 
                                                    textDecoration: 'none',
                                                    fontWeight: game.opponent.ranking <= 25 ? 'bold' : 'normal'
                                                }}
                                            >
                                                {game.opponent.ranking <= 25 && `#${game.opponent.ranking} `}
                                                {game.opponent.name}
                                            </Link>
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="center">{game.opponent.rating}</TableCell>
                                    <TableCell align="center">{game.opponent.record}</TableCell>
                                    <TableCell align="center">{game.spread || '-'}</TableCell>
                                    <TableCell align="center">
                                        {game.result ? (
                                            <Chip
                                                label={`${game.result}: ${game.score}`}
                                                color={game.result === 'W' ? 'success' : 'error'}
                                                variant="outlined"
                                                size="small"
                                                sx={{ fontWeight: 'bold' }}
                                                onClick={() => navigate(getGameRoute(game.id))}
                                            />
                                        ) : (
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => navigate(getGameRoute(game.id))}
                                            >
                                                Preview
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {game.label && (
                                            <Chip 
                                                label={game.label} 
                                                size="small" 
                                                color="primary"
                                                variant="outlined" 
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Container>
            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

export default TeamSchedule;
