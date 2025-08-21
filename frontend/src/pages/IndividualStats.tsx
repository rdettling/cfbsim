import { useState } from 'react';
import { apiService } from '../services/api';
import { Team, Info, Conference } from '../interfaces';
import { TeamLink, TeamLogo, TeamInfoModal } from '../components/TeamComponents';
import { Link as RouterLink } from 'react-router-dom';
import {
    Typography, Box, Tabs, Tab,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Link as MuiLink
} from '@mui/material';
import { DataPage } from '../components/DataPage';

interface PlayerData {
    id: number;
    first: string;
    last: string;
    pos: string;
    team: string;
    gamesPlayed: number;
    stats: Record<string, number>;
}

interface StatsData {
    info: Info;
    team: Team;
    conferences: Conference[];
    stats: Record<string, Record<string, PlayerData>>;
}

const StatsTable = ({ stats, sortBy }: { stats: Record<string, PlayerData>, sortBy: string }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    const sortedStats = Object.values(stats).sort((a, b) => b.stats[sortBy] - a.stats[sortBy]);
    const statKeys = sortedStats[0]?.stats ? Object.keys(sortedStats[0].stats) : [];

    return (
        <>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Player</TableCell>
                            <TableCell>Team</TableCell>
                            <TableCell>G</TableCell>
                            {statKeys.map(key => <TableCell key={key}>{key.toUpperCase()}</TableCell>)}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedStats.map(({ id, first, last, team, gamesPlayed, stats }) => (
                            <TableRow key={id}>
                                <TableCell>
                                    <MuiLink component={RouterLink} to={`/players/${id}`}>{first} {last}</MuiLink>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TeamLogo name={team} />
                                        <TeamLink name={team} onTeamClick={(name) => { setSelectedTeam(name); setModalOpen(true); }} />
                                    </Box>
                                </TableCell>
                                <TableCell>{gamesPlayed}</TableCell>
                                {statKeys.map(key => (
                                    <TableCell key={key}>
                                        {Number.isInteger(stats[key]) ? stats[key] : stats[key].toFixed(1)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TeamInfoModal teamName={selectedTeam} open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
};

const IndividualStats = () => {
    const [tabValue, setTabValue] = useState(0);

    return (
        <DataPage
            fetchFunction={() => apiService.getIndividualStatsList<StatsData>()}
            dependencies={[]}
        >
            {(data) => (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} centered>
                            <Tab label="Passing" />
                            <Tab label="Rushing" />
                            <Tab label="Receiving" />
                        </Tabs>
                    </Box>
                    <Box hidden={tabValue !== 0}><StatsTable stats={data.stats.passing} sortBy="adjusted_pass_yards_per_attempt" /></Box>
                    <Box hidden={tabValue !== 1}><StatsTable stats={data.stats.rushing} sortBy="yards_per_game" /></Box>
                    <Box hidden={tabValue !== 2}><StatsTable stats={data.stats.receiving} sortBy="yards_per_game" /></Box>
                </>
            )}
        </DataPage>
    );
};

export default IndividualStats;
