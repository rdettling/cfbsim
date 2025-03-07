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

interface PlayerRushingStats {
    att: number;
    yards: number;
    td: number;
    fumbles: number;
    yards_per_rush: number;
    yards_per_game: number;
}

interface Player {
    id: number;
    first: string;
    last: string;
    pos: string;
    rating: number;
    team: {
        name: string;
        gamesPlayed: number;
    };
}

interface RushingStatsProps {
    stats: Record<string, {
        player: Player;
        stats: PlayerRushingStats;
    }>;
}

const RushingStats = ({ stats }: RushingStatsProps) => {
    // Convert stats object to array and sort by yards
    const sortedStats = Object.entries(stats)
        .map(([_, data]) => data)
        .sort((a, b) => b.stats.yards - a.stats.yards);

    return (
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Player</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell>Pos</TableCell>
                        <TableCell>Rating</TableCell>
                        <TableCell>G</TableCell>
                        <TableCell>ATT</TableCell>
                        <TableCell>Yards</TableCell>
                        <TableCell>TD</TableCell>
                        <TableCell>Fum</TableCell>
                        <TableCell>Y/A</TableCell>
                        <TableCell>Y/G</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedStats.map(({ player, stats }) => (
                        <TableRow key={player.id}>
                            <TableCell>
                                <MuiLink
                                    component={RouterLink}
                                    to={`/player/${player.id}`}
                                >
                                    {player.first} {player.last}
                                </MuiLink>
                            </TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        component="img"
                                        src={`/logos/teams/${player.team.name}.png`}
                                        sx={{ width: 30, height: 30 }}
                                        alt={player.team.name}
                                    />
                                    <MuiLink
                                        component={RouterLink}
                                        to={`/teams/${player.team.name}/schedule`}
                                    >
                                        {player.team.name}
                                    </MuiLink>
                                </Box>
                            </TableCell>
                            <TableCell>{player.pos}</TableCell>
                            <TableCell>{player.rating}</TableCell>
                            <TableCell>{player.team.gamesPlayed}</TableCell>
                            <TableCell>{stats.att}</TableCell>
                            <TableCell>{stats.yards}</TableCell>
                            <TableCell>{stats.td}</TableCell>
                            <TableCell>{stats.fumbles}</TableCell>
                            <TableCell>{stats.yards_per_rush.toFixed(1)}</TableCell>
                            <TableCell>{stats.yards_per_game.toFixed(1)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default RushingStats;
