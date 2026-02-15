import { useState } from 'react';
import type { DashboardGameCardProps, DashboardTeamRowProps } from '../types/components';
import { TeamInfoModal, ConfLogo, TeamLogo } from '../components/team/TeamComponents';
import {
    Typography, Card, CardContent, Table,
    TableBody, TableCell, TableContainer, TableHead, Chip,
    TableRow, Paper, Box, Link as MuiLink, Button, Grid
} from '@mui/material';
import { useDomainData } from '../domain/hooks';
import { PageLayout } from '../components/layout/PageLayout';
import { loadDashboard } from '../domain/league';

// Game card with clickable team name
const GameCard = ({ game, type, onTeamClick }: DashboardGameCardProps) => {
    // Check if game has been played (either from last week or live-simmed this week)
    const isCompleted = game.result !== null && game.result !== undefined;
    const opponent = game.opponent;
    if (!opponent) return null;
    
    return (
        <Card elevation={3} sx={{ 
            mb: 2, 
            borderLeft: isCompleted ? 
                `5px solid ${game.result?.includes('W') ? 'green' : game.result?.includes('L') ? 'red' : 'grey'}` : 
                '5px solid #1976d2', 
            '&:hover': { transform: 'translateY(-3px)' },
            transition: 'transform 0.2s',
        }}>
            <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                    {type === 'prev' ? 'Last Week' : 'This Week'}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TeamLogo name={opponent.name} size={40} />
                        <Box>
                            <MuiLink
                                component="button"
                                onClick={() => onTeamClick(opponent.name)}
                                sx={{ cursor: 'pointer', textDecoration: 'none', fontWeight: 'bold' }}
                            >
                                {opponent.ranking > 0 ? `#${opponent.ranking} ` : ''}{opponent.name}
                            </MuiLink>
                            <Typography variant="body2" color="text.secondary">
                                {opponent.record}
                            </Typography>
                        </Box>
                    </Box>
                    
                    {isCompleted && (
                        <Chip 
                            label={game.result} 
                            color={game.result?.includes('W') ? 'success' : 'error'} 
                            size="medium"
                            sx={{ fontWeight: 'bold' }}
                        />
                    )}
                </Box>
                
                {isCompleted && (
                    <Box sx={{ textAlign: 'center', mb: 1 }}>
                        <Typography variant="h5" fontWeight="bold">{game.score}</Typography>
                    </Box>
                )}
                
                {!isCompleted && (
                    <Box sx={{ mb: 2, p: 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">Spread: <strong>{game.spread}</strong></Typography>
                            <Typography variant="body2">Moneyline: <strong>{game.moneyline}</strong></Typography>
                        </Box>
                    </Box>
                )}
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <MuiLink href={`/game/${game.id}`} sx={{ textDecoration: 'none' }}>
                        <Button size="small" variant="outlined">
                            {isCompleted ? 'Game Summary' : 'Game Preview'}
                        </Button>
                    </MuiLink>
                </Box>
            </CardContent>
        </Card>
    );
};

// Team row with clickable team name
const TeamRow = ({ team, showRating = false, rank, highlight = false, onTeamClick }: DashboardTeamRowProps) => (
    <TableRow 
        sx={{
            bgcolor: highlight ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
        }}
    >
        {rank !== undefined && <TableCell sx={{ fontWeight: 'bold', width: '40px' }}>{rank}</TableCell>}
        <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TeamLogo name={team.name} size={30} />
                <MuiLink
                    component="button"
                    onClick={() => onTeamClick(team.name)}
                    sx={{ cursor: 'pointer', textDecoration: 'none', fontWeight: team.ranking <= 25 ? 'bold' : 'normal' }}
                >
                    {team.ranking <= 25 && `#${team.ranking} `}{team.name}
                </MuiLink>
            </Box>
        </TableCell>
        {showRating && <TableCell align="center">{team.rating}</TableCell>}
        {showRating ? (
            <>
                <TableCell align="center">{team.confWins}-{team.confLosses}</TableCell>
                <TableCell align="center">{team.totalWins}-{team.totalLosses}</TableCell>
            </>
        ) : (
            <TableCell align="center">{team.totalWins}-{team.totalLosses}</TableCell>
        )}
    </TableRow>
);

const Dashboard = () => {
    // Modal state for team info
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const { data, loading, error } = useDomainData({
        fetcher: () => loadDashboard(),
    });

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const confName = data?.team.conference;
    const topGames = (data?.top_games ?? []) as Array<{ id: number; headline: string }>;

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences
            } : undefined}
            containerMaxWidth="xl"
        >
                {data && (
                    <>
                        {/* Team Header with Conference Logo */}
                        <Paper elevation={2} sx={{ mb: 4, p: 3, borderRadius: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12, md: 1 }}>
                                    <TeamLogo name={data.team.name} size={80} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 9 }}>
                                    <Typography variant="h3" fontWeight="bold" gutterBottom>
                                        {data.team.ranking > 0 && `#${data.team.ranking} `}{data.team.name} {data.team.mascot}
                                    </Typography>
                                    <Typography variant="h6">
                                        Record: <strong>{data.team.record}</strong>
                                    
                                        &nbsp;&nbsp;•&nbsp;&nbsp;Rating: <strong>{data.team.rating}</strong>
                                    </Typography>
                                </Grid>
                                {confName && (
                                    <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <ConfLogo name={confName} size={60} />
                                            <Typography variant="subtitle1" sx={{ mt: 1 }}>{confName}</Typography>
                                        </Box>
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>

                        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} gap={3}>
                            {/* Game Cards Section */}
                            <Box>
                                <Typography variant="h5" sx={{ mb: 2, borderBottom: '2px solid', borderColor: 'primary.main', pb: 1 }}>
                                    Games
                                </Typography>
                                {data.prev_game?.opponent && <GameCard game={data.prev_game} type="prev" onTeamClick={handleTeamClick} />}
                                {data.curr_game?.opponent && <GameCard game={data.curr_game} type="curr" onTeamClick={handleTeamClick} />}
                                {!data.prev_game?.opponent && !data.curr_game?.opponent && (
                                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                                        <Typography variant="body2" color="info.dark">No recent or upcoming games available</Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* Conference Standings Section */}
                            <TableContainer component={Paper} elevation={3}>
                                <Box sx={{ bgcolor: data.team.colorPrimary || 'primary.main', color: 'white', p: 2 }}>
                                    <Typography variant="h5" align="center">
                                        {confName ? `${confName} Standings` : 'Independent Teams'}
                                    </Typography>
                                </Box>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
                                            <TableCell>Team</TableCell>
                                            <TableCell align="center">Rating</TableCell>
                                            <TableCell align="center">Conf</TableCell>
                                            <TableCell align="center">Overall</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.confTeams.map(team => (
                                            <TeamRow 
                                                key={team.name} 
                                                team={team} 
                                                showRating 
                                                highlight={team.name === data.team.name}
                                                onTeamClick={handleTeamClick} 
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* AP Top 10 Section */}
                            <TableContainer component={Paper} elevation={3}>
                                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 2 }}>
                                    <Typography variant="h5" align="center">AP Top 10</Typography>
                                </Box>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
                                            <TableCell>Rank</TableCell>
                                            <TableCell>Team</TableCell>
                                            <TableCell align="center">Record</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.top_10.map((team, index) => (
                                            <TeamRow 
                                                key={team.name} 
                                                team={team} 
                                                rank={index + 1} 
                                                highlight={team.name === data.team.name}
                                                onTeamClick={handleTeamClick} 
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Top Games Section */}
                            <TableContainer component={Paper} elevation={3}>
                                <Box sx={{ bgcolor: 'success.main', color: 'white', p: 2 }}>
                                    <Typography variant="h5" align="center">Headlines</Typography>
                                </Box>
                                {topGames.length > 0 ? (
                                    <Box sx={{ p: 2 }}>
                                        {topGames.map((game) => (
                                            <Box 
                                                key={game.id}
                                                sx={{ 
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    mb: 1.5,
                                                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
                                                    p: 1,
                                                    borderRadius: 1
                                                }}
                                            >
                                                <Typography variant="body2" sx={{ mr: 1 }}>•</Typography>
                                                <Typography 
                                                    variant="body2"
                                                    component="a"
                                                    href={`/game/${game.id}`}
                                                    sx={{ 
                                                        cursor: 'pointer', 
                                                        textDecoration: 'none',
                                                        '&:hover': { textDecoration: 'underline' },
                                                        flex: 1,
                                                        color: 'primary.main'
                                                    }}
                                                >
                                                    {game.headline}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No games played yet
                                        </Typography>
                                    </Box>
                                )}
                            </TableContainer>
                        </Box>
                    </>
                )}
            
            <TeamInfoModal 
                teamName={selectedTeam} 
                open={modalOpen} 
                onClose={() => setModalOpen(false)} 
            />
        </PageLayout>
    );
};

export default Dashboard;
