import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from '@mui/material';
import type { PlayoffTeamCount, PreviewData } from '../../types/domain';

export const PostseasonSection = ({
  preview,
  teams,
  autobids,
  topSeeds,
  eligibleConferences,
  disabled,
  onTeamsChange,
  onAutobidsChange,
  onTopSeedsChange,
}: {
  preview: PreviewData;
  teams: PlayoffTeamCount;
  autobids: number;
  topSeeds: boolean;
  eligibleConferences: number;
  disabled: boolean;
  onTeamsChange: (value: PlayoffTeamCount) => void;
  onAutobidsChange: (value: number) => void;
  onTopSeedsChange: (value: boolean) => void;
}) => {
  const historicalWasClamped =
    teams === 12 && preview.playoff.conf_champ_autobids > eligibleConferences;

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      <Typography id="new-league-postseason-heading" component="h2" variant="h4" tabIndex={-1} sx={{ outline: 'none' }}>
        Postseason format
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
        Your alignment has {eligibleConferences} championship-eligible conferences.
      </Typography>
      {historicalWasClamped && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          The historical automatic-bid default was reduced to match the available conferences.
        </Typography>
      )}
      <FormControl fullWidth sx={{ mt: 2.5 }}>
        <InputLabel id="playoff-teams-label">Playoff teams</InputLabel>
        <Select
          labelId="playoff-teams-label"
          value={teams}
          label="Playoff teams"
          disabled={disabled}
          onChange={event => onTeamsChange(Number(event.target.value) as PlayoffTeamCount)}
        >
          <MenuItem value={2}>2 Teams (BCS)</MenuItem>
          <MenuItem value={4}>4 Teams</MenuItem>
          <MenuItem value={12}>12 Teams</MenuItem>
        </Select>
      </FormControl>
      {teams === 12 && (
        <>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="autobids-label">Conference champion automatic bids</InputLabel>
            <Select
              labelId="autobids-label"
              value={autobids}
              label="Conference champion automatic bids"
              disabled={disabled}
              onChange={event => onAutobidsChange(Number(event.target.value))}
            >
              {Array.from(
                { length: Math.min(10, eligibleConferences) + 1 },
                (_, value) => (
                  <MenuItem key={value} value={value} disabled={topSeeds && value < 4}>
                    {value}
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>
          <FormControlLabel
            sx={{ mt: 1.5 }}
            control={
              <Switch
                checked={topSeeds}
                disabled={disabled || eligibleConferences < 4}
                onChange={event => {
                  onTopSeedsChange(event.target.checked);
                  if (event.target.checked && autobids < 4) onAutobidsChange(4);
                }}
              />
            }
            label="Conference champions receive the top four seeds"
          />
        </>
      )}
    </Box>
  );
};
