import { useState, useEffect } from 'react';
import { apiService, usePageRefresh, getGameRoute } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { TeamLink, TeamLogo, TeamInfoModal } from '../components/TeamComponents';
import { useNavigate } from 'react-router-dom';

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
    Alert,
    Chip,
    Button
} from '@mui/material';
import Navbar from '../components/Navbar';

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
    const [showAllTeams, setShowAllTeams] = useState(false);
    const navigate = useNavigate();

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

    const handleGameClick = (gameId: string) => {
        navigate(getGameRoute(gameId));
    };

    // Filter teams based on showAllTeams state
    const displayedTeams = showAllTeams ? data.rankings : data.rankings.slice(0, 25);

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

                <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden', minWidth: 1200 }}>
                    <Table sx={{ minWidth: 1200 }}>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'primary.main' }}>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '80px' }}>Rank</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '200px' }}>Team</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '120px' }}>Record</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '120px' }}>Poll Score</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', width: '150px' }}>Strength of Record</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', minWidth: '250px' }}>Last Week</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold', minWidth: '250px' }}>This Week</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayedTeams.map((team, index) => (
                                <TableRow 
                                    key={team.name}
                                    sx={{ 
                                        backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                                        '&:hover': { backgroundColor: 'grey.100' }
                                    }}
                                >
                                    <TableCell sx={{ width: '80px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                {team.ranking}
                                            </Typography>
                                            {team.movement !== 0 && (
                                                <Chip
                                                    label={`${team.movement > 0 ? '+' : ''}${team.movement}`}
                                                    size="small"
                                                    color={team.movement > 0 ? 'success' : 'error'}
                                                    variant="outlined"
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ width: '200px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TeamLogo name={team.name} />
                                            <TeamLink name={team.name} onTeamClick={handleTeamClick} />
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ width: '120px' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium', whiteSpace: 'nowrap' }}>
                                            {team.record}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ width: '120px' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                            {team.poll_score !== undefined ? team.poll_score.toFixed(1) : 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ width: '150px' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                            {team.strength_of_record !== undefined ? team.strength_of_record.toFixed(1) : 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ minWidth: '250px' }}>
                                        {team.last_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="body2">
                                                    {team.last_game.result}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        color: 'primary.main',
                                                        fontWeight: 'bold',
                                                        '&:hover': { color: 'primary.dark' }
                                                    }}
                                                    onClick={() => handleGameClick(team.last_game.id)}
                                                >
                                                    ({team.last_game.score})
                                                </Typography>
                                                <Typography variant="body2">vs</Typography>
                                                <TeamLogo name={team.last_game.opponent.name} size={20} />
                                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                    #{team.last_game.opponent.ranking}
                                                </Typography>
                                                <TeamLink name={team.last_game.opponent.name} onTeamClick={handleTeamClick} />
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ minWidth: '250px' }}>
                                        {team.next_game && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <TeamLogo name={team.next_game.opponent.name} size={20} />
                                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                    #{team.next_game.opponent.ranking}
                                                </Typography>
                                                <TeamLink name={team.next_game.opponent.name} onTeamClick={handleTeamClick} />
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        color: 'primary.main',
                                                        fontWeight: 'bold',
                                                        '&:hover': { color: 'primary.dark' }
                                                    }}
                                                    onClick={() => handleGameClick(team.next_game.id)}
                                                >
                                                    ({team.next_game.spread})
                                                </Typography>
                                            </Box>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                
                {/* Toggle button for showing all teams */}
                {!showAllTeams && data.rankings.length > 25 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Button
                            variant="outlined"
                            onClick={() => setShowAllTeams(true)}
                            sx={{
                                px: 4,
                                py: 1.5,
                                fontSize: '1rem',
                                fontWeight: 600,
                                borderRadius: 2,
                                textTransform: 'none'
                            }}
                        >
                            Show All {data.rankings.length} Teams
                        </Button>
                    </Box>
                )}
                
                {showAllTeams && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Button
                            variant="outlined"
                            onClick={() => setShowAllTeams(false)}
                            sx={{
                                px: 4,
                                py: 1.5,
                                fontSize: '1rem',
                                fontWeight: 600,
                                borderRadius: 2,
                                textTransform: 'none'
                            }}
                        >
                            Show Top 25 Only
                        </Button>
                    </Box>
                )}
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
