import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { dataService, getTeamRosterRoute, getPlayerRoute } from '../services/data';
import { Team, Info, Conference, Player } from '../interfaces';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Box,
    TableContainer,
    Paper,
    Link,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Typography
} from '@mui/material';
import TeamHeader from '../components/TeamHeader';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface RosterData {
    info: Info;
    team: Team;
    roster: Player[];
    positions: string[];
    conferences: Conference[];
    teams: string[];
}

const Roster = () => {
    const { teamName } = useParams();
    const navigate = useNavigate();
    const [positionFilter, setPositionFilter] = useState('');

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            if (!teamName) throw new Error('No team name provided');
            return dataService.getTeamRoster<RosterData>(teamName);
        },
        dependencies: [teamName],
        autoRefreshOnGameChange: true
    });

    // Set document title
    React.useEffect(() => {
        document.title = teamName ? `${teamName} Roster` : 'Roster';
        return () => { document.title = 'College Football'; };
    }, [teamName]);

    // Map year abbreviations to full names for better readability
    const yearLabels = {
        'fr': 'Freshman',
        'so': 'Sophomore',
        'jr': 'Junior',
        'sr': 'Senior'
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
        >
            {data && (
                <>
                    <TeamHeader
                        team={data.team}
                        teams={data.teams}
                        onTeamChange={(newTeam) => navigate(getTeamRosterRoute(newTeam))}
                    />
            
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 2 }}>
                        <Typography variant="h5">Team Roster</Typography>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Position Filter</InputLabel>
                            <Select
                                value={positionFilter}
                                onChange={(e) => setPositionFilter(e.target.value as string)}
                                label="Position Filter"
                            >
                                <MenuItem value="">All Positions</MenuItem>
                                {data.positions.map((pos: string) => (
                                    <MenuItem key={pos} value={pos}>{pos}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <TableContainer component={Paper} elevation={2}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: data.team.colorPrimary || 'primary.main' }}>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Name</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Year</TableCell>
                                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.positions
                                    .filter((position: string) => positionFilter === '' || positionFilter === position)
                                    .map((position: string) => {
                                        const playersInPosition = data.roster.filter((player: Player) => player.pos === position);
                                    return playersInPosition.length > 0 ? (
                                        <React.Fragment key={`pos-${position}`}>
                                            <TableRow>
                                                <TableCell 
                                                    colSpan={4} 
                                                    sx={{ 
                                                        bgcolor: `${data.team.colorSecondary || 'grey.100'}20`, 
                                                        fontWeight: 'bold' 
                                                    }}
                                                >
                                                    {position}
                                                </TableCell>
                                            </TableRow>
                                            {playersInPosition.map((player: Player) => (
                                                <TableRow 
                                                    key={`player-${player.id}`}
                                                    sx={{ 
                                                        '&:hover': { 
                                                            bgcolor: 'rgba(0,0,0,0.04)'
                                                        }
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Link
                                                            component="button"
                                                            onClick={() => navigate(getPlayerRoute(player.id.toString()))}
                                                            sx={{ 
                                                                cursor: 'pointer',
                                                                textDecoration: 'none',
                                                                fontWeight: player.starter ? 'bold' : 'normal'
                                                            }}
                                                        >
                                                            {player.first} {player.last}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{player.rating}</TableCell>
                                                    <TableCell>
                                                        {yearLabels[player.year as keyof typeof yearLabels]}
                                                    </TableCell>
                                                    <TableCell>
                                                        {player.starter ? (
                                                            <Chip 
                                                                label="Starter" 
                                                                size="small" 
                                                                color="success" 
                                                                variant="outlined"
                                                            />
                                                        ) : (
                                                            <Chip 
                                                                label="Backup" 
                                                                size="small" 
                                                                color="default" 
                                                                variant="outlined"
                                                            />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                        ) : null;
                                    })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}
        </PageLayout>
    );
};

export default Roster;
