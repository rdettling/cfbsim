import { Box, Typography, Paper } from '@mui/material';
import { TeamClickHandler } from '../interfaces';
import { Matchup, Championship } from './PlayoffComponents';

interface FourTeamPlayoffProps extends TeamClickHandler {
    playoffTeams: any[];
    bracket?: any;
}

const FourTeamPlayoff = ({ playoffTeams, bracket, onTeamClick }: FourTeamPlayoffProps) => {
    // Log bracket data for debugging
    console.log('FourTeamPlayoff bracket:', bracket);
    return (
        <Box>
            {/* Playoff Bracket - Full Width */}
            <Paper sx={{ p: 4, borderRadius: 2, overflow: 'auto' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4, textAlign: 'center' }}>
                    4-Team Playoff Bracket
                </Typography>
                
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 1000
                }}>
                    {/* Left Side - Semifinal 1 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                fontWeight: 'bold', 
                                textAlign: 'center',
                                color: '#1976d2',
                                fontSize: '1rem'
                            }}
                        >
                            Semifinal
                        </Typography>
                        
                        <Matchup 
                            matchup={bracket?.semifinals?.[0] || {
                                team1: playoffTeams[0]?.name,
                                team2: playoffTeams[3]?.name,
                                seed1: 1,
                                seed2: 4
                            }}
                            direction="left"
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                    
                    {/* Center - Championship */}
                    <Championship 
                        championship={bracket?.championship || {
                            team1: "TBD",
                            team2: "TBD"
                        }}
                        onTeamClick={onTeamClick}
                    />
                    
                    {/* Right Side - Semifinal 2 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                fontWeight: 'bold', 
                                textAlign: 'center',
                                color: '#1976d2',
                                fontSize: '1rem'
                            }}
                        >
                            Semifinal
                        </Typography>
                        
                        <Matchup 
                            matchup={bracket?.semifinals?.[1] || {
                                team1: playoffTeams[1]?.name,
                                team2: playoffTeams[2]?.name,
                                seed1: 2,
                                seed2: 3
                            }}
                            direction="right"
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default FourTeamPlayoff; 