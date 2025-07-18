import { Box, Typography, Paper, Grid, List, ListItem, Chip, Divider } from '@mui/material';

interface PlayoffTeam {
    name: string;
    seed?: number;
    ranking: number;
    record: string;
    is_autobid: boolean;
}

interface ChampionshipPlayoffProps {
    playoffTeams: PlayoffTeam[];
    bubbleTeams: any[];
    conferenceChampions: any[];
}

const ChampionshipPlayoff = ({ playoffTeams, bubbleTeams, conferenceChampions }: ChampionshipPlayoffProps) => {
    const team1 = playoffTeams[0];
    const team2 = playoffTeams[1];

    return (
        <Grid container spacing={4}>
            {/* Main Championship Section */}
            <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                        National Championship
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, mb: 4 }}>
                        {/* Team 1 */}
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                                #{team1?.seed} {team1?.name}
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                {team1?.record}
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
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Championship Game
                            </Typography>
                        </Box>

                        {/* Team 2 */}
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                                #{team2?.seed} {team2?.name}
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                {team2?.record}
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
                    
                    <Typography variant="body1" color="text.secondary">
                        The top two teams in the nation will face off for the national championship
                    </Typography>
                </Paper>
            </Grid>

            {/* Sidebar Information */}
            <Grid item xs={12} lg={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Championship Teams Summary */}
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Championship Teams
                        </Typography>
                        <List dense sx={{ py: 0 }}>
                            {playoffTeams.slice(0, 2).map((team) => (
                                <ListItem key={team.name} sx={{ py: 1, px: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 'bold', minWidth: 40 }}>
                                            #{team.seed}
                                        </Typography>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                                {team.name}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {team.record} • Rank #{team.ranking}
                                            </Typography>
                                        </Box>
                                        {team.is_autobid && (
                                            <Chip 
                                                label="Auto" 
                                                color="primary" 
                                                size="small"
                                            />
                                        )}
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>

                    {/* Next Best Teams */}
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Next Best Teams
                        </Typography>
                        <List dense sx={{ py: 0 }}>
                            {bubbleTeams.slice(0, 5).map((team) => (
                                <ListItem key={team.name} sx={{ py: 0.5, px: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <Typography variant="body2" sx={{ minWidth: 35, fontWeight: 'bold' }}>
                                            #{team.ranking}
                                        </Typography>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                {team.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {team.record} • {team.conference}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>

                    {/* Conference Champions */}
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Conference Champions
                        </Typography>
                        <List dense sx={{ py: 0 }}>
                            {conferenceChampions.slice(0, 6).map((team) => (
                                <ListItem key={team.name} sx={{ py: 0.5, px: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <Typography variant="body2" sx={{ minWidth: 35, fontWeight: 'bold' }}>
                                            #{team.ranking}
                                        </Typography>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                {team.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {team.record}
                                            </Typography>
                                        </Box>
                                        {team.seed && team.seed <= 2 && (
                                            <Chip 
                                                label={`Seed #${team.seed}`}
                                                color="primary" 
                                                size="small"
                                            />
                                        )}
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Box>
            </Grid>
        </Grid>
    );
};

export default ChampionshipPlayoff; 