import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { usePageRefresh } from '../interfaces';
import { Team, Info, Conference, Player } from '../interfaces';
import {
    Container, Typography, Box, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper
} from '@mui/material';
import Navbar from '../components/Navbar';
// import { TeamLink } from '../components/TeamComponents';
import TeamInfoModal from '../components/TeamInfoModal';



interface ProgressedPlayer extends Player {
    change: number;
}

interface RosterProgressionData {
    info: Info & { lastWeek: number };
    team: Team;
    leaving: Player[];
    progressed: ProgressedPlayer[];
    conferences: Conference[];
}

const RosterProgression = () => {
    const [data, setData] = useState<RosterProgressionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam] = useState<string>('');

    // const handleTeamClick = (name: string) => {
    //     setSelectedTeam(name);
    //     setModalOpen(true);
    // };

    useEffect(() => {
        const fetchRosterProgression = async () => {
            try {
                const response = await axios.get(API_BASE_URL + '/api/roster_progression');
                setData(response.data);
            } catch (error) {
                setError('Failed to load roster progression data');
            } finally {
                setLoading(false);
            }
        };
        fetchRosterProgression();
    }, []);

    usePageRefresh<RosterProgressionData>(setData);

    useEffect(() => {
        document.title = data?.team.name ? `${data.team.name} Roster Progression` : 'Roster Progression';
        return () => { document.title = 'College Football'; };
    }, [data?.team.name]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    return (
        <>
            <Navbar team={data.team} currentStage={data.info.stage} info={data.info} conferences={data.conferences} />
            <Container>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" component="h2" gutterBottom>
                        Seniors Leaving
                    </Typography>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Position</TableCell>
                                    <TableCell>Rating</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.leaving.map((player, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{player.first} {player.last}</TableCell>
                                        <TableCell>{player.pos}</TableCell>
                                        <TableCell>{player.rating}</TableCell>
                                    </TableRow>
                                ))}
                                {data.leaving.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center">No seniors leaving</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box>
                    <Typography variant="h4" component="h2" gutterBottom>
                        Players Progressed
                    </Typography>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Year</TableCell>
                                    <TableCell>Position</TableCell>
                                    <TableCell>Rating</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.progressed.map((player) => (
                                    <TableRow key={player.id}>
                                        <TableCell>
                                            <Box 
                                                component="a" 
                                                href={`/player/${player.id}`}
                                                sx={{ 
                                                    textDecoration: 'none', 
                                                    color: 'primary.main',
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}
                                            >
                                                {player.first} {player.last}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{player.year}</TableCell>
                                        <TableCell>{player.pos}</TableCell>
                                        <TableCell>
                                            {player.rating}
                                            <Box component="span" sx={{ color: 'success.main', ml: 1 }}>
                                                (+{player.change})
                                            </Box>
                                        </TableCell>
                                    </TableRow>
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

export default RosterProgression;
