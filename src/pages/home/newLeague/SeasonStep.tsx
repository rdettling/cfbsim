import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { StepActions } from './StepActions';

export const SeasonStep = ({
  years,
  selectedYear,
  loading,
  onYearChange,
  onContinue,
}: {
  years: string[];
  selectedYear: string;
  loading: boolean;
  onYearChange: (year: string) => void;
  onContinue: () => void;
}) => (
  <Box sx={{ maxWidth: 640, mx: 'auto' }}>
    <Typography variant="h4">Choose your starting season</Typography>
    <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
      The season determines the available programs, program strength, historical context,
      and the conference structure you can customize.
    </Typography>
    <FormControl fullWidth sx={{ mt: 3 }}>
      <InputLabel id="starting-season-label">Starting season</InputLabel>
      <Select
        labelId="starting-season-label"
        value={selectedYear}
        label="Starting season"
        disabled={loading}
        onChange={event => void onYearChange(event.target.value)}
      >
        {years.map(year => <MenuItem key={year} value={year}>{year} Season</MenuItem>)}
      </Select>
    </FormControl>
    {loading && <Alert severity="info" sx={{ mt: 2 }}>Loading season data…</Alert>}
    <StepActions next={onContinue} disabled={loading || !selectedYear} />
  </Box>
);
