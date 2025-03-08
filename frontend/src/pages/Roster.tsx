import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Team, Info, Conference, usePageRefresh, PlayerInfo } from '../interfaces';
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Box,
    TableContainer,
    Paper,
    Link,
    CircularProgress,
    Alert,
    Typography,
    LinearProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import TeamHeader from '../components/TeamHeader';


interface RosterData {
    info: Info;
    team: Team;
    roster: PlayerInfo[];
    positions: string[];
    conferences: Conference[];
    teams: Team[];
}

const Roster = () => {
    const { teamName } = useParams();
    const [data, setData] = useState<RosterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [positionFilter, setPositionFilter] = useState('');
    const navigate = useNavigate();

    usePageRefresh<RosterData>(setData);


    useEffect(() => {
        const fetchRoster = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/${teamName}/roster`);
                setData(response.data);
            } catch (error) {
                setError('Failed to load roster');
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
        document.title = teamName ? `${teamName} Roster` : 'Roster';
        return () => { document.title = 'College Football'; };
    }, [teamName]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No roster data available</Alert>;

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
                    onTeamChange={(newTeam) => navigate(`/${newTeam}/roster`)}
                />

                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" align="center" gutterBottom>
                        #{data.team.ranking} {data.team.name} {data.team.mascot}
                    </Typography>

                    <LinearProgress
                        variant="determinate"
                        value={data.team.rating}
                        sx={{
                            mb: 3,
                            height: 10,
                            '& .MuiLinearProgress-bar': {
                                backgroundColor: data.team.colorPrimary
                            }
                        }}
                    />

                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6">Offense: {data.team.offense}</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={data.team.offense}
                                sx={{
                                    height: 8,
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: data.team.colorSecondary
                                    }
                                }}
                            />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6">Defense: {data.team.defense}</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={data.team.defense}
                                sx={{
                                    height: 8,
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor: data.team.colorSecondary
                                    }
                                }}
                            />
                        </Box>
                    </Box>

                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Filter by Position</InputLabel>
                        <Select
                            value={positionFilter}
                            onChange={(e) => setPositionFilter(e.target.value as string)}
                        >
                            <MenuItem value="">All Positions</MenuItem>
                            {data.positions.map(pos => (
                                <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Position</TableCell>
                                <TableCell>Rating</TableCell>
                                <TableCell>Starter</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.positions.flatMap(position => (
                                positionFilter === '' || positionFilter === position ? [
                                    <TableRow key={`pos-${position}`}>
                                        <TableCell colSpan={4} sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                                            {position}
                                        </TableCell>
                                    </TableRow>,
                                    ...data.roster
                                        .filter(player => player.pos === position)
                                        .map(player => (
                                            <TableRow key={`player-${player.id}`}>
                                                <TableCell>
                                                    <Link
                                                        component="button"
                                                        onClick={() => navigate(`/players/${player.id}`)}
                                                        sx={{ cursor: 'pointer' }}
                                                    >
                                                        {player.first} {player.last}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{player.pos}</TableCell>
                                                <TableCell>{player.rating}</TableCell>
                                                <TableCell>{player.starter ? '✅' : '❌'}</TableCell>
                                            </TableRow>
                                        ))
                                ] : []
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Container>
        </>
    );
};

export default Roster;
