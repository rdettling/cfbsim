import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { RatingsStatsData } from '../interfaces';
import { TeamInfoModal } from '../components/TeamComponents';

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
    Grid,
    Divider
} from '@mui/material';
import Navbar from '../components/Navbar';

const RatingsStats = () => {
    const [data, setData] = useState<RatingsStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    const fetchRatingsStats = async () => {
        try {
            const responseData = await apiService.getRatingsStats<RatingsStatsData>();
            setData(responseData);
        } catch (error) {
            setError('Failed to load ratings statistics');
        } finally {
            setLoading(false);
        }
    };

    usePageRefresh<RatingsStatsData>(setData);

    useEffect(() => {
        fetchRatingsStats();
        document.title = 'Ratings Statistics';
        return () => { document.title = 'College Football'; };
    }, []);

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress size={60} />
        </Box>
    );
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const stageText = data.info.stage === 'season'
        ? `Week ${data.info.currentWeek}`
        : data.info.stage === 'schedule non conference'
            ? 'Preseason'
            : 'End of season';

    const getPrestigeColor = (prestige: number) => {
        const colors = {
            1: '#8B4513', // Brown
            2: '#696969', // Dim Gray
            3: '#CD853F', // Peru
            4: '#DAA520', // Goldenrod
            5: '#FFD700', // Gold
            6: '#FFA500', // Orange
            7: '#FF0000'  // Red
        };
        return colors[prestige as keyof typeof colors] || '#000000';
    };

    const getPrestigeLabel = (prestige: number) => {
        const labels = {
            1: 'Tier 1',
            2: 'Tier 2', 
            3: 'Tier 3',
            4: 'Tier 4',
            5: 'Tier 5',
            6: 'Tier 6',
            7: 'Tier 7'
        };
        return labels[prestige as keyof typeof labels] || `Tier ${prestige}`;
    };

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Grid container spacing={4}>
                    {/* Prestige vs Stars Percentage Table */}
                    <Grid item xs={12}>
                        <Paper 
                            elevation={3} 
                            sx={{ 
                                borderRadius: 3,
                                overflow: 'hidden'
                            }}
                        >
                            <Box sx={{ p: 3, bgcolor: 'primary.main', color: 'white' }}>
                                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                    Star Distribution by Prestige Tier
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                                    Percentage breakdown of player star ratings within each prestige tier
                                </Typography>
                            </Box>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Prestige Tier
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Teams
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Avg Team Rating
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Avg Stars
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                5★
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                4★
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                3★
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                2★
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                1★
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.prestige_stars_table.slice().reverse().map((row, index) => {
                                            const teamCount = data.team_counts_by_prestige.find(t => t.prestige === row.prestige)?.team_count || 0;
                                            return (
                                                <TableRow 
                                                    key={row.prestige}
                                                    sx={{ 
                                                        '&:nth-of-type(odd)': { bgcolor: 'grey.25' },
                                                        '&:hover': { bgcolor: 'grey.100' }
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Chip 
                                                            label={getPrestigeLabel(row.prestige)}
                                                            sx={{ 
                                                                backgroundColor: getPrestigeColor(row.prestige),
                                                                color: 'white',
                                                                fontWeight: 600,
                                                                fontSize: '0.9rem',
                                                                px: 1
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                            {teamCount}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                        {row.avg_rating}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                                                        {row.avg_stars}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 500, color: 'success.main' }}>
                                                        {row.star_percentages[5]}%
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 500, color: 'info.main' }}>
                                                        {row.star_percentages[4]}%
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 500 }}>
                                                        {row.star_percentages[3]}%
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 500 }}>
                                                        {row.star_percentages[2]}%
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 500 }}>
                                                        {row.star_percentages[1]}%
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                    {/* Total Star Counts Table */}
                    <Grid item xs={12}>
                        <Paper 
                            elevation={3} 
                            sx={{ 
                                borderRadius: 3,
                                overflow: 'hidden',
                                height: 'fit-content'
                            }}
                        >
                            <Box sx={{ p: 3, bgcolor: 'secondary.main', color: 'white' }}>
                                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                    Total Players by Star Rating
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                                    Overall distribution across all teams
                                </Typography>
                            </Box>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Star Rating
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Players
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                Avg Player Rating
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[5, 4, 3, 2, 1].map((star) => (
                                            <TableRow 
                                                key={star}
                                                sx={{ 
                                                    '&:nth-of-type(odd)': { bgcolor: 'grey.25' },
                                                    '&:hover': { bgcolor: 'grey.100' }
                                                }}
                                            >
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {[...Array(star)].map((_, i) => (
                                                            <Typography key={i} variant="body1" color="gold" sx={{ fontSize: '1.2rem' }}>
                                                                ★
                                                            </Typography>
                                                        ))}
                                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                            {star} Star{star > 1 ? 's' : ''}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                        {data.total_star_counts.counts[star].toLocaleString()}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                                        {data.total_star_counts.avg_ratings[star]}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>

            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

export default RatingsStats;
