import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { Team } from '../../types/domain';
import { ConfLogo, TeamLogo } from './TeamComponents';

type TeamHeaderProps = {
  team: Team;
  teams: string[];
  onTeamChange: (name: string) => void;
};

const TeamHeader = ({ team, teams, onTeamChange }: TeamHeaderProps) => {
  const conferenceName = team.confName ?? team.conference;
  const prestige = Math.min(Math.max(team.prestige, 0), 7);

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        mb: 3,
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        borderLeft: '3px solid',
        borderLeftColor: team.colorPrimary || 'primary.main',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.5, md: 2 }}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ flexShrink: 0 }}>
            <TeamLogo name={team.name} size={52} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              variant="h4"
              sx={{
                fontSize: { xs: '1.45rem', sm: '1.7rem' },
                fontWeight: 600,
                lineHeight: 1.15,
              }}
            >
              {team.ranking > 0 && `#${team.ranking} `}
              {team.name} {team.mascot}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.75 }}
            >
              <Typography variant="body2" color="text.secondary">
                Record{' '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                  {team.record}
                </Box>
              </Typography>
              <Chip label={`Rating ${team.rating}`} size="small" variant="outlined" />
              <Chip label={`Prestige ${prestige}/7`} size="small" variant="outlined" />
              {conferenceName && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ color: 'text.secondary' }}
                >
                  {conferenceName !== 'Independent' && (
                    <ConfLogo name={conferenceName} size={22} />
                  )}
                  <Typography variant="body2">{conferenceName}</Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>

        <FormControl size="small" sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}>
          <InputLabel id="team-header-select-label">Team</InputLabel>
          <Select
            labelId="team-header-select-label"
            value={team.name}
            onChange={(event) => onTeamChange(event.target.value as string)}
            label="Team"
          >
            {teams.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Paper>
  );
};

export default TeamHeader;
