import { useState, useEffect } from 'react';
import { dataService } from '../services/data';
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
import Grid from '@mui/material/Grid';
import { TeamInfoModal } from '../components/TeamComponents';
import { PageLayout } from '../components/PageLayout';

interface SummaryData {
    info: Info;
    team: Team;
    conferences: Conference[];
    champion: Team; // Changed from championship to champion to match backend
    awards: AwardSnapshot[];
    teams: Team[];
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
                const responseData = await dataService.getSeasonSummary<SummaryData>();
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
    const prestigeChanges = (data?.teams ?? [])
        .slice()
        .sort((a, b) => {
            const changeA = a.prestige_change ?? 0;
            const changeB = b.prestige_change ?? 0;
            if (changeA !== changeB) {
                return changeB - changeA;
            }
            return a.name.localeCompare(b.name);
        });

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
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 0.5 }}>
                            {data.info.currentYear} Season Summary
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Champions, awards, and prestige movement in one view.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateRows: { xs: 'minmax(0, 1fr) minmax(0, 1fr)', md: 'minmax(0, 0.45fr) minmax(0, 0.55fr)' },
                            gap: 2,
                            height: { xs: 'auto', md: 'calc(100vh - 220px)' },
                            minHeight: { md: 520 },
                        }}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' },
                                gap: 2,
                                minHeight: 0,
                            }}
                        >
                            <Card sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                <CardContent sx={{ height: '100%' }}>
                                    <Typography variant="overline" color="text.secondary">
                                        National Champions
                                    </Typography>
                                    {champion ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                            <TeamLogo name={champion.name} size={56} />
                                            <Box>
                                                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                                    <TeamLink
                                                        name={champion.name}
                                                        onTeamClick={() => handleTeamClick(champion.name)}
                                                    />
                                                </Typography>
                                                <Chip
                                                    label="🏆 Title Winners"
                                                    sx={{
                                                        mt: 1,
                                                        backgroundColor: '#2f2a1f',
                                                        color: '#f7d26a',
                                                        fontWeight: 700,
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                                            Championship data is not available yet.
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>

                            <Card sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                <CardContent sx={{ height: '100%' }}>
                                    <Typography variant="overline" color="text.secondary">
                                        Next Steps
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>
                                        Transition to the offseason
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Review roster progression, confirm realignment changes, and get ready for recruiting.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gap: 2,
                                minHeight: 0,
                            }}
                        >
                            <Card sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Typography variant="overline" color="text.secondary">
                                        Award Winners
                                    </Typography>
                                    <Box sx={{ mt: 1.5, flex: 1, overflow: 'auto', pr: 1 }}>
                                        {awards.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                No awards have been finalized yet.
                                            </Typography>
                                        ) : (
                                            <Stack spacing={1.5}>
                                                {awards.map(award => {
                                                    const winner = award.first_place;
                                                    return (
                                                        <Box
                                                            key={award.category_slug}
                                                            sx={{
                                                                display: 'flex',
                                                                alignItems: 'flex-start',
                                                                justifyContent: 'space-between',
                                                                gap: 2,
                                                                pb: 1.5,
                                                                borderBottom: '1px solid',
                                                                borderColor: 'divider',
                                                                '&:last-of-type': { pb: 0, borderBottom: 'none' }
                                                            }}
                                                        >
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary">
                                                                    {award.category_name}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                                    {winner && <TeamLogo name={winner.team_name} size={24} />}
                                                                    {winner ? (
                                                                        <MuiLink
                                                                            href={`/players/${winner.id}`}
                                                                            underline="hover"
                                                                            sx={{ fontWeight: 700 }}
                                                                        >
                                                                            {winner.first} {winner.last}
                                                                        </MuiLink>
                                                                    ) : (
                                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                            TBD
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {getAwardStatLine(award.first_stats)}
                                                                </Typography>
                                                            </Box>
                                                            <Chip
                                                                label={winner?.pos || '--'}
                                                                size="small"
                                                                sx={{
                                                                    mt: 0.5,
                                                                    backgroundColor: '#eceff1',
                                                                    fontWeight: 700,
                                                                }}
                                                            />
                                                        </Box>
                                                    );
                                                })}
                                            </Stack>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>

                            <Card sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                                        <Box>
                                            <Typography variant="overline" color="text.secondary">
                                                Prestige Movement
                                            </Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                Changes effective next season
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            4-year average rank
                                        </Typography>
                                    </Box>
                                    <Box sx={{ mt: 1.5, flex: 1, overflow: 'auto' }}>
                                        {prestigeChanges.length > 0 ? (
                                            <TableContainer component={Paper} variant="outlined">
                                                <Table size="small" stickyHeader>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Team</TableCell>
                                                            <TableCell align="right">Current</TableCell>
                                                            <TableCell align="right">Avg Rank</TableCell>
                                                            <TableCell align="right">Change</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {prestigeChanges.map(team => {
                                                            const change = team.prestige_change ?? 0;
                                                            const changeLabel = change > 0 ? `+${change}` : `${change}`;
                                                            const chipColor = change > 0 ? '#1b5e20' : change < 0 ? '#b71c1c' : '#616161';
                                                            const avgBefore = team.avg_rank_before;
                                                            const avgAfter = team.avg_rank_after;
                                                            const avgLabel = avgBefore === null || avgBefore === undefined
                                                                ? '—'
                                                                : `${avgBefore.toFixed(1)} → ${avgAfter === null || avgAfter === undefined ? '—' : avgAfter.toFixed(1)}`;

                                                            return (
                                                                <TableRow key={team.name}>
                                                                    <TableCell>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            <TeamLogo name={team.name} size={22} />
                                                                            <TeamLink
                                                                                name={team.name}
                                                                                onTeamClick={() => handleTeamClick(team.name)}
                                                                            />
                                                                        </Box>
                                                                    </TableCell>
                                                                    <TableCell align="right">Tier {team.prestige}</TableCell>
                                                                    <TableCell align="right">{avgLabel}</TableCell>
                                                                    <TableCell align="right">
                                                                        <Chip
                                                                            label={changeLabel}
                                                                            sx={{
                                                                                backgroundColor: chipColor,
                                                                                color: 'white',
                                                                                fontWeight: 700,
                                                                                minWidth: 48,
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                Prestige changes are not available yet.
                                            </Typography>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Box>
                    </Box>

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
