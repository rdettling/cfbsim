import { useState, useMemo } from 'react';
import { dataService } from '../services/data';
import type { Team, Info, Conference, TeamStats as TeamStatsType } from '../interfaces';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Link as MuiLink,
    Tabs,
    Tab,
    Typography,
    Chip
} from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { TeamInfoModal, TeamLogo } from '../components/TeamComponents';
import { useDataFetching } from '../hooks/useDataFetching';
import { PageLayout } from '../components/PageLayout';

interface TeamStatsData {
    info: Info;
    offense: Record<string, TeamStatsType>;
    defense: Record<string, TeamStatsType>;
    offense_averages: TeamStatsType;
    defense_averages: TeamStatsType;
    team: Team;
    conferences: Conference[];
}

interface SortConfig {
    field: keyof TeamStatsType;
    direction: 'asc' | 'desc';
}

interface ColumnConfig {
    key: keyof TeamStatsType;
    label: string;
    width: string;
    sortable: boolean;
    defaultDirection?: 'asc' | 'desc';
}

// Column configuration for the stats table
const COLUMN_CONFIG: ColumnConfig[] = [
    { key: 'games', label: 'Games', width: '60px', sortable: true, defaultDirection: 'desc' },
    { key: 'ppg', label: 'PPG', width: '60px', sortable: true, defaultDirection: 'desc' },
    { key: 'pass_cpg', label: 'CMP', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'pass_apg', label: 'ATT', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'comp_percent', label: 'PCT', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'pass_ypg', label: 'YDS', width: '60px', sortable: true, defaultDirection: 'desc' },
    { key: 'pass_tdpg', label: 'TD', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'rush_apg', label: 'ATT', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'rush_ypg', label: 'YDS', width: '60px', sortable: true, defaultDirection: 'desc' },
    { key: 'rush_ypc', label: 'AVG', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'rush_tdpg', label: 'TD', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'playspg', label: 'Plays', width: '60px', sortable: true, defaultDirection: 'desc' },
    { key: 'yardspg', label: 'YDS', width: '60px', sortable: true, defaultDirection: 'desc' },
    { key: 'ypp', label: 'AVG', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'first_downs_pass', label: 'Pass', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'first_downs_rush', label: 'Rush', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'first_downs_total', label: 'Tot', width: '50px', sortable: true, defaultDirection: 'desc' },
    { key: 'fumbles', label: 'Fum', width: '50px', sortable: true, defaultDirection: 'asc' },
    { key: 'interceptions', label: 'Int', width: '50px', sortable: true, defaultDirection: 'asc' },
    { key: 'turnovers', label: 'TO', width: '50px', sortable: true, defaultDirection: 'asc' }
];

// Section configuration for the table header
const TABLE_SECTIONS = [
    { label: 'General', colSpan: 5 },
    { label: 'Passing', colSpan: 5 },
    { label: 'Rushing', colSpan: 4 },
    { label: 'Total Offense', colSpan: 3 },
    { label: 'First Downs', colSpan: 3 },
    { label: 'Turnovers', colSpan: 3 }
];

