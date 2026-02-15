import { useState } from 'react';
import {
    Container,
    Typography,
    Box,
    Grid,
    Paper,
    Card,
    CardContent,
    Chip,
} from '@mui/material';
import { TeamLogo, TeamLink, TeamInfoModal } from '../team/TeamComponents';
import DriveSummary from './DriveSummary';
import type { GameResultProps } from '../../types/components';

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


const GameResult = ({ data }: GameResultProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const { game, drives = [] } = data;

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
                        <DriveSummary 
                            drives={drives}
                            variant="page"
                        />
                    </Grid>
                )}

                {!drives.length && (
                    <Grid item xs={12}>
                        <Card elevation={2}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    Game Data
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Drive and player detail will appear once drive data is available.
                                </Typography>
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
