import { Box, Typography, LinearProgress, FormControl, InputLabel, Select, MenuItem, Paper, Stack } from '@mui/material';
import { Team } from '../interfaces';
import { TeamLogo, ConfLogo } from './TeamComponents';

interface TeamHeaderProps {
    team: Team;
    teams: Team[];
    years?: string[];
    onTeamChange: (team: string) => void;
    onYearChange?: (year: string) => void;
    selectedYear?: string;
}

// Reusable component for rating bars
const RatingBar = ({ value, height = 8, color }: { value: number, height?: number, color: string }) => (
    <LinearProgress
        variant="determinate"
        value={value}
        sx={{
            height,
            borderRadius: 1,
            border: '1px solid rgba(0,0,0,0.2)',  // Added border for visibility
            backgroundColor: 'rgba(0,0,0,0.1)',
            '& .MuiLinearProgress-bar': { backgroundColor: color }
        }}
    />
);

const TeamHeader = ({ team, teams, years, onTeamChange, onYearChange, selectedYear }: TeamHeaderProps) => {
    const primaryColor = team.colorPrimary || '#1976d2';
    const secondaryColor = team.colorSecondary || '#90caf9';

    return (
        <Paper elevation={2} sx={{ mb: 4, p: 3, borderRadius: 2 }}>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 2fr 1fr' }} gap={3}>
                {/* Logo Column */}
                <Stack alignItems="center" spacing={2}>
                    <TeamLogo name={team.name} size={160} />
                    {team.conference && (
                        <>
                            <ConfLogo name={team.conference} size={60} />
                            <Typography variant="subtitle1">{team.conference}</Typography>
                        </>
                    )}
                </Stack>

                {/* Team Info Column */}
                <Stack spacing={3} alignItems="center">
                    <Box textAlign="center">
                        <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {team.ranking > 0 && `#${team.ranking} `}{team.name} {team.mascot}
                        </Typography>
                        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
                            {team.record}
                        </Typography>
                    </Box>

                    {/* Overall Rating */}
                    <Stack width="100%" spacing={1}>
                        <Typography variant="h6">Overall Rating: {team.rating}</Typography>
                        <RatingBar value={team.rating} height={12} color={primaryColor} />

                        {/* Offense and Defense in one row */}
                        <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} mt={2}>
                            <Box>
                                <Typography variant="body1" fontWeight="medium">Offense: {team.offense}</Typography>
                                <RatingBar value={team.offense} color={secondaryColor} />
                            </Box>
                            <Box>
                                <Typography variant="body1" fontWeight="medium">Defense: {team.defense}</Typography>
                                <RatingBar value={team.defense} color={secondaryColor} />
                            </Box>
                        </Box>
                    </Stack>
                </Stack>

                {/* Controls Column */}
                <Stack justifyContent="center" spacing={2}>
                    <FormControl>
                        <InputLabel>Team</InputLabel>
                        <Select
                            value={team.name}
                            onChange={(e) => onTeamChange(e.target.value)}
                            label="Team"
                        >
                            {teams.map(t => (
                                <MenuItem key={t.name} value={t.name}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TeamLogo name={t.name} size={24} />
                                        <Typography>{t.name}</Typography>
                                    </Stack>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {years && onYearChange && selectedYear && (
                        <FormControl>
                            <InputLabel>Year</InputLabel>
                            <Select
                                value={selectedYear}
                                onChange={(e) => onYearChange(e.target.value)}
                                label="Year"
                            >
                                {years.map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                            </Select>
                        </FormControl>
                    )}
                </Stack>
            </Box>
        </Paper>
    );
};

export default TeamHeader;
