import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type {
  ConferenceStructurePolicy,
  NextSeasonConfiguration,
  PlayoffTeamCount,
  PostseasonFormatPolicy,
} from '../../types/domain';

interface NextSeasonConfigurationPanelProps {
  configuration: NextSeasonConfiguration;
  saving: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
  onChange: (patch: Partial<NextSeasonConfiguration>) => void;
}

export const NextSeasonConfigurationPanel = ({
  configuration,
  saving,
  status,
  error,
  onChange,
}: NextSeasonConfigurationPanelProps) => {
  const handlePlayoffTeams = (event: SelectChangeEvent<number>) => {
    onChange({ playoffTeams: Number(event.target.value) as PlayoffTeamCount });
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 },
        height: { lg: '100%' },
        overflowY: { lg: 'auto' },
      }}
    >
      <Stack spacing={2.5}>
        <Box>
          <Typography component="h2" variant="h6">
            Season policies
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Changes save immediately. Structure is applied only when you advance.
          </Typography>
        </Box>

        <FormControl disabled={saving}>
          <FormLabel>Conference structure</FormLabel>
          <RadioGroup
            value={configuration.conferencePolicy}
            onChange={(event) =>
              onChange({
                conferencePolicy: event.target.value as ConferenceStructurePolicy,
              })
            }
          >
            <FormControlLabel
              value="historical"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">Follow historical alignment</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Use conference membership from the resolved historical year.
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="current"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">Keep current alignment</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Preserve every team’s current conference.
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        <FormControl disabled={saving}>
          <FormLabel>Postseason format</FormLabel>
          <RadioGroup
            value={configuration.postseasonPolicy}
            onChange={(event) =>
              onChange({
                postseasonPolicy: event.target.value as PostseasonFormatPolicy,
              })
            }
          >
            <FormControlLabel
              value="historical"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">Follow historical format</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Use the playoff format from the resolved historical year.
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="custom"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body2">Custom format</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    Keep the supported playoff format selected below.
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        {configuration.postseasonPolicy === 'custom' && (
          <Stack spacing={2}>
            <FormControl size="small" disabled={saving}>
              <FormLabel sx={{ mb: 0.75 }}>Playoff teams</FormLabel>
              <Select value={configuration.playoffTeams} onChange={handlePlayoffTeams}>
                <MenuItem value={2}>2 teams</MenuItem>
                <MenuItem value={4}>4 teams</MenuItem>
                <MenuItem value={12}>12 teams</MenuItem>
              </Select>
            </FormControl>

            {configuration.playoffTeams === 12 && (
              <>
                <FormControl size="small" disabled={saving}>
                  <FormLabel sx={{ mb: 0.75 }}>Conference champion automatic bids</FormLabel>
                  <Select
                    value={configuration.playoffAutobids ?? 6}
                    onChange={(event) =>
                      onChange({
                        playoffAutobids: Number(event.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 11 }, (_, autobids) => (
                      <MenuItem key={autobids} value={autobids}>
                        {autobids}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  disabled={saving}
                  control={
                    <Switch
                      checked={configuration.conferenceChampionsReceiveTopSeeds ?? false}
                      onChange={(event) =>
                        onChange({
                          conferenceChampionsReceiveTopSeeds: event.target.checked,
                        })
                      }
                    />
                  }
                  label="Conference champions receive the top seeds"
                />
              </>
            )}
          </Stack>
        )}

        <Box aria-live="polite">
          {status === 'saving' && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
              }}
            >
              Saving…
            </Typography>
          )}
          {status === 'saved' && (
            <Typography
              variant="caption"
              sx={{
                color: 'success.main',
              }}
            >
              Saved
            </Typography>
          )}
          {status === 'error' && error && <Alert severity="error">{error}</Alert>}
        </Box>
      </Stack>
    </Paper>
  );
};
