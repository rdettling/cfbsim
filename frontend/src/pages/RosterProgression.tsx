import { useState, useEffect } from 'react';
import { apiService, usePageRefresh, getPlayerRoute } from '../services/api';
import { Team, Info, Conference, Player } from '../interfaces';
import {
    Container, Typography, Box, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, Card, CardContent, Grid, Chip,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import Navbar from '../components/Navbar';
import { TeamInfoModal, TeamLink, TeamLogo } from '../components/TeamComponents';

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

interface StatCardProps {
    title: string;
    value: number;
    color: 'success' | 'warning' | 'info' | 'secondary';
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

interface PlayerTableProps {
    players: (Player | ProgressedPlayer)[];
    title: string;
    color: 'success' | 'warning';
    showChange?: boolean;
    positionFilter?: string;
}

const PlayerTable = ({ players, title, color, showChange = false, positionFilter }: PlayerTableProps) => {
    // Sort players by rating (descending) and filter by position if specified
    const sortedAndFilteredPlayers = players
        .filter(player => !positionFilter || player.pos === positionFilter)
        .sort((a, b) => b.rating - a.rating);

    return (
        <Card sx={{ mb: 4 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: `${color}.main` }}>
                        {title}
                    </Typography>
                    <Chip 
                        label={`${sortedAndFilteredPlayers.length} players`} 
                        color={color} 
                        size="small"
                    />
                    {positionFilter && (
                        <Chip 
                            label={`Filtered: ${positionFilter.toUpperCase()}`} 
                            color="primary" 
                            size="small"
                            variant="outlined"
                        />
                    )}
                </Box>
                
                {sortedAndFilteredPlayers.length > 0 ? (
                    <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: `${color}.main` }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                                    {showChange && <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Year</TableCell>}
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Position</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sortedAndFilteredPlayers.map((player, index) => (
                                    <TableRow key={player.id || index} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
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
                                        {showChange && (
                                            <TableCell>
                                                <Chip 
                                                    label={(player as ProgressedPlayer).year?.toUpperCase() || ''} 
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <Chip 
                                                label={player.pos} 
                                                size="small"
                                                color="secondary"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: showChange ? 'inherit' : `${color}.main` }}>
                                            {player.rating}
                                            {showChange && (player as ProgressedPlayer).change !== undefined && (
                                                <Box component="span" sx={{ color: 'success.main', ml: 1, fontWeight: 'normal' }}>
                                                    (+{(player as ProgressedPlayer).change})
                                                </Box>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            {positionFilter ? `No ${positionFilter.toUpperCase()} players` : `No ${title.toLowerCase()}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {positionFilter 
                                ? `No ${positionFilter.toUpperCase()} players found.`
                                : showChange 
                                    ? 'No players have progressed this offseason.'
                                    : 'All players are returning for another season.'
                            }
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

const RosterProgression = () => {
    const [data, setData] = useState<RosterProgressionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam] = useState<string>('');
    const [positionFilter, setPositionFilter] = useState<string>('');

    useEffect(() => {
        const fetchRosterProgression = async () => {
            try {
                const responseData = await apiService.getRosterProgression<RosterProgressionData>();
                setData(responseData);
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        );
    }
    
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    // Calculate summary stats
    const totalProgressed = data.progressed.length;
    const totalLeaving = data.leaving.length;
    const avgRatingChange = totalProgressed > 0 
        ? Math.round(data.progressed.reduce((sum, player) => sum + player.change, 0) / totalProgressed)
        : 0;
    const maxRatingChange = totalProgressed > 0 
        ? Math.max(...data.progressed.map(player => player.change))
        : 0;

    const statCards = [
        {
            title: 'Players Progressed',
            value: totalProgressed,
            color: 'success' as const,
            gradient: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)'
        },
        {
            title: 'Seniors Leaving',
            value: totalLeaving,
            color: 'warning' as const,
            gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)'
        },
        {
            title: 'Avg Rating Change',
            value: avgRatingChange,
            color: 'info' as const,
            gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
        },
        {
            title: 'Max Rating Gain',
            value: maxRatingChange,
            color: 'secondary' as const,
            gradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)'
        }
    ];

    // Get unique positions for filter dropdown
    const allPlayers = [...data.progressed, ...data.leaving];
    const uniquePositions = [...new Set(allPlayers.map(player => player.pos))].sort();

    return (
        <>
            <Navbar team={data.team} currentStage={data.info.stage} info={data.info} conferences={data.conferences} />
            <Container maxWidth="lg" sx={{ py: 4 }}>
                {/* Header Section */}
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        Roster Progression
                    </Typography>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        {data.info.currentYear} → {data.info.currentYear + 1} Season Transition
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

                {/* Position Filter */}
                <Box sx={{ mb: 3 }}>
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
                </Box>

                {/* Players Progressed Section */}
                <PlayerTable 
                    players={data.progressed}
                    title="Players Progressed"
                    color="success"
                    showChange={true}
                    positionFilter={positionFilter}
                />

                {/* Seniors Leaving Section */}
                <PlayerTable 
                    players={data.leaving}
                    title="Seniors Leaving"
                    color="warning"
                    showChange={false}
                    positionFilter={positionFilter}
                />

                {/* Next Steps Section */}
                <Card sx={{ background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            Ready for Next Season
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Your roster has been updated for the upcoming season. 
                            {totalProgressed > 0 && ` ${totalProgressed} players have improved their skills.`}
                            {totalLeaving > 0 && ` ${totalLeaving} seniors have graduated.`}
                        </Typography>
                    </CardContent>
                </Card>
            </Container>
            
            <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

export default RosterProgression;