const TeamStats = () => {
    const [tabValue, setTabValue] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        field: 'ppg',
        direction: 'desc'
    });

    const { data, loading, error } = useDataFetching({
        fetchFunction: () => dataService.getTeamStatsList<TeamStatsData>(),
        autoRefreshOnGameChange: true
    });

    const handleTeamClick = (teamName: string) => {
        setSelectedTeam(teamName);
        setModalOpen(true);
    };

    const handleSort = (field: keyof TeamStatsType) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Sort and rank the stats
    const sortedStats = useMemo(() => {
        if (!data) return { offense: {}, defense: {} };

        const currentStats = tabValue === 0 ? data.offense : data.defense;
        const currentAverages = tabValue === 0 ? data.offense_averages : data.defense_averages;
        const statsArray = Object.entries(currentStats).map(([teamName, stats]) => ({
            teamName,
            stats
        }));

        // Sort the array
        statsArray.sort((a, b) => {
            const aValue = a.stats[sortConfig.field] || 0;
            const bValue = b.stats[sortConfig.field] || 0;
            
            if (sortConfig.direction === 'desc') {
                return bValue - aValue;
            } else {
                return aValue - bValue;
            }
        });

        // Add ranking and convert back to object
        const rankedStats: Record<string, TeamStatsType & { rank: number }> = {};
        statsArray.forEach((item, index) => {
            rankedStats[item.teamName] = {
                ...item.stats,
                rank: index + 1
            };
        });

        // Add averages row
        const averagesRow: TeamStatsType & { rank: number } = {
            ...currentAverages,
            rank: 0  // Always first position
        };

        return {
            offense: tabValue === 0 ? { 'League Average': averagesRow, ...rankedStats } : data.offense,
            defense: tabValue === 1 ? { 'League Average': averagesRow, ...rankedStats } : data.defense
        };
    }, [data, tabValue, sortConfig]);

    const renderSortIcon = (field: keyof TeamStatsType) => {
        if (sortConfig.field !== field) return null;
        return sortConfig.direction === 'desc' ? <ArrowDownward /> : <ArrowUpward />;
    };

    const renderSortableHeader = (column: ColumnConfig) => {
        if (!column.sortable) {
            return (
                <TableCell 
                    key={column.key}
                    sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '0.85rem', 
                        width: column.width, 
                        textAlign: 'center' 
                    }}
                >
                    {column.label}
                </TableCell>
            );
        }

        return (
            <TableCell 
                key={column.key}
                sx={{ 
                    color: 'white', 
                    fontWeight: 'bold', 
                    fontSize: '0.85rem', 
                    width: column.width, 
                    textAlign: 'center', 
                    cursor: 'pointer' 
                }}
                onClick={() => handleSort(column.key)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    {column.label}
                    {renderSortIcon(column.key)}
                </Box>
            </TableCell>
        );
    };

    const renderStatsTable = (stats: Record<string, TeamStatsType & { rank?: number }>, type: 'offense' | 'defense') => (
        <TableContainer 
            component={Paper} 
            sx={{ 
                borderRadius: 3, 
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                maxWidth: '100%'
            }}
        >
            <Table size="small" sx={{ minWidth: 1200 }}>
                <TableHead>
                    {/* Section headers */}
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                        {TABLE_SECTIONS.map((section, index) => (
                            <TableCell 
                                key={index}
                                colSpan={section.colSpan} 
                                sx={{ 
                                    color: 'white', 
                                    fontWeight: 'bold', 
                                    fontSize: '0.9rem',
                                    borderBottom: '2px solid rgba(255,255,255,0.2)'
                                }}
                            >
                                {section.label}
                            </TableCell>
                        ))}
                    </TableRow>
                    
                    {/* Column headers */}
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', width: '50px', textAlign: 'center' }}>
                            Rank
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.85rem', width: '200px' }}>
                            Team
                        </TableCell>
                        {COLUMN_CONFIG.map(renderSortableHeader)}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.entries(stats).map(([teamName, teamStats], index) => {
                        const isAverage = teamName === 'League Average';
                        return (
                        <TableRow 
                            key={teamName}
                            sx={{ 
                                backgroundColor: isAverage ? 'grey.200' : (index % 2 === 0 ? 'background.paper' : 'grey.50'),
                                '&:hover': { 
                                    backgroundColor: isAverage ? 'grey.300' : 'grey.100',
                                    transition: 'background-color 0.2s ease'
                                },
                                height: '64px',
                                borderTop: isAverage ? '2px solid #1976d2' : 'none',
                                borderBottom: isAverage ? '2px solid #1976d2' : 'none'
                            }}
                        >
                            <TableCell sx={{ width: '50px', textAlign: 'center', py: 1.5 }}>
                                <Chip 
                                    label={isAverage ? 'AVG' : (teamStats.rank || index + 1)} 
                                    size="small" 
                                    color={isAverage ? 'primary' : 'default'}
                                    variant={isAverage ? 'filled' : 'outlined'}
                                    sx={{ 
                                        fontWeight: 'bold',
                                        minWidth: '32px'
                                    }}
                                />
                            </TableCell>
                            <TableCell sx={{ width: '200px', py: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    {!isAverage && <TeamLogo name={teamName} size={32} />}
                                    {isAverage ? (
                                        <Typography
                                            variant="body2"
                                            sx={{ 
                                                fontWeight: 'bold',
                                                color: 'primary.main',
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            {teamName}
                                        </Typography>
                                    ) : (
                                        <MuiLink
                                            component="button"
                                            onClick={() => handleTeamClick(teamName)}
                                            sx={{ 
                                                cursor: 'pointer',
                                                textDecoration: 'none',
                                                color: 'primary.main',
                                                fontWeight: 'medium',
                                                '&:hover': {
                                                    textDecoration: 'underline'
                                                }
                                            }}
                                        >
                                            {teamName}
                                        </MuiLink>
                                    )}
                                </Box>
                            </TableCell>
                            {COLUMN_CONFIG.map(column => (
                                <TableCell key={column.key} sx={{ width: column.width, textAlign: 'center', py: 1.5 }}>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            fontWeight: isAverage ? 'bold' : (column.key === 'ppg' ? 'bold' : 'normal'),
                                            color: isAverage ? 'primary.main' : (column.key === 'ppg' ? 'primary.main' : 'inherit')
                                        }}
                                    >
                                        {teamStats[column.key]}
                                    </Typography>
                                </TableCell>
                            ))}
                        </TableRow>
                    );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );

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
            {data && (
                <>
                {/* Page Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
                        Team Statistics
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                        {data.info.currentYear} Season - Week {data.info.currentWeek}
                    </Typography>
                </Box>

                {/* Stats Type Tabs */}
                <Box sx={{ 
                    borderBottom: 1, 
                    borderColor: 'divider', 
                    mb: 3,
                    backgroundColor: 'background.paper',
                    borderRadius: 2,
                    px: 2
                }}>
                    <Tabs 
                        value={tabValue} 
                        onChange={(_, newValue) => setTabValue(newValue)} 
                        centered
                        sx={{
                            '& .MuiTab-root': {
                                fontSize: '1rem',
                                fontWeight: 600,
                                py: 2,
                                px: 4
                            },
                            '& .Mui-selected': {
                                color: 'primary.main'
                            }
                        }}
                    >
                        <Tab 
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip 
                                        label="Offense" 
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                    />
                                </Box>
                            } 
                        />
                        <Tab 
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip 
                                        label="Defense" 
                                        size="small" 
                                        color="secondary" 
                                        variant="outlined"
                                    />
                                </Box>
                            } 
                        />
                    </Tabs>
                </Box>

                {/* Stats Tables */}
                <Box hidden={tabValue !== 0}>
                    {renderStatsTable(sortedStats.offense, 'offense')}
                </Box>
                <Box hidden={tabValue !== 1}>
                    {renderStatsTable(sortedStats.defense, 'defense')}
                </Box>

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

export default TeamStats;
