import { Box, Typography, Paper, Grid, List, ListItem, Chip, Link as MuiLink } from '@mui/material';
import { TeamLogo } from './TeamComponents';
import { PlayoffTeam, TeamClickHandler } from '../interfaces';

interface FourTeamPlayoffProps extends TeamClickHandler {
    playoffTeams: PlayoffTeam[];
    bubbleTeams: any[];
    conferenceChampions: any[];
}

const FourTeamPlayoff = ({ playoffTeams, bubbleTeams, conferenceChampions, onTeamClick }: FourTeamPlayoffProps) => {
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
                                        <TeamLogo name={playoffTeams[0]?.name} size={20} />
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(playoffTeams[0]?.name || '')}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            #1 {playoffTeams[0]?.name}
                                        </MuiLink>
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold'
                                    }}>
                                        <TeamLogo name={playoffTeams[3]?.name} size={20} />
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(playoffTeams[3]?.name || '')}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            #4 {playoffTeams[3]?.name}
                                        </MuiLink>
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
                                        <TeamLogo name={playoffTeams[1]?.name} size={20} />
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(playoffTeams[1]?.name || '')}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            #2 {playoffTeams[1]?.name}
                                        </MuiLink>
                                    </Box>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1,
                                        fontWeight: 'bold'
                                    }}>
                                        <TeamLogo name={playoffTeams[2]?.name} size={20} />
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(playoffTeams[2]?.name || '')}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            #3 {playoffTeams[2]?.name}
                                        </MuiLink>
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
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(team.name)}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                flexGrow: 1,
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            {team.name}
                                        </MuiLink>
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
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(team.name)}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                flexGrow: 1,
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            {team.name}
                                        </MuiLink>
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
                                        <MuiLink
                                            component="button"
                                            onClick={() => onTeamClick(team.name)}
                                            sx={{ 
                                                cursor: 'pointer', 
                                                textDecoration: 'none', 
                                                fontWeight: 'bold',
                                                color: 'text.primary',
                                                flexGrow: 1,
                                                '&:hover': { color: 'primary.main' }
                                            }}
                                        >
                                            {team.name}
                                        </MuiLink>
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