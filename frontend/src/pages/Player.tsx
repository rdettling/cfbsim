import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import type { Player } from '../interfaces';
import { Team, Info, Conference } from '../interfaces';
import { TeamInfoModal, TeamLogo } from '../components/TeamComponents';
import { TeamLink } from '../components/TeamComponents';
import {
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableRow
} from '@mui/material';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface PlayerData {
    info: Info;
    team: Team;
    player: Player;
    conferences: Conference[];
}

const Player = () => {
    const { playerId } = useParams();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            if (!playerId) throw new Error('No player ID provided');
            return apiService.getPlayer<PlayerData>(playerId);
        },
        dependencies: [playerId],
        autoRefreshOnGameChange: true
    });

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const player = data?.player;

    return (
        <PageLayout 
            loading={loading} 
            error={error}
            navbarData={data ? {
                team: data.team,
                currentStage: data.info.stage,
                info: data.info,
                conferences: data.conferences
            } : undefined}
            containerMaxWidth="lg"
        >
            {data && player && (
                <>
                    <Card elevation={3} sx={{ mb: 4 }}>
                        <CardContent>
                            <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} md={8}>
                                <Typography variant="h3" fontWeight="bold" gutterBottom>
                                    {player.first} {player.last}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <TeamLogo name={player.team} size={40} />
                                    <TeamLink name={player.team} onTeamClick={handleTeamClick} />
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Chip label={`${player.pos} • ${player.year}`} color="primary" />
                                    <Chip label={`Overall: ${player.rating}`} color="secondary" />
                                    {player.stars > 0 && <Chip label={`${player.stars}★`} color="warning" />}
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h4" fontWeight="bold" color="primary">
                                        {player.rating}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Overall Rating
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                        </CardContent>
                    </Card>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Player Information
                                    </Typography>
                                <Table size="small">
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Position</TableCell>
                                            <TableCell>{player.pos}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Class</TableCell>
                                            <TableCell>{player.year}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Stars</TableCell>
                                            <TableCell>{player.stars}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Development</TableCell>
                                            <TableCell>{player.development_trait}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Starter</TableCell>
                                            <TableCell>{player.starter ? 'Yes' : 'No'}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card elevation={2}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Ratings by Year
                                    </Typography>
                                <Table size="small">
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Freshman</TableCell>
                                            <TableCell>{player.rating_fr}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Sophomore</TableCell>
                                            <TableCell>{player.rating_so}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Junior</TableCell>
                                            <TableCell>{player.rating_jr}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Senior</TableCell>
                                            <TableCell>{player.rating_sr}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        </Grid>
                    </Grid>

                    <TeamInfoModal
                        teamName={selectedTeam}
                        open={modalOpen}
                        onClose={() => setModalOpen(false)}
                    />
                </>
            )}
        </PageLayout>
    );
};

export default Player;
