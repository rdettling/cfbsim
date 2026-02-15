import { Box, Paper, Stack, Typography, Select, MenuItem } from '@mui/material';
import type { Team } from '../../types/domain';
import { TeamLogo } from './TeamComponents';

interface TeamHeaderProps {
  team: Team;
  teams: string[];
  onTeamChange: (team: string) => void;
}

const TeamHeader = ({ team, teams, onTeamChange }: TeamHeaderProps) => {
  return (
    <Paper elevation={2} sx={{ mb: 3, p: 3, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
        <TeamLogo name={team.name} size={72} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {team.ranking > 0 && `#${team.ranking} `}{team.name} {team.mascot}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Record: <strong>{team.record}</strong>
          </Typography>
        </Box>
        <Box sx={{ minWidth: 220 }}>
          <Typography variant="overline" color="text.secondary">
            Select Team
          </Typography>
          <Select
            fullWidth
            value={team.name}
            onChange={(event) => onTeamChange(event.target.value as string)}
            size="small"
          >
            {teams.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Stack>
    </Paper>
  );
};

export default TeamHeader;
