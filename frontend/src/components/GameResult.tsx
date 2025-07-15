import { useState } from 'react';
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
    Card,
    CardContent,
    Chip,
    Stack,
    Link as MuiLink,
} from '@mui/material';
import { TeamLogo, TeamLink, TeamInfoModal } from './TeamComponents';
import { GamePreviewData } from '../interfaces';

interface GameResultProps {
    data: GamePreviewData;
}

// Helper component for team header in game result
const TeamHeader = ({ 
    team, 
    rank, 
    score, 
    result, 
    onTeamClick 
}: { 
    team: { name: string }, 
    rank: number, 
    score: number, 
    result: string,
    onTeamClick: (name: string) => void
}) => (
    <Box sx={{ textAlign: 'center', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 2 }}>
            <TeamLogo name={team.name} size={80} />
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, justifyContent: 'center' }}>
                    <Chip 
                        label={`#${rank}`} 
                        color="primary" 
                        size="medium"
                        sx={{ fontWeight: 'bold' }} 
                    />
                    <Box sx={{ 
                        cursor: 'pointer',
                        '&:hover': { color: 'primary.main' }
                    }}>
                        <TeamLink 
                            name={team.name} 
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                </Box>
                <Typography variant="h1" sx={{ 
                    fontWeight: 'bold', 
                    color: result === 'W' ? 'success.main' : 'error.main', 
                    mb: 1 
                }}>
                    {score}
                </Typography>
                <Chip 
                    label={result} 
                    color={result === 'W' ? 'success' : 'error'}
                    size="medium"
                    sx={{ fontWeight: 'bold' }}
                />
            </Box>
        </Box>
    </Box>
);

// Helper component for drive summary
const DriveSummary = ({ drives }: { drives: any[] }) => (
    <Card elevation={2} sx={{ height: '100%' }}>
        <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Drive Summary
            </Typography>
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {drives.map((drive, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TeamLogo name={drive.offense} size={20} />
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    {drive.offense}
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                {drive.result.split(' ').map((word: string) => 
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                            <Typography variant="body2" sx={{ 
                                fontWeight: 'bold', 
                                color: drive.points > 0 ? 'success.main' : 'text.secondary' 
                            }}>
                                {drive.points > 0 ? `+${drive.points} pts` : 'No score'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {drive.scoreAAfter}-{drive.scoreBAfter}
                            </Typography>
                        </Box>
                    </Box>
                ))}
            </Box>
        </CardContent>
    </Card>
);

// Helper component for team statistics
const TeamStatistics = ({ 
    stats, 
    teamA, 
    teamB 
}: { 
    stats: Record<string, any>, 
    teamA: { name: string }, 
    teamB: { name: string }
}) => (
    <Card elevation={2} sx={{ height: '100%' }}>
        <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Team Statistics
            </Typography>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Stat</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                                <TeamLogo name={teamA.name} size={24} />
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                                <TeamLogo name={teamB.name} size={24} />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.entries(stats).map(([statName, values]) => (
                            <TableRow key={statName}>
                                <TableCell sx={{ fontWeight: 'bold' }}>
                                    {statName.split(' ').map((word: string) => 
                                        word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                </TableCell>
                                <TableCell align="center">
                                    {values.teamA}
                                </TableCell>
                                <TableCell align="center">
                                    {values.teamB}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </CardContent>
    </Card>
);

// Helper component for player performance card
const PlayerCard = ({ player, stats }: { player: any, stats: string }) => (
    <Box sx={{ 
        p: 2, 
        bgcolor: 'grey.50', 
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'grey.200'
    }}>
        <MuiLink 
            href={`/players/${player.player_id}`} 
            sx={{ textDecoration: 'none', color: 'primary.main' }}
        >
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {player.game_log_string.split(': ')[0].split(' (')[0]}
            </Typography>
        </MuiLink>
        <Typography variant="body2" color="text.secondary">
            {stats}
        </Typography>
    </Box>
);

// Helper component for team player performance section
const TeamPlayerPerformance = ({ 
    teamName, 
    game_logs, 
    filterTeamName 
}: { 
    teamName: string, 
    game_logs: Record<string, any[]>, 
    filterTeamName: string 
}) => (
    <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TeamLogo name={teamName} size={24} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {teamName}
            </Typography>
        </Box>
        <Stack spacing={2}>
            {Object.entries(game_logs).map(([category, players]) => {
                const teamPlayers = players.filter(p => 
                    p.team_name === filterTeamName && 
                    !p.game_log_string.includes('0 catches, 0 yards, 0 TDs')
                );
                
                if (teamPlayers.length === 0) return null;
                
                return (
                    <Box key={category}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                            {category}
                        </Typography>
                        <Stack spacing={1}>
                            {teamPlayers.map((player, index) => (
                                <PlayerCard 
                                    key={index}
                                    player={player}
                                    stats={player.game_log_string.split(': ')[1]}
                                />
                            ))}
                        </Stack>
                    </Box>
                );
            })}
        </Stack>
    </Box>
);

const GameResult = ({ data }: GameResultProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const { game, drives = [], stats = {}, game_logs = {} } = data;

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            {/* Game Header */}
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {game.name || game.base_label}
                </Typography>
                <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 3 }}>
                    Week {game.weekPlayed} • {game.year}{game.overtime && game.overtime > 0 ? ` • ${game.overtime}OT` : ''}
                </Typography>

                {/* Final Score */}
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={5}>
                        <TeamHeader 
                            team={game.teamA} 
                            rank={game.rankATOG} 
                            score={game.scoreA || 0} 
                            result={game.resultA || 'L'}
                            onTeamClick={handleTeamClick}
                        />
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Typography variant="h3" align="center" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                            FINAL
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={5}>
                        <TeamHeader 
                            team={game.teamB} 
                            rank={game.rankBTOG} 
                            score={game.scoreB || 0} 
                            result={game.resultB || 'L'}
                            onTeamClick={handleTeamClick}
                        />
                    </Grid>
                </Grid>

                {/* Game Headline */}
                {game.headline && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body1" align="center" sx={{ fontStyle: 'italic' }}>
                            {game.headline}
                        </Typography>
                    </Box>
                )}
            </Paper>

            <Grid container spacing={3}>
                {/* Drives Summary */}
                {drives.length > 0 && (
                    <Grid item xs={12} md={6}>
                        <DriveSummary drives={drives} />
                    </Grid>
                )}

                {/* Team Stats */}
                {Object.keys(stats).length > 0 && (
                    <Grid item xs={12} md={drives.length > 0 ? 6 : 12}>
                        <TeamStatistics 
                            stats={stats}
                            teamA={game.teamA}
                            teamB={game.teamB}
                        />
                    </Grid>
                )}

                {/* Player Performance */}
                {Object.keys(game_logs).length > 0 && (
                    <Grid item xs={12}>
                        <Card elevation={2}>
                            <CardContent>
                                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    Player Performance
                                </Typography>
                                
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <TeamPlayerPerformance 
                                            teamName={game.teamA.name}
                                            game_logs={game_logs}
                                            filterTeamName={game.teamA.name}
                                        />
                                    </Grid>
                                    
                                    <Grid item xs={12} md={6}>
                                        <TeamPlayerPerformance 
                                            teamName={game.teamB.name}
                                            game_logs={game_logs}
                                            filterTeamName={game.teamB.name}
                                        />
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>

            <TeamInfoModal 
                teamName={selectedTeam} 
                open={modalOpen} 
                onClose={() => setModalOpen(false)} 
            />
        </Container>
    );
};

export default GameResult;
