import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';

type ScheduleOpponentDialogProps = {
  open: boolean;
  week: number | null;
  options: string[];
  selectedOpponent: string | null;
  loading: boolean;
  saving: boolean;
  loadError: string | null;
  saveError: string | null;
  onOpponentChange: (opponent: string | null) => void;
  onClose: () => void;
  onSubmit: () => void;
};
export const ScheduleOpponentDialog = ({
  open,
  week,
  options,
  selectedOpponent,
  loading,
  saving,
  loadError,
  saveError,
  onOpponentChange,
  onClose,
  onSubmit,
}: ScheduleOpponentDialogProps) => {
  const noOptions = !loading && !loadError && options.length === 0;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="schedule-opponent-dialog-title"
    >
      <DialogTitle id="schedule-opponent-dialog-title">Schedule Week {week ?? '—'}</DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mb: 2,
          }}
        >
          Eligible opponents are outside your conference, have an open week, and have remaining
          non-conference capacity. Manually scheduled games are at home.
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {loadError}
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {saveError}
          </Alert>
        )}
        {noOptions && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            No eligible opponents are available for this week.
          </Alert>
        )}

        <Autocomplete
          options={options}
          value={selectedOpponent}
          onChange={(_, value) => onOpponentChange(value)}
          loading={loading}
          disabled={loading || saving || Boolean(loadError)}
          noOptionsText="No eligible opponents"
          loadingText="Loading eligible opponents…"
          renderInput={(params) => (
            <TextField {...params} label="Opponent" placeholder="Search teams" autoFocus />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={!selectedOpponent || loading || saving || Boolean(loadError) || noOptions}
        >
          {saving ? 'Scheduling…' : 'Schedule Game'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
