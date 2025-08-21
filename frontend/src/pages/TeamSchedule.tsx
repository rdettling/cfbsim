import { useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { apiService, getTeamScheduleRoute, getGameRoute } from '../services/api';
import { Team, ScheduleGame, Info, Conference } from '../interfaces';
import {
    Container,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Box,
    Stack,
    TableContainer,
    Paper,
    Link,
    Chip,
    Typography,
    Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import TeamHeader from '../components/TeamHeader';
import { TeamLogo, TeamInfoModal } from '../components/TeamComponents';
import { DataPage } from '../components/DataPage';

interface ScheduleData {
    info: Info;
    team: Team;
    games: ScheduleGame[];
    conferences: Conference[];
    teams: string[];
    years: string[];
}

const TeamSchedule = () => {
    const { teamName } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');

    // Get year from URL
    const year = searchParams.get('year');

    const handleTeamChange = (newTeam: string) => {
        setSearchParams(params => {
            if (year) params.set('year', year);
            return params;
        });
        navigate(getTeamScheduleRoute(newTeam));
    };

    const handleYearChange = (newYear: string) => {
        setSearchParams(params => {
            params.set('year', newYear);
            return params;
        });
    };

    return (
        <>
            <DataPage
                fetchFunction={() => {
                    if (!teamName) throw new Error('No team name provided');
                    return apiService.getTeamSchedule<ScheduleData>(teamName, year || undefined);
                }}
                dependencies={[teamName, year]}
            >
                {(data) => {
                    // Result styling colors - slightly darker
                    const resultStyles = {
                        win: 'rgba(46, 125, 50, 0.15)',
                        loss: 'rgba(211, 47, 47, 0.15)',
                        neutral: 'inherit'
                    };

                    return (
                        <>
                            <Container>
                                <TeamHeader 
                                    team={data.team}
                                    teams={data.teams}
                                    years={data.years}
                                    onTeamChange={handleTeamChange}
                                    onYearChange={handleYearChange}
                                    selectedYear={year || data.info.currentYear?.toString() || ''}
                                />
                                
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h5" sx={{ 
                                        mb: 2, 
                                        pb: 1, 
                                        borderBottom: '2px solid', 
                                        borderColor: data.team.colorPrimary || 'primary.main' 
                                    }}>
                                        Season Schedule
                                    </Typography>
                                </Box>
                                
                                {/* Schedule Table */}
                                <TableContainer component={Paper} elevation={3} sx={{ mb: 4 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ 
                                                bgcolor: data.team.colorPrimary || 'primary.main',
                                                '& th': { color: 'white', fontWeight: 'bold' }
                                            }}>
                                                <TableCell>Week</TableCell>
                                                <TableCell>Opponent</TableCell>
                                                <TableCell align="center">Rating</TableCell>
                                                <TableCell align="center">Record</TableCell>
                                                <TableCell align="center">Spread</TableCell>
                                                <TableCell align="center">Result</TableCell>
                                                <TableCell>Notes</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.games.map((game) => (
                                                <TableRow
                                                    key={game.weekPlayed}
                                                    sx={{
                                                        backgroundColor: game.result === 'W' 
                                                            ? resultStyles.win 
                                                            : game.result === 'L' 
                                                                ? resultStyles.loss 
                                                                : resultStyles.neutral,
                                                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.07)' }
                                                    }}
                                                >
                                                    <TableCell>{game.weekPlayed}</TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            <TeamLogo name={game.opponent.name} size={30} />
                                                            <Link
                                                                component="button"
                                                                onClick={() => {
                                                                    setSelectedTeam(game.opponent.name);
                                                                    setModalOpen(true);
                                                                }}
                                                                sx={{ 
                                                                    cursor: 'pointer', 
                                                                    textDecoration: 'none',
                                                                    fontWeight: game.opponent.ranking <= 25 ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                {game.opponent.ranking <= 25 && `#${game.opponent.ranking} `}
                                                                {game.opponent.name}
                                                            </Link>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="center">{game.opponent.rating}</TableCell>
                                                    <TableCell align="center">{game.opponent.record}</TableCell>
                                                    <TableCell align="center">{game.spread || '-'}</TableCell>
                                                    <TableCell align="center">
                                                        {game.result ? (
                                                            <Chip
                                                                label={`${game.result}: ${game.score}`}
                                                                color={game.result === 'W' ? 'success' : 'error'}
                                                                variant="outlined"
                                                                size="small"
                                                                sx={{ fontWeight: 'bold' }}
                                                                onClick={() => navigate(getGameRoute(game.id))}
                                                            />
                                                        ) : (
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                onClick={() => navigate(getGameRoute(game.id))}
                                                            >
                                                                Preview
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {game.label && (
                                                            <Chip 
                                                                label={game.label} 
                                                                size="small" 
                                                                color="primary"
                                                                variant="outlined" 
                                                            />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Container>
                        </>
                    );
                }}
            </DataPage>
            
            <TeamInfoModal
                teamName={selectedTeam}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
};

export default TeamSchedule;
