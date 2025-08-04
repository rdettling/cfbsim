import { useState, useEffect } from 'react';
import { apiService, usePageRefresh, getPlayerRoute } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import {
    Container, Typography, Box, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, Card, CardContent, Grid, Chip,
    FormControl, InputLabel, Select, MenuItem, Accordion,
    AccordionSummary, AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Navbar from '../components/Navbar';
import { TeamInfoModal, TeamLink, TeamLogo } from '../components/TeamComponents';

interface FreshmanPlayer {
    id: number;
    first: string;
    last: string;
    pos: string;
    rating: number;
    stars: number;
    development_trait: number;
}

interface TeamRecruits {
    team: Team;
    players: FreshmanPlayer[];
}

interface RecruitingSummaryData {
    info: Info;
    team: Team;
    conferences: Conference[];
    freshmen_by_team: Record<string, TeamRecruits>;
    summary_stats: {
        total_freshmen: number;
        avg_rating: number;
        max_rating: number;
        min_rating: number;
    };
}

interface StatCardProps {
    title: string;
    value: number;
    color: 'primary' | 'secondary' | 'success' | 'info';
    gradient: string;
}

const StatCard = ({ title, value, color, gradient }: StatCardProps) => (
    <Card sx={{ height: '100%', background: gradient }}>
        <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: `${color}.main` }}>
                {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {title}
            </Typography>
        </CardContent>
    </Card>
);

