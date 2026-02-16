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
import { TeamInfoModal, TeamLogo, TeamLink } from '../team/TeamComponents';
import type { GamePreviewProps } from '../../types/components';
import { resolveHomeAway, resolveTeamSide, formatMatchup } from '../../domain/utils/gameDisplay';

const GamePreview = ({ game }: GamePreviewProps) => {
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
                <TeamLogo name={team.name} size={80} />
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {rank > 0 && (
                            <Chip 
                                label={`#${rank}`} 
                                color="primary" 
                                size="small"
                                sx={{ fontWeight: 'bold' }} 
                            />
                        )}
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                            <TeamLink name={team.name} onTeamClick={handleTeamClick} />
                        </Typography>
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

    const { home, away, neutral } = resolveHomeAway(game);
    const awaySide = resolveTeamSide(game, away.id);
    const homeSide = resolveTeamSide(game, home.id);
    const spreadText = awaySide.spread
        ? `${away.abbreviation || away.name} ${awaySide.spread}`
        : `${home.abbreviation || home.name} ${homeSide.spread ?? ''}`.trim();

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header Section */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h3" align="center" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {formatMatchup(home.name, away.name, neutral)}
                </Typography>
                <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 4 }}>
                    Week {game.weekPlayed} • {game.year}
                </Typography>

                {/* Team Matchup */}
                <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
                    <Grid container spacing={4} alignItems="center">
                        <Grid size={{ xs: 12, md: 5 }}>
                            {renderTeamInfo(away, awaySide.rank, String(awaySide.moneyline || ""))}
                        </Grid>

                        <Grid size={{ xs: 12, md: 2 }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                    {neutral ? 'VS' : 'AT'}
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

                        <Grid size={{ xs: 12, md: 5 }}>
                            {renderTeamInfo(home, homeSide.rank, String(homeSide.moneyline || ""), true)}
                        </Grid>
                    </Grid>
                </Paper>
            </Box>

            {/* Content Cards */}
            <Grid container spacing={4}>
                <Grid size={{ xs: 12 }}>
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', mb: 2 }}>
                                Preview Data
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Player stats and team comparisons are not available in the new architecture yet.
                            </Typography>
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
