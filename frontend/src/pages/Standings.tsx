import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { usePageRefresh } from '../interfaces';
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

interface StandingsData {
    info: Info;
    team: Team;
    conference?: string;
    teams: {
        name: string;
        ranking: number;
        confWins?: number;
        confLosses?: number;
        totalWins: number;
        totalLosses: number;
        last_game?: {
            opponent: {
                name: string;
                ranking: number;
            };
            result: string;
            score: string;
        };
        next_game?: {
            opponent: {
                name: string;
                ranking: number;
            };
            spread: number;
        };
    }[];
    conferences: Conference[];
}

const Standings = () => {
    const { conference_name } = useParams();
    const [data, setData] = useState<StandingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    usePageRefresh<StandingsData>(setData);


    useEffect(() => {
        const fetchStandings = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/standings/${conference_name}`);
                setData(response.data);
            } catch (error) {
                setError('Failed to load standings data');
            } finally {
                setLoading(false);
            }
        };

        if (conference_name) {
            fetchStandings();
        }
    }, [conference_name]);

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
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    {conference_name !== 'independent' && (
                        <Box
                            component="img"
                            src={`/logos/conferences/${data.conference}.png`}
                            sx={{ height: 100, mb: 2 }}
                            alt={data.conference}
                        />
                    )}
                    <Typography variant="h2">
                        {conference_name === 'independent' ? 'Independent Teams' : `${data.conference} Standings`}
                    </Typography>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Rank</TableCell>
                                <TableCell>Team</TableCell>
                                {conference_name !== 'independent' && <TableCell>Conf</TableCell>}
                                <TableCell>Overall</TableCell>
                                <TableCell>Last Week</TableCell>
                                <TableCell>Next Week</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.teams.map((team, index) => (
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
                                                #{team.ranking} {team.name}
                                            </MuiLink>
                                        </Box>
                                    </TableCell>
                                    {conference_name !== 'independent' && (
                                        <TableCell>{team.confWins}-{team.confLosses}</TableCell>
                                    )}
                                    <TableCell>{team.totalWins}-{team.totalLosses}</TableCell>
                                    <TableCell>
                                        {team.last_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {team.last_game.result} ({team.last_game.score}) vs
                                                <Box
                                                    component="img"
                                                    src={`/logos/teams/${team.last_game.opponent.name}.png`}
                                                    sx={{ width: 20, height: 20 }}
                                                />
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
                                                <Box
                                                    component="img"
                                                    src={`/logos/teams/${team.next_game.opponent.name}.png`}
                                                    sx={{ width: 20, height: 20 }}
                                                />
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

export default Standings;
