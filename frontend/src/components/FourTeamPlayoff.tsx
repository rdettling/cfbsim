import { Box, Typography, Paper, Grid, List, ListItem, Chip } from '@mui/material';

interface PlayoffTeam {
    name: string;
    seed?: number;
    ranking: number;
    record: string;
    is_autobid: boolean;
}

interface FourTeamPlayoffProps {
    playoffTeams: PlayoffTeam[];
    bubbleTeams: any[];
    conferenceChampions: any[];
}

const FourTeamPlayoff = ({ playoffTeams, bubbleTeams, conferenceChampions }: FourTeamPlayoffProps) => {
    return (
        <Grid container spacing={3}>
            {/* Playoff Bracket */}
            <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h5" gutterBottom>Playoff Bracket</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Typography variant="h6" gutterBottom>Semifinals</Typography>
                            <Paper sx={{ p: 2, mb: 1, minHeight: 80 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold'
                                    }}>
                                        #1 {playoffTeams[0]?.name}
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold'
                                    }}>
                                        #4 {playoffTeams[3]?.name}
                                    </Box>
                                </Box>
                            </Paper>
                            <Paper sx={{ p: 2, mb: 1, minHeight: 80 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold'
                                    }}>
                                        #2 {playoffTeams[1]?.name}
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold'
                                    }}>
                                        #3 {playoffTeams[2]?.name}
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography variant="h6" gutterBottom>Championship</Typography>
                            <Paper sx={{ p: 2, mb: 1, minHeight: 80 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold',
                                        color: '#666'
                                    }}>
                                        TBD
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold',
                                        color: '#666'
                                    }}>
                                        TBD
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                </Paper>
            </Grid>

            {/* Sidebar Information */}
            <Grid item xs={12} lg={4}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Playoff Teams */}
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Playoff Teams</Typography>
                        <List dense>
                            {playoffTeams.slice(0, 4).map((team) => (
                                <ListItem key={team.name} sx={{ py: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <Typography variant="body2" sx={{ minWidth: 30 }}>
                                            #{team.seed}
                                        </Typography>
                                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                            {team.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ minWidth: 60 }}>
                                            {team.record}
                                        </Typography>
                                        {team.is_autobid && (
                                            <Chip 
                                                label="Auto" 
                                                color="primary" 
                                                size="small" 
                                                sx={{ ml: 1 }}
                                            />
                                        )}
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>

                    {/* Bubble Teams */}
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Bubble Teams</Typography>
                        <List dense>
                            {bubbleTeams.map((team) => (
                                <ListItem key={team.name} sx={{ py: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <Typography variant="body2" sx={{ minWidth: 40 }}>
                                            #{team.ranking}
                                        </Typography>
                                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                            {team.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ minWidth: 60 }}>
                                            {team.record}
                                        </Typography>
                                        <Typography variant="body2" sx={{ minWidth: 80 }}>
                                            {team.conference}
                                        </Typography>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>

                    {/* Conference Champions */}
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Conference Champions</Typography>
                        <List dense>
                            {conferenceChampions.map((team) => (
                                <ListItem key={team.name} sx={{ py: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <Typography variant="body2" sx={{ minWidth: 40 }}>
                                            #{team.ranking}
                                        </Typography>
                                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                            {team.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ minWidth: 60 }}>
                                            {team.record}
                                        </Typography>
                                        {team.seed && (
                                            <Chip 
                                                label={team.seed <= 4 
                                                    ? `Seed #${team.seed}` 
                                                    : 'Playoff'
                                                }
                                                color={team.seed <= 4 ? 'primary' : 'success'}
                                                size="small"
                                                sx={{ ml: 1 }}
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

export default FourTeamPlayoff; 