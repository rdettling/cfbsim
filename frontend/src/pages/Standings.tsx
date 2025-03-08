import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { usePageRefresh } from '../interfaces';
import { Team, Info, Conference } from '../interfaces';
import { TeamLink, TeamLogo } from '../components/TeamComponents';
import {
    Container, Typography, TableContainer, Table,
    TableHead, TableBody, TableRow, TableCell,
    Paper, Box, CircularProgress, Alert
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamInfoModal from '../components/TeamInfoModal';

interface StandingsData {
    info: Info;
    team: Team;
    conference?: string;
    teams: Team[];
    conferences: Conference[];
}

const GameCell = ({ game, type, onTeamClick }: {
    game: NonNullable<StandingsData['teams'][0]['last_game' | 'next_game']>,
    type: 'last' | 'next',
    onTeamClick: (name: string) => void
}) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {type === 'last' && `${game.result} (${game.score}) vs`}
        <TeamLogo name={game.opponent.name} size={20} />
        <TeamLink name={game.opponent.name} onTeamClick={onTeamClick} />
        {type === 'next' && `(${game.spread})`}
    </Box>
);

const StandingsTable = ({ data, conference_name, onTeamClick }: {
    data: StandingsData,
    conference_name: string | undefined,
    onTeamClick: (name: string) => void
}) => (
    <TableContainer component={Paper}>
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Team</TableCell>
                    {conference_name !== 'independent' && <TableCell>Conf</TableCell>}
                    <TableCell>Overall</TableCell>
                    <TableCell>Last Week</TableCell>
                    <TableCell>This Week</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {data.teams.map((team, index) => (
                    <TableRow key={team.name}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TeamLogo name={team.name} size={30} />
                                <TeamLink name={team.name} onTeamClick={onTeamClick} />
                            </Box>
                        </TableCell>
                        {conference_name !== 'independent' && (
                            <TableCell>{team.confWins}-{team.confLosses}</TableCell>
                        )}
                        <TableCell>{team.totalWins}-{team.totalLosses}</TableCell>
                        <TableCell>
                            {team.last_game && <GameCell game={team.last_game} type="last" onTeamClick={onTeamClick} />}
                        </TableCell>
                        <TableCell>
                            {team.next_game && <GameCell game={team.next_game} type="next" onTeamClick={onTeamClick} />}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

const Standings = () => {
    const { conference_name } = useParams();
    const [data, setData] = useState<StandingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    usePageRefresh<StandingsData>(setData);

    useEffect(() => {
        const fetchStandings = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/standings/${conference_name}`);
                setData(response.data);
            } catch (error) {
                setError('Failed to load standings data');
            } finally {
                setLoading(false);
            }
        };

        if (conference_name) fetchStandings();
    }, [conference_name]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No data available</Alert>;

    return (
        <>
            <Navbar team={data.team} currentStage={data.info.stage} info={data.info} conferences={data.conferences} />
            <Container>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    {conference_name !== 'independent' && (
                        <Box component="img" src={`/logos/conferences/${data.conference}.png`}
                            sx={{ height: 100, mb: 2 }} alt={data.conference} />
                    )}
                    <Typography variant="h2">
                        {conference_name === 'independent' ? 'Independent Teams' : `${data.conference} Standings`}
                    </Typography>
                </Box>
                <StandingsTable
                    data={data}
                    conference_name={conference_name}
                    onTeamClick={(name) => { setSelectedTeam(name); setModalOpen(true); }}
                />
            </Container>
            <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

export default Standings;
