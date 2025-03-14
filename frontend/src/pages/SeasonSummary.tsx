import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference, Game } from '../interfaces';
import { TeamLink, TeamLogo } from '../components/TeamComponents';
import {
    Container,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Paper,
    Box,
    CircularProgress,
    Alert
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface RealignmentData {
    [team: string]: {
        old: string;
        new: string;
    };
}

interface SummaryData {
    info: Info;
    team: Team;
    conferences: Conference[];
    championship: Game;
    realignment: RealignmentData;
}

const SeasonSummary = () => {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const responseData = await apiService.getSeasonSummary<SummaryData>();
                setData(responseData);
            } catch (error) {
                setError('Failed to load season summary');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, []);

    // Add usePageRefresh for automatic data updates
    usePageRefresh<SummaryData>(setData);

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const winner = data.championship?.winner;

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Typography variant="h4" gutterBottom>
                        {data.info.currentYear} Season Summary
                    </Typography>
                    {winner && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 4 }}>
                            <TeamLogo name={winner.name} size={50} />
                            <Typography variant="h5">
                                <TeamLink 
                                    name={winner.name} 
                                    onTeamClick={() => handleTeamClick(winner.name)}
                                /> won the national championship
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Typography variant="h5" gutterBottom>Conference Realignment Summary for next season</Typography>
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Team</TableCell>
                                <TableCell>Old Conference</TableCell>
                                <TableCell>New Conference</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Object.entries(data.realignment).length > 0 ? (
                                Object.entries(data.realignment).map(([team, confs]) => (
                                    <TableRow key={team}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <TeamLogo name={team} size={30} />
                                                <TeamLink 
                                                    name={team} 
                                                    onTeamClick={() => handleTeamClick(team)}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>{confs.old}</TableCell>
                                        <TableCell>{confs.new}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} align="center">
                                        No realignment changes
                                    </TableCell>
                                </TableRow>
                            )}
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

export default SeasonSummary;
