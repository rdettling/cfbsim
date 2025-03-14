import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { TeamLink, TeamLogo } from '../components/TeamComponents';

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
    CircularProgress,
    Alert
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface RankingsData {
    info: Info;
    team: Team;
    rankings: Team[];
    conferences: Conference[];
}

const Rankings = () => {
    const [data, setData] = useState<RankingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    const fetchRankings = async () => {
        try {
            const responseData = await apiService.getRankings<RankingsData>();
            setData(responseData);
        } catch (error) {
            setError('Failed to load rankings data');
        } finally {
            setLoading(false);
        }
    };

    // Use the new usePageRefresh from api.ts
    usePageRefresh<RankingsData>(setData);

    useEffect(() => {
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

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
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
                                            <TeamLogo name={team.name} />
                                            <TeamLink name={team.name} onTeamClick={handleTeamClick} />
                                        </Box>
                                    </TableCell>
                                    <TableCell>{team.record}</TableCell>
                                    <TableCell>
                                        {team.last_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {team.last_game.result} ({team.last_game.score}) vs
                                                <TeamLogo name={team.last_game.opponent.name} size={20} />
                                                #{team.last_game.opponent.ranking} 
                                                <TeamLink name={team.last_game.opponent.name} onTeamClick={handleTeamClick} />
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {team.next_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <TeamLogo name={team.next_game.opponent.name} size={20} />
                                                #{team.next_game.opponent.ranking} 
                                                <TeamLink name={team.next_game.opponent.name} onTeamClick={handleTeamClick} />
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
