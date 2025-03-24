import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
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
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import TeamHeader from '../components/TeamHeader';
import { TeamInfoModal } from '../components/TeamComponents';
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
    const year = searchParams.get('year') || data?.info.currentYear.toString();

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            if (teamName) {
                const responseData = await apiService.getTeamSchedule<ScheduleData>(
                    teamName, 
                    year || undefined
                );
                setData(responseData);
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
        navigate(`/${newTeam}/schedule`);
    };

    const handleYearChange = (newYear: string) => {
        setSearchParams(params => {
            params.set('year', newYear);
            return params;
        });
    };

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No schedule data available</Alert>;

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
                    selectedYear={year || data.info.currentYear.toString()}
                />
                
                {/* Schedule Table */}
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Week</TableCell>
                                <TableCell>Opponent Rating</TableCell>
                                <TableCell>Opponent Rank</TableCell>
                                <TableCell>Opponent Record</TableCell>
                                <TableCell>Opponent</TableCell>
                                <TableCell>Spread</TableCell>
                                <TableCell>Moneyline</TableCell>
                                <TableCell>Result</TableCell>
                                <TableCell>Label</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.games.map((game) => (
                                <TableRow
                                    key={game.weekPlayed}
                                    sx={{
                                        backgroundColor: game.result === 'W'
                                            ? '#d4edda'
                                            : game.result === 'L'
                                                ? '#f8d7da'
                                                : 'inherit'
                                    }}
                                >
                                    <TableCell>Week {game.weekPlayed}</TableCell>
                                    <TableCell>{game.opponent.rating}</TableCell>
                                    <TableCell>{game.opponent.ranking}</TableCell>
                                    <TableCell>{game.opponent.record}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Box
                                                component="img"
                                                src={`/logos/teams/${game.opponent.name}.png`}
                                                sx={{ width: 30, height: 30 }}
                                                alt={game.opponent.name}
                                            />
                                            <Link
                                                component="button"
                                                onClick={() => handleTeamClick(game.opponent.name)}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                {game.opponent.name}
                                            </Link>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{game.spread}</TableCell>
                                    <TableCell>{game.moneyline}</TableCell>
                                    <TableCell>
                                        <Link
                                            component="button"
                                            onClick={() => navigate(`/game/${game.id}`)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            {game.result ? `${game.result} (${game.score})` : 'Preview'}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{game.label}</TableCell>
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
