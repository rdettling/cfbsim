import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Link as MuiLink
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useState } from 'react';
import TeamInfoModal from '../components/TeamInfoModal';


interface PlayerPassingStats {
    att: number;
    cmp: number;
    yards: number;
    td: number;
    int: number;
    pct: number;
    passer_rating: number;
    adjusted_pass_yards_per_attempt: number;
    yards_per_game: number;
}

interface PassingStatsProps {
    stats: Record<string, {
        id: number;
        first: string;
        last: string;
        pos: string;
        team: {
            name: string;
            gamesPlayed: number;
        };
        stats: PlayerPassingStats;
    }>;
}

const PassingStats = ({ stats }: PassingStatsProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    // Convert stats object to array and sort by adjusted yards per attempt
    const sortedStats = Object.entries(stats)
        .map(([_, data]) => data)
        .sort((a, b) => b.stats.adjusted_pass_yards_per_attempt - a.stats.adjusted_pass_yards_per_attempt);

    return (
        <>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Player</TableCell>
                            <TableCell>Team</TableCell>
                            <TableCell>G</TableCell>
                            <TableCell>CMP</TableCell>
                            <TableCell>ATT</TableCell>
                            <TableCell>Pct</TableCell>
                            <TableCell>Yards</TableCell>
                            <TableCell>TD</TableCell>
                            <TableCell>Int</TableCell>
                            <TableCell>Passer rating</TableCell>
                            <TableCell>AY/A</TableCell>
                            <TableCell>Y/G</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedStats.map((data) => (
                            <TableRow key={data.id}>
                                <TableCell>
                                    <MuiLink
                                        component={RouterLink}
                                        to={`/players/${data.id}`}
                                    >
                                        {data.first} {data.last}
                                    </MuiLink>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box
                                            component="img"
                                            src={`/logos/teams/${data.team.name}.png`}
                                            sx={{ width: 30, height: 30 }}
                                            alt={data.team.name}
                                        />
                                        <MuiLink
                                            component="button"
                                            onClick={() => handleTeamClick(data.team.name)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            {data.team.name}
                                        </MuiLink>
                                    </Box>
                                </TableCell>
                                <TableCell>{data.team.gamesPlayed}</TableCell>
                                <TableCell>{data.stats.cmp}</TableCell>
                                <TableCell>{data.stats.att}</TableCell>
                                <TableCell>{data.stats.pct.toFixed(1)}</TableCell>
                                <TableCell>{data.stats.yards}</TableCell>
                                <TableCell>{data.stats.td}</TableCell>
                                <TableCell>{data.stats.int}</TableCell>
                                <TableCell>{data.stats.passer_rating.toFixed(1)}</TableCell>
                                <TableCell>{data.stats.adjusted_pass_yards_per_attempt.toFixed(1)}</TableCell>
                                <TableCell>{data.stats.yards_per_game.toFixed(1)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

export default PassingStats;