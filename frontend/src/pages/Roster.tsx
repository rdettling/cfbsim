import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiService, usePageRefresh } from '../services/api';
import { Team, Info, Conference, Player } from '../interfaces';
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Box,
    TableContainer,
    Paper,
    Link,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Typography
} from '@mui/material';
import Navbar from '../components/Navbar';
import TeamHeader from '../components/TeamHeader';

interface RosterData {
    info: Info;
    team: Team;
    roster: Player[];
    positions: string[];
    conferences: Conference[];
    teams: Team[];
}

const Roster = () => {
    const { teamName } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<RosterData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [positionFilter, setPositionFilter] = useState('');

    usePageRefresh<RosterData>(setData);

    useEffect(() => {
        const fetchRoster = async () => {
            try {
                if (teamName) {
                    const responseData = await apiService.getTeamRoster<RosterData>(teamName);
                    setData(responseData);
                }
            } catch (error) {
                setError('Failed to load roster');
            } finally {
                setLoading(false);
            }
        };

        fetchRoster();
        document.title = teamName ? `${teamName} Roster` : 'Roster';
        return () => { document.title = 'College Football'; };
    }, [teamName]);

    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!data) return <Alert severity="warning">No roster data available</Alert>;

    // Map year abbreviations to full names for better readability
    const yearLabels = {
        'fr': 'Freshman',
        'so': 'Sophomore',
        'jr': 'Junior',
        'sr': 'Senior'
    };

    return (
        <>
            <Navbar
                team={data.team}
                currentStage={data.info.stage}
                info={data.info}
                conferences={data.conferences}
            />
            <Container>
                <TeamHeader
                    team={data.team}
                    teams={data.teams}
                    onTeamChange={(newTeam) => navigate(`/${newTeam}/roster`)}
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
                            {data.positions.map(pos => (
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
                                .filter(position => positionFilter === '' || positionFilter === position)
                                .map(position => {
                                    const playersInPosition = data.roster.filter(player => player.pos === position);
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
                                            {playersInPosition.map(player => (
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
                                                            onClick={() => navigate(`/players/${player.id}`)}
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
            </Container>
        </>
    );
};

export default Roster;
