import { Box, Typography, LinearProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Team } from '../interfaces';

interface TeamHeaderProps {
    team: Team;
    teams: Team[];
    years?: string[];
    onTeamChange: (team: string) => void;
    onYearChange?: (year: string) => void;
    selectedYear?: string;
}

const TeamHeader = ({ team, teams, years, onTeamChange, onYearChange, selectedYear }: TeamHeaderProps) => {
    return (
        <Box sx={{ mb: 4 }}>
            <Box display="grid" gridTemplateColumns="1fr 2fr 1fr" gap={3}>
                <Box>
                    <Box
                        component="img"
                        src={`/logos/teams/${team.name}.png`}
                        sx={{ width: '100%', height: 'auto' }}
                        alt={team.name}
                    />
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h3">
                        #{team.ranking} {team.name} {team.mascot}
                    </Typography>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {team.rating} overall
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                        <LinearProgress
                            variant="determinate"
                            value={team.rating}
                            sx={{
                                height: 10,
                                backgroundColor: team.colorPrimary
                            }}
                        />
                    </Box>

                    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} sx={{ mb: 3 }}>
                        <Box>
                            <Typography variant="h6">Offense: {team.offense}</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={team.offense}
                                sx={{
                                    height: 8,
                                    backgroundColor: team.colorSecondary
                                }}
                            />
                        </Box>
                        <Box>
                            <Typography variant="h6">Defense: {team.defense}</Typography>
                            <LinearProgress
                                variant="determinate"
                                value={team.defense}
                                sx={{
                                    height: 8,
                                    backgroundColor: team.colorSecondary
                                }}
                            />
                        </Box>
                    </Box>

                    <Typography variant="h6">{team.conference?.confName}</Typography>
                    <Typography variant="h6" sx={{ mt: 3 }}>
                        {team.totalWins} - {team.totalLosses}
                        ({team.confWins} - {team.confLosses})
                    </Typography>
                </Box>

                <Box sx={{ textAlign: 'center' }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Team</InputLabel>
                        <Select
                            value={team.name}
                            onChange={(e) => onTeamChange(e.target.value)}
                            label="Team"
                        >
                            {teams.map(t => (
                                <MenuItem key={t.name} value={t.name}>
                                    {t.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {years && onYearChange && selectedYear && (
                        <FormControl fullWidth>
                            <InputLabel>Year</InputLabel>
                            <Select
                                value={selectedYear}
                                onChange={(e) => onYearChange(e.target.value)}
                                label="Year"
                            >
                                {years.map(year => (
                                    <MenuItem key={year} value={year}>
                                        {year}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default TeamHeader;
