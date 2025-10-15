import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import {
    Typography,
    Box,
    Link as MuiLink,
    Button,
    Grid,
    Card,
    CardContent
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { TeamLogo, TeamInfoModal } from '../components/TeamComponents';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface Game {
    id: number;
    label: string;
    base_label?: string;
    teamA: Team;
    teamB: Team;
    rankATOG: number;
    rankBTOG: number;
    scoreA?: number;
    scoreB?: number;
    spreadA?: number;
    spreadB?: number;
    winner: boolean;
    overtime?: number;
    watchability_score: number;
}

interface WeekScheduleData {
    info: Info;
    team: Team;
    games: Game[];
    conferences: Conference[];
}

export default function WeekSchedule() {
    const { week } = useParams();
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            // Get the current week from the URL at the time of fetch
            const currentWeek = window.location.pathname.split('/').pop();
            if (!currentWeek) throw new Error('Week number is required');
            const weekNum = parseInt(currentWeek, 10);
            if (isNaN(weekNum)) throw new Error('Invalid week number');
            console.log('🔍 WeekSchedule: Fetching data for week', weekNum);
            return apiService.getWeekSchedule<WeekScheduleData>(weekNum);
        },
        dependencies: [week],
        autoRefreshOnGameChange: true // Enable auto-refresh for the week we're viewing
    });

    // Add debug logging for auto-refresh events
    useEffect(() => {
        const handleGameChange = () => {
            console.log('🔄 WeekSchedule: Auto-refresh triggered for week', week);
        };

        window.addEventListener('pageDataRefresh', handleGameChange);
        console.log('📡 WeekSchedule: Listening for pageDataRefresh events');

        return () => {
            window.removeEventListener('pageDataRefresh', handleGameChange);
            console.log('📡 WeekSchedule: Removed pageDataRefresh listener');
        };
    }, [week]);

    // Remove the separate current week hook since we want to refresh the week we're viewing

    useEffect(() => {
        document.title = week ? `Week ${week} Schedule` : 'College Football';
        return () => { document.title = 'College Football'; };
    }, [week]);

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const handleWeekNavigation = (direction: 'prev' | 'next') => {
        if (!data) return;
        
        const currentWeek = parseInt(week || '1', 10);
        let newWeek: number;
        
        if (direction === 'prev') {
            newWeek = Math.max(1, currentWeek - 1);
        } else {
            newWeek = Math.min(data.info.lastWeek, currentWeek + 1);
        }
        
        if (newWeek !== currentWeek) {
            navigate(`/schedule/${newWeek}`);
        }
    };

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
            containerMaxWidth="xl"
        >
            {data && (
                <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                    <Button
                        onClick={() => handleWeekNavigation('prev')}
                        disabled={!data || parseInt(week || '1', 10) <= 1}
                        startIcon={<ChevronLeft />}
                        variant="outlined"
                        sx={{ 
                            color: 'primary.main',
                            borderColor: 'primary.main',
                            '&:hover': { 
                                backgroundColor: 'primary.light', 
                                color: 'white',
                                borderColor: 'primary.light'
                            },
                            '&.Mui-disabled': { 
                                color: 'grey.400',
                                borderColor: 'grey.400'
                            }
                        }}
                    >
                        Prev Week
                    </Button>
                    
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
                            Week {week} Schedule
                        </Typography>
                        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                            {data?.games.length} Games This Week
                        </Typography>
                    </Box>
                    
                    <Button
                        onClick={() => handleWeekNavigation('next')}
                        disabled={!data || parseInt(week || '1', 10) >= (data?.info.lastWeek || 1)}
                        endIcon={<ChevronRight />}
                        variant="outlined"
                        sx={{ 
                            color: 'primary.main',
                            borderColor: 'primary.main',
                            '&:hover': { 
                                backgroundColor: 'primary.light', 
                                color: 'white',
                                borderColor: 'primary.light'
                            },
                            '&.Mui-disabled': { 
                                color: 'grey.400',
                                borderColor: 'grey.400'
                            }
                        }}
                    >
                        Next Week
                    </Button>
                </Box>

                <Grid container spacing={2}>
                    {data.games.map((game) => (
                        <Grid item xs={12} sm={6} lg={4} key={game.id}>
                            <Card sx={{ 
                                borderRadius: 2,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                    transform: 'translateY(-2px)'
                                }
                            }}>
                                <CardContent sx={{ p: 2 }}>
                                    {/* Header */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'grey.200' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                            {game.label}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                            Watchability: {game.watchability_score}
                                        </Typography>
                                    </Box>

                                    {/* Teams */}
                                    <Box sx={{ mb: 2 }}>
                                        {/* Away Team */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, p: 1, borderRadius: 1, backgroundColor: 'grey.50' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <TeamLogo name={game.teamA.name} size={24} />
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                    onClick={() => handleTeamClick(game.teamA.name)}
                                                >
                                                    {game.rankATOG < 26 ? `#${game.rankATOG} ${game.teamA.name}` : game.teamA.name}
                                                </Typography>
                                            </Box>
                                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                                {game.winner ? game.scoreA : game.spreadA}
                                            </Typography>
                                        </Box>

                                        {/* Home Team */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, borderRadius: 1, backgroundColor: 'grey.50' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <TeamLogo name={game.teamB.name} size={24} />
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        '&:hover': { textDecoration: 'underline' }
                                                    }}
                                                    onClick={() => handleTeamClick(game.teamB.name)}
                                                >
                                                    {game.rankBTOG < 26 ? `#${game.rankBTOG} ${game.teamB.name}` : game.teamB.name}
                                                </Typography>
                                            </Box>
                                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                                {game.winner ? game.scoreB : game.spreadB}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Footer */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                            {game.winner 
                                                ? `${game.base_label || 'VS'} - FINAL${game.overtime && game.overtime > 0 
                                                    ? ` (${game.overtime > 1 ? `${game.overtime}OT` : 'OT'})` 
                                                    : ''}`
                                                : game.base_label || 'VS'
                                            }
                                        </Typography>
                                        <Button component={MuiLink} href={`/game/${game.id}`} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }}>
                                            {game.winner ? 'Summary' : 'Preview'}
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
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
}
