import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { dataService } from '../services/data';
import type { Player } from '../interfaces';
import { Team, Info, Conference } from '../interfaces';
import { TeamInfoModal, TeamLogo } from '../components/TeamComponents';
import { TeamLink } from '../components/TeamComponents';
import {
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Table,
    TableBody,
    TableCell,
    TableRow,
    TableHead,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Paper,
    Link,
    Chip
} from '@mui/material';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface GameLog {
    game: {
        id: number;
        weekPlayed: number;
        opponent: {
            name: string;
            ranking: number;
            rating: number;
            record: string;
        };
        label: string;
        result: string;
        spread: string;
        moneyline: string;
        score: string;
    };
    [key: string]: any;
}

interface PlayerData {
    info: Info;
    team: Team;
    player: Player;
    conferences: Conference[];
    career_stats: { [year: number]: any };
    game_logs: { [year: number]: GameLog[] };
    awards: Array<{ slug: string; name: string }>;
}

// PlayerHeader Component
interface PlayerHeaderProps {
    player: Player;
    onTeamClick: (name: string) => void;
    awards: Array<{ slug: string; name: string }>;
}

const PlayerHeader = ({ player, onTeamClick, awards }: PlayerHeaderProps) => {
    return (
        <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={9}>
                        <Typography variant="h3" fontWeight="bold" gutterBottom>
                            {player.first} {player.last}
                        </Typography>

                        {awards.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                {awards.map(award => (
                                    <Chip
                                        key={award.slug}
                                        label={award.name}
                                        variant="outlined"
                                        color="secondary"
                                        sx={{ fontWeight: 600 }}
                                    />
                                ))}
                            </Box>
                        )}
                        
                        <Table size="small" sx={{ maxWidth: 500 }}>
                            <TableBody>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Team</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TeamLogo name={player.team} size={30} />
                                            <TeamLink name={player.team} onTeamClick={onTeamClick} />
                                        </Box>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Position</TableCell>
                                    <TableCell>{player.pos}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                                    <TableCell>{player.year.toUpperCase()}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Recruit Stars</TableCell>
                                    <TableCell>
                                        {player.stars > 0 ? `${'★'.repeat(player.stars)}` : 'N/A'}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Development Trait</TableCell>
                                    <TableCell>{player.development_trait}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Starter</TableCell>
                                    <TableCell>
                                        <Typography color={player.starter ? 'success.main' : 'error.main'}>
                                            {player.starter ? '✓' : '✗'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Active</TableCell>
                                    <TableCell>
                                        <Typography color={player.active ? 'success.main' : 'error.main'}>
                                            {player.active ? '✓' : '✗'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
                            <Typography variant="h2" fontWeight="bold">
                                {player.rating}
                            </Typography>
                            <Typography variant="body1">
                                Overall Rating
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

// CareerStats Component
interface CareerStatsProps {
    careerStatsByYear: { [year: number]: any };
    years: number[];
}

const CareerStats = ({ careerStatsByYear, years }: CareerStatsProps) => {
    if (years.length === 0) return null;

    // Get all stat keys from the first year's data
    const firstYearStats = careerStatsByYear[years[0]];
    if (!firstYearStats) return null;

    const statKeys = Object.keys(firstYearStats).filter(key => 
        !['class', 'rating'].includes(key)
    );

    // Format stat label for display
    const formatStatLabel = (key: string) => {
        return key.replace(/_/g, ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    return (
        <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                    Career Statistics
                </Typography>

                <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Year</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Class</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Rating</TableCell>
                                {statKeys.map(key => (
                                    <TableCell key={key} align="right" sx={{ fontWeight: 'bold' }}>
                                        {formatStatLabel(key)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {years.map((year, idx) => {
                                const yearStats = careerStatsByYear[year];
                                if (!yearStats) return null;

                                return (
                                    <TableRow 
                                        key={year}
                                        sx={{ 
                                            bgcolor: idx % 2 === 0 ? 'white' : 'grey.50',
                                            '&:hover': { bgcolor: 'grey.100' }
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: 'bold' }}>{year}</TableCell>
                                        <TableCell>{yearStats.class}</TableCell>
                                        <TableCell>{yearStats.rating}</TableCell>
                                        {statKeys.map(key => (
                                            <TableCell key={key} align="right">
                                                <Typography variant="body2">
                                                    {yearStats[key] != null ? (
                                                        typeof yearStats[key] === 'number' ? 
                                                            Number.isInteger(yearStats[key]) ? yearStats[key] : yearStats[key].toFixed(1)
                                                            : String(yearStats[key])
                                                    ) : '-'}
                                                </Typography>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Box>
            </CardContent>
        </Card>
    );
};

// GameLogs Component
interface GameLogsProps {
    gameLogsByYear: { [year: number]: GameLog[] };
    years: number[];
    selectedYear: number | null;
    onYearChange: (year: number) => void;
    onTeamClick: (name: string) => void;
}

const GameLogs = ({ gameLogsByYear, years, selectedYear, onYearChange, onTeamClick }: GameLogsProps) => {
    const gameLogs = selectedYear ? gameLogsByYear[selectedYear] || [] : [];
    
    const renderGameLogsTable = () => {
        if (!gameLogs || gameLogs.length === 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    No games played this season
                </Typography>
            );
        }

        const firstLog = gameLogs[0];
        // Filter to only include stat fields (exclude 'game' object)
        const statKeys = Object.keys(firstLog).filter(key => key !== 'game');

        // Format stat label for display
        const formatStatLabel = (key: string) => {
            return key.replace(/_/g, ' ').split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };

        return (
            <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>Week</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Opponent</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Result</TableCell>
                            {statKeys.map(key => (
                                <TableCell key={key} align="right" sx={{ fontWeight: 'bold' }}>
                                    {formatStatLabel(key)}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {gameLogs.map((log, idx) => {
                            const game = log.game;
                            const isWin = game.result === 'W';
                            
                            return (
                                <TableRow 
                                    key={idx}
                                    sx={{ 
                                        bgcolor: isWin 
                                            ? 'rgba(76, 175, 80, 0.1)' // Light green for win
                                            : 'rgba(244, 67, 54, 0.1)', // Light red for loss
                                        '&:hover': { 
                                            bgcolor: isWin 
                                                ? 'rgba(76, 175, 80, 0.2)' 
                                                : 'rgba(244, 67, 54, 0.2)'
                                        }
                                    }}
                                >
                                    <TableCell>{game.weekPlayed}</TableCell>
                                    <TableCell>
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                {game.opponent.ranking > 0 && game.opponent.ranking <= 25 && (
                                                    <Typography variant="body2" fontWeight="bold" color="primary">
                                                        #{game.opponent.ranking}
                                                    </Typography>
                                                )}
                                                <TeamLogo name={game.opponent.name} size={24} />
                                                <Box sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                                    <TeamLink name={game.opponent.name} onTeamClick={onTeamClick} />
                                                </Box>
                                            </Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {game.label}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Link
                                            component={RouterLink}
                                            to={`/game/${game.id}`}
                                            sx={{
                                                textDecoration: 'none',
                                                fontWeight: 'bold',
                                                color: 'inherit',
                                                '&:hover': {
                                                    textDecoration: 'underline',
                                                    color: 'primary.main'
                                                }
                                            }}
                                        >
                                            {game.score}
                                        </Link>
                                    </TableCell>
                                    {statKeys.map(key => (
                                        <TableCell key={key} align="right">
                                            <Typography variant="body2">
                                                {log[key] != null ? (
                                                    typeof log[key] === 'number' ? 
                                                        Number.isInteger(log[key]) ? log[key] : log[key].toFixed(1)
                                                        : String(log[key])
                                                ) : '-'}
                                            </Typography>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Box>
        );
    };

    return (
        <Card elevation={2}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" fontWeight="bold">
                        Game Logs
                    </Typography>
                    <FormControl sx={{ minWidth: 120 }}>
                        <InputLabel>Year</InputLabel>
                        <Select
                            value={selectedYear || ''}
                            label="Year"
                            onChange={(e) => onYearChange(Number(e.target.value))}
                        >
                            {years.map(year => (
                                <MenuItem key={year} value={year}>{year}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                {renderGameLogsTable()}
            </CardContent>
        </Card>
    );
};

const Player = () => {
    const { playerId } = useParams();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => {
            if (!playerId) throw new Error('No player ID provided');
            return dataService.getPlayer<PlayerData>(playerId);
        },
        dependencies: [playerId],
        autoRefreshOnGameChange: true
    });

    const handleTeamClick = (name: string) => {
        setSelectedTeam(name);
        setModalOpen(true);
    };

    const player = data?.player;
    const awards = data?.awards ?? [];
    const careerStatsByYear = data?.career_stats || {};
    const gameLogsByYear = data?.game_logs || {};
    
    // Derive years from career stats (or game logs as fallback)
    const years = Object.keys(careerStatsByYear).length > 0 
        ? Object.keys(careerStatsByYear).map(Number).sort((a, b) => b - a)
        : Object.keys(gameLogsByYear).map(Number).sort((a, b) => b - a);
    
    // Set initial year if not selected
    useEffect(() => {
        if (!selectedYear && years.length > 0) {
            setSelectedYear(years[0]);
        }
    }, [years, selectedYear]);

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
            {data && player && (
                <>
                    <PlayerHeader 
                        player={player} 
                        onTeamClick={handleTeamClick} 
                        awards={awards}
                    />

                    <CareerStats
                        careerStatsByYear={careerStatsByYear}
                        years={years}
                    />

                    <GameLogs
                        gameLogsByYear={gameLogsByYear}
                        years={years}
                        selectedYear={selectedYear}
                        onYearChange={setSelectedYear}
                        onTeamClick={handleTeamClick}
                    />

                    <TeamInfoModal
                        teamName={selectedTeam}
                        open={modalOpen}
                        onClose={() => setModalOpen(false)}
                    />
                </>
            )}
        </PageLayout>
    );
};

export default Player;
