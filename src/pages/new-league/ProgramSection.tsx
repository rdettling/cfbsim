import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { TeamLogo } from '../../components/team/TeamLogo';
import type { PreviewData } from '../../types/domain';

const conferenceName = (value: string | null) => value ?? 'Independent';

export const ProgramSection = ({
  years,
  selectedYear,
  preview,
  selectedTeam,
  search,
  loading,
  onYearChange,
  onSearchChange,
  onSelect,
}: {
  years: string[];
  selectedYear: string;
  preview: PreviewData;
  selectedTeam: string | null;
  search: string;
  loading: boolean;
  onYearChange: (year: string) => void;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) => {
  const normalized = search.trim().toLocaleLowerCase();
  const teams = preview.teams.filter(team =>
    `${team.name} ${team.mascot}`.toLocaleLowerCase().includes(normalized),
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexShrink: 0 }}>
        <Typography id="new-league-program-heading" component="h2" variant="h4" tabIndex={-1} sx={{ outline: 'none' }}>
          Choose your program
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Pick a starting season, then choose the program you will lead.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
          <FormControl size="small" sx={{ minWidth: { sm: 190 } }}>
            <InputLabel id="starting-season-label">Starting season</InputLabel>
            <Select
              labelId="starting-season-label"
              value={selectedYear}
              label="Starting season"
              disabled={loading}
              onChange={event => onYearChange(event.target.value)}
            >
              {years.map(year => (
                <MenuItem key={year} value={year}>{year} Season</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label="Search programs"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
          />
        </Stack>
        {loading && (
          <Alert severity="info" sx={{ mt: 1.5 }} aria-live="polite">
            Loading season data…
          </Alert>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mt: 1.5, pr: 0.5 }}>
        <Stack spacing={0.75}>
          {teams.map(team => (
            <Button
              key={team.name}
              variant={selectedTeam === team.name ? 'contained' : 'outlined'}
              onClick={() => onSelect(team.name)}
              aria-pressed={selectedTeam === team.name}
              sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1.1 }}
            >
              <TeamLogo name={team.name} size={34} />
              <Box sx={{ ml: 1.25, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>
                  {team.name} {team.mascot}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {conferenceName(team.conferenceName)} · Prestige {team.prestige}
                </Typography>
              </Box>
            </Button>
          ))}
          {!teams.length && (
            <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
              No programs match this search.
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
};
