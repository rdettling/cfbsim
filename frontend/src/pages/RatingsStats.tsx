import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { RatingsStatsData } from '../interfaces';
import { TeamInfoModal } from '../components/TeamComponents';
import {
    Container, Typography, TableContainer, Table, TableHead, TableBody,
    TableRow, TableCell, Paper, Box, CircularProgress, Alert, Chip, Grid
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

    const getPrestigeColor = (prestige: number) => ({
        1: '#696969', // Dim Gray (worst)
        2: '#808080', // Gray
        3: '#A9A9A9', // Dark Gray
        4: '#DAA520', // Goldenrod
        5: '#FFD700', // Gold
        6: '#FFA500', // Orange
        7: '#FF4500'  // Orange Red (best)
    }[prestige] || '#000000');

    const getPrestigeLabel = (prestige: number) => 
        `Tier ${prestige}`;

        // Helper components
    const StatsTable = ({ title, subtitle, bgColor, children }: any) => (
        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ p: 3, bgcolor: bgColor, color: 'white' }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>{title}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>{subtitle}</Typography>
            </Box>
            <TableContainer>{children}</TableContainer>
        </Paper>
    );

    const TableRowStyled = ({ children, ...props }: any) => (
        <TableRow 
            {...props}
            sx={{ 
                '&:nth-of-type(odd)': { bgcolor: 'grey.25' },
                '&:hover': { bgcolor: 'grey.100' },
                ...props.sx
            }}
        >
            {children}
        </TableRow>
    );

    const renderStars = (count: number) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {[...Array(count)].map((_, i) => (
                <Typography key={i} variant="body1" color="gold" sx={{ fontSize: '1.2rem' }}>★</Typography>
            ))}
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {count} Star{count > 1 ? 's' : ''}
            </Typography>
        </Box>
    );

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
                    {/* Left column - Tables */}
                    <Grid item xs={12} md={8}>
                        <Grid container spacing={4}>
                            {/* Prestige vs Stars Percentage Table */}
                            <Grid item xs={12}>
                                <StatsTable 
                                    title="Star Distribution by Prestige Tier"
                                    subtitle="Percentage breakdown of player star ratings within each prestige tier"
                                    bgColor="primary.main"
                                >
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                {['Prestige Tier', 'Teams', 'Avg Team Rating', 'Avg Stars', '5★', '4★', '3★', '2★', '1★'].map(header => (
                                                    <TableCell key={header} align={header !== 'Prestige Tier' ? 'center' : 'left'} sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                        {header}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.prestige_stars_table.slice().reverse().map((row) => {
                                                const teamCount = data.team_counts_by_prestige.find(t => t.prestige === row.prestige)?.team_count || 0;
                                                return (
                                                    <TableRowStyled key={row.prestige}>
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
                                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>{teamCount}</Typography>
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 600, color: 'primary.main' }}>{row.avg_rating}</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 600, color: 'secondary.main' }}>{row.avg_stars}</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 500, color: 'success.main' }}>{row.star_percentages[5]}%</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 500, color: 'info.main' }}>{row.star_percentages[4]}%</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 500 }}>{row.star_percentages[3]}%</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 500 }}>{row.star_percentages[2]}%</TableCell>
                                                        <TableCell align="center" sx={{ fontWeight: 500 }}>{row.star_percentages[1]}%</TableCell>
                                                    </TableRowStyled>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </StatsTable>
                            </Grid>

                            {/* Total Star Counts Table */}
                            <Grid item xs={12}>
                                <StatsTable 
                                    title="Total Players by Star Rating"
                                    subtitle="Overall distribution with year-specific average ratings"
                                    bgColor="secondary.main"
                                >
                                    <Table>
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                {['Star Rating', 'Players', 'Current Rating', 'Fr Rating', 'So Rating', 'Jr Rating', 'Sr Rating'].map(header => (
                                                    <TableCell key={header} align={header !== 'Star Rating' ? 'center' : 'left'} sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                                        {header}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {[5, 4, 3, 2, 1].map((star) => (
                                                <TableRowStyled key={star}>
                                                    <TableCell>{renderStars(star)}</TableCell>
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
                                                    {['avg_ratings_fr', 'avg_ratings_so', 'avg_ratings_jr', 'avg_ratings_sr'].map(ratingKey => (
                                                        <TableCell key={ratingKey} align="center">
                                                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                                                                {data.total_star_counts[ratingKey as keyof typeof data.total_star_counts][star]}
                                                            </Typography>
                                                        </TableCell>
                                                    ))}
                                                </TableRowStyled>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </StatsTable>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Right column - Team Ratings List */}
                    <Grid item xs={12} md={4}>
                        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden', height: 'fit-content', position: 'sticky', top: 20 }}>
                            <Box sx={{ p: 3, bgcolor: 'success.main', color: 'white' }}>
                                <Typography variant="h5" sx={{ fontWeight: 600 }}>Team Ratings</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>All teams sorted by rating</Typography>
                            </Box>
                            <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                {['Rank', 'Team', 'Rating', 'Prestige'].map(header => (
                                                    <TableCell key={header} align={header !== 'Team' ? 'center' : 'left'} sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                        {header}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.teams.map((team, index) => (
                                                <TableRowStyled key={team.name}>
                                                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>#{index + 1}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{team.name}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>{team.rating}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Chip 
                                                            label={`Tier ${team.prestige}`}
                                                            size="small"
                                                            sx={{ 
                                                                backgroundColor: getPrestigeColor(team.prestige),
                                                                color: 'white',
                                                                fontWeight: 600,
                                                                fontSize: '0.7rem'
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRowStyled>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>

            <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

export default RatingsStats;