const RecruitingSummary = () => {
    const [data, setData] = useState<RecruitingSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [positionFilter, setPositionFilter] = useState<string>('');
    const [teamFilter, setTeamFilter] = useState<string>('');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    useEffect(() => {
        const fetchRecruitingSummary = async () => {
            try {
                const responseData = await apiService.getRecruitingSummary<RecruitingSummaryData>();
                setData(responseData);
            } catch (error) {
                setError('Failed to load recruiting summary data');
            } finally {
                setLoading(false);
            }
        };

        fetchRecruitingSummary();
    }, []);

    usePageRefresh<RecruitingSummaryData>(setData);

    useEffect(() => {
        document.title = data?.team.name ? `${data.team.name} Recruiting Summary` : 'Recruiting Summary';
        return () => { document.title = 'College Football'; };
    }, [data?.team.name]);

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

    // Get all freshmen for filtering
    const allFreshmen = Object.values(data.freshmen_by_team).flatMap(teamData => 
        teamData.players.map(player => ({ ...player, teamName: teamData.team.name }))
    );

    // Get unique positions and teams for filters
    const uniquePositions = [...new Set(allFreshmen.map(player => player.pos))].sort();
    const uniqueTeams = Object.keys(data.freshmen_by_team).sort();

    // Filter and sort freshmen
    const filteredFreshmen = allFreshmen
        .filter(player => !positionFilter || player.pos === positionFilter)
        .filter(player => !teamFilter || player.teamName === teamFilter)
        .sort((a, b) => b.rating - a.rating);

    const statCards = [
        {
            title: 'Total Freshmen',
            value: data.summary_stats.total_freshmen,
            color: 'primary' as const,
            gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
        },
        {
            title: 'Average Rating',
            value: data.summary_stats.avg_rating,
            color: 'success' as const,
            gradient: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)'
        },
        {
            title: 'Highest Rating',
            value: data.summary_stats.max_rating,
            color: 'secondary' as const,
            gradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)'
        },
        {
            title: 'Lowest Rating',
            value: data.summary_stats.min_rating,
            color: 'info' as const,
            gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)'
        }
    ];

    return (
        <>
            <Navbar team={data.team} currentStage={data.info.stage} info={data.info} conferences={data.conferences} />
            <Container maxWidth="lg" sx={{ py: 4 }}>
                {/* Header Section */}
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        Recruiting Summary
                    </Typography>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        {data.info.currentYear} Freshman Class
                    </Typography>
                </Box>

                {/* Summary Stats */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {statCards.map((card, index) => (
                        <Grid item xs={12} sm={6} md={3} key={index}>
                            <StatCard {...card} />
                        </Grid>
                    ))}
                </Grid>

                {/* Filters */}
                <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Filter by Position</InputLabel>
                        <Select
                            value={positionFilter}
                            label="Filter by Position"
                            onChange={(e) => setPositionFilter(e.target.value)}
                        >
                            <MenuItem value="">All Positions</MenuItem>
                            {uniquePositions.map((pos) => (
                                <MenuItem key={pos} value={pos}>
                                    {pos.toUpperCase()}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Filter by Team</InputLabel>
                        <Select
                            value={teamFilter}
                            label="Filter by Team"
                            onChange={(e) => setTeamFilter(e.target.value)}
                        >
                            <MenuItem value="">All Teams</MenuItem>
                            {uniqueTeams.map((teamName) => (
                                <MenuItem key={teamName} value={teamName}>
                                    {teamName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Top Recruits Table */}
                <Card sx={{ mb: 4 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                Top Recruits
                            </Typography>
                            <Chip 
                                label={`${filteredFreshmen.length} players`} 
                                color="primary" 
                                size="small"
                            />
                            {(positionFilter || teamFilter) && (
                                <Chip 
                                    label="Filtered" 
                                    color="secondary" 
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        </Box>
                        
                        {filteredFreshmen.length > 0 ? (
                            <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'primary.main' }}>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rank</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Team</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Position</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Stars</TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Development</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredFreshmen.slice(0, 50).map((player, index) => (
                                            <TableRow key={player.id} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                                                <TableCell sx={{ fontWeight: 'bold' }}>
                                                    #{index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    <Box 
                                                        component="a" 
                                                        href={getPlayerRoute(player.id.toString())}
                                                        sx={{ 
                                                            textDecoration: 'none', 
                                                            color: 'primary.main',
                                                            fontWeight: 'bold',
                                                            '&:hover': { textDecoration: 'underline' }
                                                        }}
                                                    >
                                                        {player.first} {player.last}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <TeamLogo name={player.teamName} size={25} />
                                                        <TeamLink 
                                                            name={player.teamName} 
                                                            onTeamClick={() => handleTeamClick(player.teamName)}
                                                        />
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={player.pos} 
                                                        size="small"
                                                        color="secondary"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>
                                                    {player.rating}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={`${player.stars}★`}
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={`${player.development_trait}/5`}
                                                        size="small"
                                                        color="info"
                                                        variant="outlined"
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
                                    No recruits found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    No freshmen match the current filters.
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>

                {/* Team Breakdown */}
                <Card>
                    <CardContent>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
                            Team Breakdown
                        </Typography>
                        
                        {Object.entries(data.freshmen_by_team)
                            .filter(([teamName, teamData]) => 
                                !teamFilter || teamName === teamFilter
                            )
                            .sort(([, a], [, b]) => b.team.prestige - a.team.prestige)
                            .map(([teamName, teamData]) => (
                                <Accordion key={teamName} sx={{ mb: 1 }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                            <TeamLogo name={teamName} size={30} />
                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                {teamName}
                                            </Typography>
                                            <Chip 
                                                label={`${teamData.players.length} recruits`} 
                                                size="small"
                                                color="primary"
                                            />
                                            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                                                Prestige: {teamData.team.prestige}
                                            </Typography>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Name</TableCell>
                                                        <TableCell>Position</TableCell>
                                                        <TableCell>Rating</TableCell>
                                                        <TableCell>Stars</TableCell>
                                                        <TableCell>Development</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {teamData.players
                                                        .filter(player => !positionFilter || player.pos === positionFilter)
                                                        .sort((a, b) => b.rating - a.rating)
                                                        .map((player) => (
                                                            <TableRow key={player.id}>
                                                                <TableCell>
                                                                    <Box 
                                                                        component="a" 
                                                                        href={getPlayerRoute(player.id.toString())}
                                                                        sx={{ 
                                                                            textDecoration: 'none', 
                                                                            color: 'primary.main',
                                                                            fontWeight: 'bold',
                                                                            '&:hover': { textDecoration: 'underline' }
                                                                        }}
                                                                    >
                                                                        {player.first} {player.last}
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip 
                                                                        label={player.pos} 
                                                                        size="small"
                                                                        color="secondary"
                                                                        variant="outlined"
                                                                    />
                                                                </TableCell>
                                                                <TableCell sx={{ fontWeight: 'bold' }}>
                                                                    {player.rating}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip 
                                                                        label={`${player.stars}★`}
                                                                        size="small"
                                                                        color="warning"
                                                                        variant="outlined"
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip 
                                                                        label={`${player.development_trait}/5`}
                                                                        size="small"
                                                                        color="info"
                                                                        variant="outlined"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                    </CardContent>
                </Card>
            </Container>
            
            <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

export default RecruitingSummary; 