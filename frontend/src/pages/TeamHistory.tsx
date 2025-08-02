import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { getTeamHistoryRoute, getTeamScheduleRoute } from '../utils/routes';
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
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import TeamHeader from '../components/TeamHeader';

interface YearHistory {
    year: number;
    prestige: number;
    rating: number;
    conference: string;
    wins: number;
    losses: number;
    rank: number;
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

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No history data available</Alert>;

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <TeamHeader 
                    team={data.team}
                    teams={data.teams}
                    onTeamChange={handleTeamChange}
                />

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Year</TableCell>
                                <TableCell>Prestige</TableCell>
                                <TableCell>Rating</TableCell>
                                <TableCell>Conf</TableCell>
                                <TableCell>W</TableCell>
                                <TableCell>L</TableCell>
                                <TableCell>Rank</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.years.map((year) => (
                                <TableRow key={year.year}>
                                    <TableCell>
                                        <Link
                                            component="button"
                                            onClick={() => navigate(`${getTeamScheduleRoute(teamName || '')}?year=${year.year}`)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            {year.year}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{year.prestige}</TableCell>
                                    <TableCell>{year.rating}</TableCell>
                                    <TableCell>{year.conference}</TableCell>
                                    <TableCell>{year.wins}</TableCell>
                                    <TableCell>{year.losses}</TableCell>
                                    <TableCell>{year.rank}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Container>
        </>
    );
};

export default TeamHistory;
