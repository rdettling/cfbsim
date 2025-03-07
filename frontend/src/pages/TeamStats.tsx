import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Team, Info, Conference } from '../interfaces';
import {
    Container,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Link as MuiLink,
    CircularProgress,
    Alert,
    Tabs,
    Tab
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface TeamStats {
    games: number;
    ppg: number;
    pass_cpg: number;
    pass_apg: number;
    comp_percent: number;
    pass_ypg: number;
    pass_tdpg: number;
    rush_apg: number;
    rush_ypg: number;
    rush_ypc: number;
    rush_tdpg: number;
    playspg: number;
    yardspg: number;
    ypp: number;
    first_downs_pass: number;
    first_downs_rush: number;
    first_downs_total: number;
    fumbles: number;
    interceptions: number;
    turnovers: number;
}

interface TeamStatsData {
    info: Info;
    offense: Record<string, TeamStats>;
    defense: Record<string, TeamStats>;
    team: Team;
    conferences: Conference[];
}

const TEAM_STATS_URL = `${API_BASE_URL}/api/team_stats`;

const TeamStats = () => {
    const [data, setData] = useState<TeamStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tabValue, setTabValue] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await axios.get(TEAM_STATS_URL);
                setData(response.data);
            } catch (error) {
                setError('Failed to load team stats');
                console.error('Error fetching team stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    useEffect(() => {
        document.title = 'Team Stats';
        return () => {
            document.title = 'College Football';
        };
    }, []);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    const renderStatsTable = (stats: Record<string, TeamStats>, type: 'offense' | 'defense') => (
        <TableContainer component={Paper}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell colSpan={3}>General</TableCell>
                        <TableCell colSpan={5}>Passing</TableCell>
                        <TableCell colSpan={4}>Rushing</TableCell>
                        <TableCell colSpan={3}>Total {type === 'offense' ? 'Offense' : 'Defense'}</TableCell>
                        <TableCell colSpan={3}>First Downs</TableCell>
                        <TableCell colSpan={3}>Turnovers</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>Team</TableCell>
                        <TableCell>Games</TableCell>
                        <TableCell>PPG</TableCell>
                        <TableCell>CMP</TableCell>
                        <TableCell>ATT</TableCell>
                        <TableCell>PCT</TableCell>
                        <TableCell>YDS</TableCell>
                        <TableCell>TD</TableCell>
                        <TableCell>ATT</TableCell>
                        <TableCell>YDS</TableCell>
                        <TableCell>AVG</TableCell>
                        <TableCell>TD</TableCell>
                        <TableCell>Plays</TableCell>
                        <TableCell>YDS</TableCell>
                        <TableCell>AVG</TableCell>
                        <TableCell>Pass</TableCell>
                        <TableCell>Rush</TableCell>
                        <TableCell>Tot</TableCell>
                        <TableCell>Fum</TableCell>
                        <TableCell>Int</TableCell>
                        <TableCell>TO</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.entries(stats).map(([teamName, teamStats]) => (
                        <TableRow key={teamName}>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        component="img"
                                        src={`/logos/teams/${teamName}.png`}
                                        sx={{ width: 30, height: 30 }}
                                        alt={teamName}
                                    />
                                    <MuiLink
                                        component="button"
                                        onClick={() => handleTeamClick(teamName)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        {teamName}
                                    </MuiLink>
                                </Box>
                            </TableCell>
                            <TableCell>{teamStats.games}</TableCell>
                            <TableCell>{teamStats.ppg}</TableCell>
                            <TableCell>{teamStats.pass_cpg}</TableCell>
                            <TableCell>{teamStats.pass_apg}</TableCell>
                            <TableCell>{teamStats.comp_percent}</TableCell>
                            <TableCell>{teamStats.pass_ypg}</TableCell>
                            <TableCell>{teamStats.pass_tdpg}</TableCell>
                            <TableCell>{teamStats.rush_apg}</TableCell>
                            <TableCell>{teamStats.rush_ypg}</TableCell>
                            <TableCell>{teamStats.rush_ypc}</TableCell>
                            <TableCell>{teamStats.rush_tdpg}</TableCell>
                            <TableCell>{teamStats.playspg}</TableCell>
                            <TableCell>{teamStats.yardspg}</TableCell>
                            <TableCell>{teamStats.ypp}</TableCell>
                            <TableCell>{teamStats.first_downs_pass}</TableCell>
                            <TableCell>{teamStats.first_downs_rush}</TableCell>
                            <TableCell>{teamStats.first_downs_total}</TableCell>
                            <TableCell>{teamStats.fumbles}</TableCell>
                            <TableCell>{teamStats.interceptions}</TableCell>
                            <TableCell>{teamStats.turnovers}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
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
                <Typography variant="h3" align="center" gutterBottom>
                    Team Stats
                </Typography>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabValue} onChange={handleTabChange} centered>
                        <Tab label="Offense" />
                        <Tab label="Defense" />
                    </Tabs>
                </Box>

                <Box hidden={tabValue !== 0}>
                    {renderStatsTable(data.offense, 'offense')}
                </Box>
                <Box hidden={tabValue !== 1}>
                    {renderStatsTable(data.defense, 'defense')}
                </Box>
            </Container>

            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

export default TeamStats;
