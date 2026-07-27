import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { Ref } from 'react';
import type { PlayoffTeamCount, PreviewData } from '../../types/domain';

type HomeSetupPanelProps = {
  years: string[];
  selectedYear: string;
  playoffTeams: PlayoffTeamCount;
  playoffAutobids: number;
  conferenceChampionsReceiveTopSeeds: boolean;
  preview: PreviewData | null;
  loading: boolean;
  error: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
  errorRef?: Ref<HTMLDivElement>;
  onYearChange: (year: string) => void;
  onPlayoffTeamsChange: (teams: PlayoffTeamCount) => void;
  onPlayoffAutobidsChange: (autobids: number) => void;
  onTopSeedsChange: (enabled: boolean) => void;
  onRetry: () => void;
  onContinue: () => void;
};

export const HomeSetupPanel = ({
  years,
  selectedYear,
  playoffTeams,
  playoffAutobids,
  conferenceChampionsReceiveTopSeeds,
  preview,
  loading,
  error,
  headingRef,
  errorRef,
  onYearChange,
  onPlayoffTeamsChange,
  onPlayoffAutobidsChange,
  onTopSeedsChange,
  onRetry,
  onContinue,
}: HomeSetupPanelProps) => {
  const handleYearChange = (event: SelectChangeEvent<string>) => {
    onYearChange(event.target.value);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
      }}
    >
      <Box>
        <Typography
          variant="overline"
          sx={{
            color: 'text.secondary',
          }}
        >
          Step 1
        </Typography>
        <Typography ref={headingRef} tabIndex={-1} variant="h5">
          League setup
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
          }}
        >
          Choose the historical season and postseason format.
        </Typography>
      </Box>
      <FormControl fullWidth size="small">
        <InputLabel id="home-season-label">Season</InputLabel>
        <Select
          labelId="home-season-label"
          value={selectedYear}
          label="Season"
          disabled={loading}
          onChange={handleYearChange}
        >
          {years.map((year) => (
            <MenuItem key={year} value={year}>
              {year} Season
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {error && (
        <Alert
          ref={errorRef}
          tabIndex={-1}
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {loading && (
        <Alert severity="info" aria-live="polite">
          Loading the {selectedYear} season…
        </Alert>
      )}
      <FormControl fullWidth size="small" disabled={!preview || loading}>
        <InputLabel id="home-playoff-size-label">Playoff teams</InputLabel>
        <Select
          labelId="home-playoff-size-label"
          value={String(playoffTeams)}
          label="Playoff teams"
          onChange={(event) => onPlayoffTeamsChange(Number(event.target.value) as PlayoffTeamCount)}
        >
          <MenuItem value="2">2 Teams (BCS)</MenuItem>
          <MenuItem value="4">4 Teams</MenuItem>
          <MenuItem value="12">12 Teams</MenuItem>
        </Select>
      </FormControl>
      {playoffTeams === 12 && (
        <>
          <FormControl fullWidth size="small" disabled={!preview || loading}>
            <InputLabel id="home-autobids-label">Conference champion autobids</InputLabel>
            <Select
              labelId="home-autobids-label"
              value={String(playoffAutobids)}
              label="Conference champion autobids"
              onChange={(event) => onPlayoffAutobidsChange(Number(event.target.value))}
            >
              {Array.from({ length: 11 }, (_, autobids) => (
                <MenuItem
                  key={autobids}
                  value={String(autobids)}
                  disabled={conferenceChampionsReceiveTopSeeds && autobids < 4}
                >
                  {autobids}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" disabled={!preview || loading}>
            <InputLabel id="home-top-seeds-label">
              Conference champions receive top four seeds
            </InputLabel>
            <Select
              labelId="home-top-seeds-label"
              value={conferenceChampionsReceiveTopSeeds ? 'true' : 'false'}
              label="Conference champions receive top four seeds"
              onChange={(event) => onTopSeedsChange(event.target.value === 'true')}
            >
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
        </>
      )}
      <Button
        variant="contained"
        disabled={!preview || loading || Boolean(error)}
        onClick={onContinue}
        sx={{ display: { xs: 'inline-flex', lg: 'none' }, alignSelf: 'stretch' }}
      >
        Continue to team selection
      </Button>
    </Paper>
  );
};
