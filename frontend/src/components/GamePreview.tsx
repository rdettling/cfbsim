import { useState } from 'react';
import { Game, Player } from '../interfaces';
import {
    Container,
    Typography,
    Box,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Link as MuiLink,
    Card,
    CardContent,
    Chip,
} from '@mui/material';
import { TeamInfoModal } from './TeamComponents';

interface GamePreviewProps {
    game: Game;
    top_players: Player[][];
}

const GamePreview = ({ game, top_players }: GamePreviewProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    // Helper function to render team info
    const renderTeamInfo = (team: any, rank: number, moneyline: string, isReversed = false) => {
        const content = (
            <>
                <Box
                    component="img"
                    src={`/logos/teams/${team.name}.png`}
                    sx={{ width: 80, height: 80 }}
                    alt={team.name}
                />
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip 
                            label={`#${rank}`} 
                            color="primary" 
                            size="small"
                            sx={{ fontWeight: 'bold' }} 
                        />
                        <MuiLink
                            component="button"
                            onClick={() => handleTeamClick(team.name)}
                            sx={{ 
                                cursor: 'pointer', 
                                textDecoration: 'none', 
                                fontWeight: 'bold',
                                color: 'text.primary',
                                '&:hover': { 
                                    textDecoration: 'underline',
                                    color: 'primary.main'
                                }
                            }}
                        >
                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                {team.name}
                            </Typography>
                        </MuiLink>
                    </Box>
                    <Typography variant="subtitle1" color="text.secondary">
                        {team.conference}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {moneyline}
                    </Typography>
                </Box>
            </>
        );

        return (
            <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 2, 
                    mb: 2,
                    flexDirection: isReversed ? 'row-reverse' : 'row'
                }}>
                    {content}
                </Box>
            </Box>
        );
    };

    // Helper function to render player cards
    const renderPlayerCard = (player: Player, index: number) => (
        <Box key={index} sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
            <MuiLink 
                href={`/players/${player.id}`} 
                sx={{ textDecoration: 'none', color: 'primary.main' }}
            >
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {player.first} {player.last}
                </Typography>
            </MuiLink>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                <Chip 
                    label={player.pos} 
                    size="small" 
                    variant="outlined"
                />
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {player.rating}
                </Typography>
            </Box>
        </Box>
    );

    // Helper function to render team column header
    const renderTeamHeader = (team: any) => (
        <TableCell align="center">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Box
                    component="img"
                    src={`/logos/teams/${team.name}.png`}
                    sx={{ width: 20, height: 20 }}
                    alt={team.name}
                />
                <MuiLink
                    component="button"
                    onClick={() => handleTeamClick(team.name)}
                    sx={{ 
                        cursor: 'pointer', 
                        textDecoration: 'none', 
                        fontWeight: 'bold',
                        color: 'text.primary',
                        '&:hover': { 
                            textDecoration: 'underline',
                            color: 'primary.main'
                        }
                    }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {team.abbreviation || team.name}
                    </Typography>
                </MuiLink>
            </Box>
        </TableCell>
    );

    // Helper function to render stats row
    const renderStatsRow = (label: string, statKey: keyof NonNullable<typeof game.teamA.stats>) => (
        <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>{label}</TableCell>
            <TableCell align="center">
                {game.teamA.stats?.[statKey]?.value} (#{game.teamA.stats?.[statKey]?.rank})
            </TableCell>
            <TableCell align="center">
                {game.teamB.stats?.[statKey]?.value} (#{game.teamB.stats?.[statKey]?.rank})
            </TableCell>
        </TableRow>
    );

    const spreadText = game.spreadA < 0 
        ? `${game.teamA.abbreviation || game.teamA.name} ${game.spreadA}` 
        : `${game.teamB.abbreviation || game.teamB.name} ${game.spreadB}`;

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header Section */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h3" align="center" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {game.label}
                </Typography>
                <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 4 }}>
                    Week {game.weekPlayed} • {game.year}
                </Typography>

                {/* Team Matchup */}
                <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
                    <Grid container spacing={4} alignItems="center">
                        <Grid item xs={12} md={5}>
                            {renderTeamInfo(game.teamA, game.rankATOG, String(game.moneylineA || ""))}
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    VS
                                </Typography>
                                <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                        SPREAD
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                        {spreadText}
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={5}>
                            {renderTeamInfo(game.teamB, game.rankBTOG, String(game.moneylineB || ""), true)}
                        </Grid>
                    </Grid>
                </Paper>
            </Box>

            {/* Content Cards */}
            <Grid container spacing={4}>
                {/* Key Players */}
                <Grid item xs={12} md={6}>
                    <Card elevation={2} sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
                                Key Players
                            </Typography>
                            <Grid container spacing={2}>
                                {[game.teamA, game.teamB].map((team, teamIndex) => (
                                    <Grid item xs={6} key={teamIndex}>
                                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                                            <Box
                                                component="img"
                                                src={`/logos/teams/${team.name}.png`}
                                                sx={{ width: 40, height: 40, mb: 1 }}
                                                alt={team.name}
                                            />
                                            <MuiLink
                                                component="button"
                                                onClick={() => handleTeamClick(team.name)}
                                                sx={{ 
                                                    cursor: 'pointer', 
                                                    textDecoration: 'none', 
                                                    fontWeight: 'bold',
                                                    color: 'text.primary',
                                                    '&:hover': { 
                                                        textDecoration: 'underline',
                                                        color: 'primary.main'
                                                    }
                                                }}
                                            >
                                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                                    {team.abbreviation || team.name}
                                                </Typography>
                                            </MuiLink>
                                        </Box>
                                        {top_players[teamIndex].slice(0, 5).map(renderPlayerCard)}
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Team Stats */}
                <Grid item xs={12} md={6}>
                    <Card elevation={2} sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 3 }}>
                                Team Statistics
                            </Typography>
                            
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell></TableCell>
                                            {renderTeamHeader(game.teamA)}
                                            {renderTeamHeader(game.teamB)}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {renderStatsRow('Offensive YPG', 'offensive_ypg')}
                                        {renderStatsRow('Defensive YPG', 'defensive_ypg')}
                                        {renderStatsRow('Points Per Game', 'points_per_game')}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            
            <TeamInfoModal 
                teamName={selectedTeam} 
                open={modalOpen} 
                onClose={() => setModalOpen(false)} 
            />
        </Container>
    );
};

export default GamePreview;