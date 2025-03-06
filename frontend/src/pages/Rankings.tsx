import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Paper,
    Box,
    Link as MuiLink,
    CircularProgress,
    Alert
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface RankingsTeam extends Team {
    movement: number;
    record: string;
    last_game?: {
        opponent: { name: string; ranking: number; };
        result: string;
        score: string;
    };
    next_game?: {
        opponent: { name: string; ranking: number; };
        spread: number;
    };
}

interface RankingsData {
    info: Info;
    team: Team;
    rankings: RankingsTeam[];
    conferences: Conference[];
}

const Rankings = () => {
    const [data, setData] = useState<RankingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    useEffect(() => {
        const fetchRankings = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/rankings`);
                setData(response.data);
            } catch (error) {
                setError('Failed to load rankings data');
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
        document.title = 'AP Rankings';
        return () => { document.title = 'College Football'; };
    }, []);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const stageText = data.info.stage === 'season' 
        ? `Week ${data.info.currentWeek}` 
        : data.info.stage === 'schedule non conference' 
            ? 'Preseason' 
            : 'End of season';

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography variant="h2">AP Top 25</Typography>
                    <Typography variant="h5">{stageText}</Typography>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Rank</TableCell>
                                <TableCell>Team</TableCell>
                                <TableCell>Record</TableCell>
                                <TableCell>Last Week</TableCell>
                                <TableCell>This Week</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.rankings.map((team) => (
                                <TableRow key={team.name}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {team.ranking}
                                            <Typography
                                                component="span"
                                                sx={{ color: team.movement > 0 ? 'success.main' : team.movement < 0 ? 'error.main' : 'text.primary' }}
                                            >
                                                ({team.movement > 0 ? '+' : ''}{team.movement})
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box component="img" src={`/logos/teams/${team.name}.png`} sx={{ width: 30, height: 30 }} />
                                            <MuiLink 
                                                component="button" 
                                                onClick={() => handleTeamClick(team.name)} 
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                {team.name}
                                            </MuiLink>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{team.record}</TableCell>
                                    <TableCell>
                                        {team.last_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {team.last_game.result} ({team.last_game.score}) vs
                                                <Box component="img" src={`/logos/teams/${team.last_game.opponent.name}.png`} sx={{ width: 20, height: 20 }} />
                                                <MuiLink 
                                                    component="button" 
                                                    onClick={() => handleTeamClick(team.last_game!.opponent.name)} 
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    #{team.last_game.opponent.ranking} {team.last_game.opponent.name}
                                                </MuiLink>
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {team.next_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box component="img" src={`/logos/teams/${team.next_game.opponent.name}.png`} sx={{ width: 20, height: 20 }} />
                                                <MuiLink 
                                                    component="button" 
                                                    onClick={() => handleTeamClick(team.next_game!.opponent.name)} 
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    #{team.next_game.opponent.ranking} {team.next_game.opponent.name}
                                                </MuiLink>
                                                ({team.next_game.spread})
                                            </Box>
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

export default Rankings;
