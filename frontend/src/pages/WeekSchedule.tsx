import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Link as MuiLink,
    CircularProgress,
    Alert,
    Chip
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface Game {
    id: number;
    label: string;
    game_of_week: boolean;
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
}

interface WeekScheduleData {
    info: Info;
    team: Team;
    games: Game[];
    conferences: Conference[];
}

export default function WeekSchedule() {
    const { week } = useParams();
    const [data, setData] = useState<WeekScheduleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    // Add usePageRefresh for automatic data updates
    usePageRefresh<WeekScheduleData>(setData);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!week) {
                setError('Week number is required');
                setLoading(false);
                return;
            }

            const weekNum = parseInt(week, 10);
            if (isNaN(weekNum)) {
                setError('Invalid week number');
                setLoading(false);
                return;
            }

            try {
                const responseData = await apiService.getWeekSchedule<WeekScheduleData>(weekNum);
                setData(responseData);
            } catch (error) {
                console.error('Error fetching week schedule:', error);
                setError('Failed to load week schedule data');
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [week]);

    useEffect(() => {
        document.title = week ? `Week ${week} Schedule` : 'College Football';
        return () => { document.title = 'College Football'; };
    }, [week]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const TeamRow = ({ team, rank, score }: { team: Team, rank: number, score?: number | string }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Box
                component="img"
                src={`/logos/teams/${team.name}.png`}
                sx={{ width: 30, height: 30, mr: 1 }}
                alt={team.name}
            />
            <Box sx={{ flexGrow: 1 }}>
                <MuiLink
                    component="button"
                    onClick={() => { setSelectedTeam(team.name); setModalOpen(true); }}
                    sx={{ cursor: 'pointer' }}
                >
                    {rank < 26 && `#${rank} `}{team.name}
                </MuiLink>
            </Box>
            <Typography>{score}</Typography>
        </Box>
    );

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <Typography variant="h4" align="center" gutterBottom>
                    Week {week} Schedule
                </Typography>

                <Grid container spacing={2}>
                    {data.games.map((game) => (
                        <Grid item xs={12} sm={6} md={3} key={game.id}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="h6" component="div">
                                            {game.label}
                                        </Typography>
                                        {game.game_of_week && (
                                            <Chip label="Game of the week" color="info" size="small" />
                                        )}
                                    </Box>

                                    <TeamRow 
                                        team={game.teamA} 
                                        rank={game.rankATOG} 
                                        score={game.winner ? game.scoreA : game.spreadA} 
                                    />
                                    <TeamRow 
                                        team={game.teamB} 
                                        rank={game.rankBTOG} 
                                        score={game.winner ? game.scoreB : game.spreadB} 
                                    />

                                    <Box sx={{ textAlign: 'center' }}>
                                        <MuiLink href={`/game/${game.id}`}>
                                            {game.winner ? 'Summary' : 'Preview'}
                                        </MuiLink>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}
