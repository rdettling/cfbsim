import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
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
    Alert,
    Card,
    CardContent,
    Grid,
    Chip,
    Divider,
    Stack
} from '@mui/material';
import Navbar from '../components/Navbar';
import { TeamInfoModal } from '../components/TeamComponents';

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
    champion: Team; // Changed from championship to champion to match backend
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

    // Note: usePageRefresh was removed, manual refresh handling would need to be implemented if needed

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }
    
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const champion = data.champion;

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container maxWidth="lg" sx={{ py: 4 }}>
                {/* Header Section */}
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {data.info.currentYear} Season Summary
                    </Typography>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        The season has concluded. Here's what happened.
                    </Typography>
                </Box>

                {/* Champion Section */}
                {champion && (
                    <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)', border: '3px solid #ffd700' }}>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 3 }}>
                                <TeamLogo name={champion.name} size={80} />
                                <Box>
                                    <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                                        NATIONAL CHAMPIONS
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                                        <TeamLink 
                                            name={champion.name} 
                                            onTeamClick={() => handleTeamClick(champion.name)}
                                        />
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip 
                                label="🏆 CHAMPIONS" 
                                sx={{ 
                                    backgroundColor: '#8B4513', 
                                    color: 'white', 
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    py: 1
                                }} 
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Realignment Section */}
                <Card sx={{ mb: 4 }}>
                    <CardContent>
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
                            Conference Realignment for Next Season
                        </Typography>
                        
                        {Object.entries(data.realignment).length > 0 ? (
                            <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'primary.main' }}>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Team</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Old Conference</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>New Conference</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Object.entries(data.realignment).map(([team, confs]) => (
                                            <TableRow key={team} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <TeamLogo name={team} size={30} />
                                                        <TeamLink 
                                                            name={team} 
                                                            onTeamClick={() => handleTeamClick(team)}
                                                        />
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={confs.old} 
                                                        variant="outlined" 
                                                        color="error"
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={confs.new} 
                                                        variant="outlined" 
                                                        color="success"
                                                        size="small"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                    No Conference Changes
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    All teams remain in their current conferences for the upcoming season.
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>

                {/* Next Steps Section */}
                <Card sx={{ background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            What's Next?
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            The season is complete! You can now progress to the next year to see how your players develop 
                            and prepare for the upcoming season.
                        </Typography>
                    </CardContent>
                </Card>
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
