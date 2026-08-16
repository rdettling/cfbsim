import CloseIcon from '@mui/icons-material/Close';
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { EligibleNonConOpponent } from '../../types/league';
import { OpponentBrowser } from './OpponentBrowser';
import type { OpponentScheduleRequest } from './types';

type ScheduleOpponentDialogProps = {
  open: boolean;
  week: number | null;
  opponents: EligibleNonConOpponent[];
  query: string;
  loading: boolean;
  savingRequest: OpponentScheduleRequest | null;
  loadError: string | null;
  saveError: string | null;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
  onClose: () => void;
  onSchedule: (request: OpponentScheduleRequest) => void;
};

export const ScheduleOpponentDialog = ({
  open,
  week,
  opponents,
  query,
  loading,
  savingRequest,
  loadError,
  saveError,
  onQueryChange,
  onRetry,
  onClose,
  onSchedule,
}: ScheduleOpponentDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={savingRequest ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="schedule-opponent-dialog-title"
      slotProps={{
        paper: {
          sx: { height: fullScreen ? '100%' : 'min(78vh, 720px)', overflow: 'hidden' },
        },
      }}
    >
      <DialogTitle id="schedule-opponent-dialog-title" sx={{ py: 1.25, px: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography component="span" variant="subtitle1" sx={{ fontWeight: 600 }}>
            Schedule Week {week ?? '—'}
          </Typography>
          <IconButton aria-label="Close opponent selection" onClick={onClose} disabled={savingRequest !== null}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, minHeight: 0, overflow: 'hidden' }}>
        <OpponentBrowser
          week={week}
          opponents={opponents}
          query={query}
          loading={loading}
          loadError={loadError}
          saveError={saveError}
          savingRequest={savingRequest}
          onQueryChange={onQueryChange}
          onRetry={onRetry}
          onSchedule={onSchedule}
        />
      </DialogContent>
    </Dialog>
  );
};
