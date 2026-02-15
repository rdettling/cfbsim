import { dataService } from '../services/data';
import { Team, Info, Conference, Player } from '../interfaces';
import {
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Card,
    CardContent,
    Chip,
} from '@mui/material';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';
import { getPlayerRoute } from '../services/data';

interface RosterCutsData {
    info: Info & { lastWeek: number };
    team: Team;
    cuts: Player[];
    conferences: Conference[];
}

const RosterCuts = () => {
    const { data, loading, error } = useDataFetching({
        fetchFunction: () => dataService.getRosterCuts<RosterCutsData>(),
        autoRefreshOnGameChange: true
    });

    const totalCuts = data?.cuts.length || 0;

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
        >
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
                Roster Cuts
            </Typography>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6">Players Cut</Typography>
                        <Chip label={`${totalCuts} players`} color="warning" size="small" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Cuts are based on projected ratings and position limits.
                    </Typography>
                </CardContent>
            </Card>

            {totalCuts > 0 ? (
                <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'warning.main' }}>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Year</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Position</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Projected</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data?.cuts.map((player) => (
                                <TableRow key={player.id} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                                    <TableCell>
                                        <Box
                                            component="a"
                                            href={getPlayerRoute(player.id.toString())}
                                            sx={{
                                                textDecoration: 'none',
                                                color: 'primary.main',
                                                fontWeight: 'bold',
                                                '&:hover': { textDecoration: 'underline' }
                                            }}
                                        >
                                            {player.first} {player.last}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={player.year?.toUpperCase() || ''}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={player.pos}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                        {player.rating}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                        {player.rating_sr}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No cuts needed
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Your roster is within position limits.
                    </Typography>
                </Box>
            )}
        </PageLayout>
    );
};

export default RosterCuts;
