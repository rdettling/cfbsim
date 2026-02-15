import { Box, Typography, Paper, Grid, Divider, Chip } from '@mui/material';
import { TeamLogo } from './TeamComponents';
import { TeamClickHandler } from '../interfaces';

interface ChampionshipPlayoffProps extends TeamClickHandler {
    playoffTeams: any[];
    bracket?: any;
}

const ChampionshipPlayoff = ({ playoffTeams, bracket, onTeamClick }: ChampionshipPlayoffProps) => {
    // Log bracket data for debugging
    console.log('ChampionshipPlayoff bracket:', bracket);
    
    const team1 = playoffTeams[0];
    const team2 = playoffTeams[1];
    
    // Get championship game data if available
    const championship = bracket?.championship;
    const hasResults = championship && (championship.score1 !== null || championship.score2 !== null);
    const winner = championship?.winner;
    const hasGameId = championship?.game_id !== undefined && championship?.game_id !== null;
    
    const handleGameClick = () => {
        if (hasGameId) {
            window.location.href = `/game/${championship.game_id}`;
        }
    };

    return (
        <Grid container spacing={4}>
            {/* Main Championship Section */}
            <Grid item xs={12} lg={8}>
                <Paper 
                    onClick={handleGameClick}
                    sx={{ 
                        p: 4, 
                        textAlign: 'center',
                        cursor: hasGameId ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        '&:hover': hasGameId ? {
                            boxShadow: 4,
                            borderColor: '#1976d2'
                        } : {}
                    }}
                >
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                        National Championship
                        {hasResults && winner && (
                            <Typography 
                                component="span" 
                                sx={{ 
                                    display: 'block',
                                    fontSize: '1rem',
                                    color: 'text.secondary',
                                    fontWeight: 'normal',
                                    mt: 1
                                }}
                            >
                                Champion: {winner}
                            </Typography>
                        )}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, mb: 4 }}>
                        {/* Team 1 */}
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                                <TeamLogo name={team1?.name} size={40} />
                                <Typography 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTeamClick(team1?.name || '');
                                    }}
                                    sx={{ 
                                        cursor: 'pointer', 
                                        fontWeight: 'bold',
                                        color: 'text.primary',
                                        fontSize: '1.5rem',
                                        '&:hover': { color: 'primary.main' }
                                    }}
                                >
                                    #{team1?.seed} {team1?.name}
                                </Typography>
                            </Box>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                {team1?.record}
                                {hasResults && championship?.score1 !== null && (
                                    <Typography 
                                        component="span" 
                                        sx={{ 
                                            display: 'block',
                                            fontWeight: winner === team1?.name ? 'bold' : 'normal',
                                            color: winner === team1?.name ? 'primary.main' : 'text.secondary',
                                            fontSize: '1.2rem',
                                            mt: 0.5
                                        }}
                                    >
                                        {championship.score1}
                                    </Typography>
                                )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Rank: #{team1?.ranking}
                            </Typography>
                            {team1?.is_autobid && (
                                <Chip 
                                    label="Automatic Bid" 
                                    color="primary" 
                                    size="small" 
                                    sx={{ mt: 1 }}
                                />
                            )}
                        </Box>

                        {/* VS */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                                VS
                            </Typography>
                            {hasResults && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Final
                                </Typography>
                            )}
                            {!hasResults && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    Championship Game
                                </Typography>
                            )}
                        </Box>

                        {/* Team 2 */}
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                                <TeamLogo name={team2?.name} size={40} />
                                <Typography 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTeamClick(team2?.name || '');
                                    }}
                                    sx={{ 
                                        cursor: 'pointer', 
                                        fontWeight: 'bold',
                                        color: 'text.primary',
                                        fontSize: '1.5rem',
                                        '&:hover': { color: 'primary.main' }
                                    }}
                                >
                                    #{team2?.seed} {team2?.name}
                                </Typography>
                            </Box>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                {team2?.record}
                                {hasResults && championship?.score2 !== null && (
                                    <Typography 
                                        component="span" 
                                        sx={{ 
                                            display: 'block',
                                            fontWeight: winner === team2?.name ? 'bold' : 'normal',
                                            color: winner === team2?.name ? 'primary.main' : 'text.secondary',
                                            fontSize: '1.2rem',
                                            mt: 0.5
                                        }}
                                    >
                                        {championship.score2}
                                    </Typography>
                                )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Rank: #{team2?.ranking}
                            </Typography>
                            {team2?.is_autobid && (
                                <Chip 
                                    label="Automatic Bid" 
                                    color="primary" 
                                    size="small" 
                                    sx={{ mt: 1 }}
                                />
                            )}
                        </Box>
                    </Box>

                    <Divider sx={{ my: 3 }} />
                    
                    {hasGameId && (
                        <Typography variant="body2" color="primary.main" sx={{ fontStyle: 'italic', mb: 2 }}>
                            Click anywhere to view game details
                        </Typography>
                    )}
                    
                    <Typography variant="body1" color="text.secondary">
                        The top two teams in the nation will face off for the national championship
                    </Typography>
                </Paper>
            </Grid>
        </Grid>
    );
};

export default ChampionshipPlayoff; 