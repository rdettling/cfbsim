import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { Team, Info, Conference, AwardSnapshot } from '../interfaces';
import { TeamLink, TeamLogo } from '../components/TeamComponents';
import {
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Paper,
    Box,
    Card,
    CardContent,
    Chip,
    Stack,
    Link as MuiLink} from '@mui/material';
import { TeamInfoModal } from '../components/TeamComponents';
import { PageLayout } from '../components/PageLayout';

interface SummaryData {
    info: Info;
    team: Team;
    conferences: Conference[];
    champion: Team; // Changed from championship to champion to match backend
    awards: AwardSnapshot[];
}

const SeasonSummary = () => {
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const responseData = await apiService.getSeasonSummary<SummaryData>();
                setData(responseData);
            } catch (error) {
                setError('Failed to load season summary');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, []);

    // Note: usePageRefresh was removed, manual refresh handling would need to be implemented if needed

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    const champion = data?.champion;
    const awards = data?.awards ?? [];

    const getAwardStatLine = (stats?: Record<string, any> | null) => stats?.stat_line ?? 'No stats yet';

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
            {data && (
                <>
                {/* Header Section */}
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {data.info.currentYear} Season Summary
                    </Typography>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        The season has concluded. Here's what happened.
                    </Typography>
                </Box>

                {/* Champion Section */}
                {champion && (
                    <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)', border: '3px solid #ffd700' }}>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 3 }}>
                                <TeamLogo name={champion.name} size={80} />
                                <Box>
                                    <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                                        NATIONAL CHAMPIONS
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#8B4513' }}>
                                        <TeamLink 
                                            name={champion.name} 
                                            onTeamClick={() => handleTeamClick(champion.name)}
                                        />
                                    </Typography>
                                </Box>
                            </Box>
                            <Chip 
                                label="🏆 CHAMPIONS" 
                                sx={{ 
                                    backgroundColor: '#8B4513', 
                                    color: 'white', 
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    py: 1
                                }} 
                            />
                        </CardContent>
                    </Card>
                )}

                {awards.length > 0 && (
                    <Card sx={{ mb: 4 }}>
                        <CardContent>
                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                                Award Winners
                            </Typography>
                            <Stack spacing={2}>
                                {awards.map(award => {
                                    const winner = award.first_place;
                                    return (
                                        <Box
                                            key={award.category_slug}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                pb: 2,
                                                '&:last-of-type': { borderBottom: 'none', pb: 0 }
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary">
                                                    {award.category_name}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {winner && <TeamLogo name={winner.team_name} size={32} />}
                                                    {winner ? (
                                                        <MuiLink
                                                            href={`/players/${winner.id}`}
                                                            underline="hover"
                                                            sx={{ fontWeight: 700 }}
                                                        >
                                                            {winner.first} {winner.last}
                                                        </MuiLink>
                                                    ) : (
                                                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                            TBD
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {getAwardStatLine(award.first_stats)}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" color="text.secondary">
                                                {winner?.pos || '--'}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </CardContent>
                    </Card>
                )}

                {/* Next Steps Section */}
                <Card sx={{ background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            What's Next?
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            The season is complete! You can now progress to the next year to see how your players develop 
                            and prepare for the upcoming season.
                        </Typography>
                    </CardContent>
                </Card>

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

export default SeasonSummary;
