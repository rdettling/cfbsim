import { Box, Typography, Paper } from '@mui/material';
import { TeamClickHandler } from '../interfaces';
import { BracketRound, Championship } from './PlayoffComponents';

interface TwelveTeamPlayoffProps extends TeamClickHandler {
    bracket: any;
}

const TwelveTeamPlayoff = ({ bracket, onTeamClick }: TwelveTeamPlayoffProps) => {
    return (
        <Box>
            {/* Playoff Bracket - Full Width */}
            <Paper sx={{ p: 4, borderRadius: 2, overflow: 'auto' }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4, textAlign: 'center' }}>
                    12-Team Playoff Bracket
                </Typography>
                
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minWidth: 1200,
                    gap: 8
                }}>
                    {/* Left Bracket */}
                    <Box sx={{ display: 'flex', gap: 6, flex: 1 }}>
                        <BracketRound 
                            title="First Round" 
                            matchups={bracket.left_bracket?.first_round || []}
                            direction="left"
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="Quarterfinals" 
                            matchups={bracket.left_bracket?.quarterfinals || []}
                            direction="left"
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="Semifinal" 
                            matchups={[bracket.left_bracket?.semifinal || {}]}
                            direction="left"
                            centerAlign={true}
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                    
                    {/* Championship */}
                    <Championship championship={bracket.championship} onTeamClick={onTeamClick} />
                    
                    {/* Right Bracket */}
                    <Box sx={{ display: 'flex', gap: 6, flex: 1 }}>
                        <BracketRound 
                            title="Semifinal" 
                            matchups={[bracket.right_bracket?.semifinal || {}]}
                            direction="right"
                            centerAlign={true}
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="Quarterfinals" 
                            matchups={bracket.right_bracket?.quarterfinals || []}
                            direction="right"
                            onTeamClick={onTeamClick}
                        />
                        <BracketRound 
                            title="First Round" 
                            matchups={bracket.right_bracket?.first_round || []}
                            direction="right"
                            onTeamClick={onTeamClick}
                        />
                    </Box>
                    </Box>
                </Paper>
            </Box>
    );
};

export default TwelveTeamPlayoff; 