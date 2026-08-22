import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { SeasonProgressNavigationProps } from './SeasonProgressNavigation';

export const SeasonProgressMobile = ({
  calendar,
  advancing,
  disabled,
  onAdvanceToWeek,
  onOpenSummary,
}: SeasonProgressNavigationProps) => {
  const [open, setOpen] = useState(false);
  const actionDisabled = advancing || disabled;
  const mobileActionLabel = calendar.primaryAction.kind === 'summary'
    ? 'Summary'
    : calendar.currentWeek === calendar.lastWeek
      ? 'Finish Season'
      : 'Advance';

  const runPrimaryAction = () => {
    if (calendar.primaryAction.kind === 'summary') {
      onOpenSummary();
      return;
    }
    onAdvanceToWeek(calendar.primaryAction.targetWeek);
  };

  const selectWeek = (targetWeek: number) => {
    setOpen(false);
    onAdvanceToWeek(targetWeek);
  };

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', width: '100%', minWidth: 0 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {calendar.year} Season
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            {calendar.complete
              ? 'Season complete'
              : `Week ${calendar.currentWeek} of ${calendar.lastWeek}`}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setOpen(true)}
          disabled={advancing}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          View weeks
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={runPrimaryAction}
          disabled={actionDisabled}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', lineHeight: 1.15 }}
        >
          {mobileActionLabel}
        </Button>
      </Stack>

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            sx: {
              maxHeight: '88vh',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.25,
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              {calendar.year} Season
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Select a future week to simulate forward.
            </Typography>
          </Box>
          <IconButton aria-label="Close season weeks" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />
        <List aria-label="Season progress" sx={{ py: 0 }}>
          {calendar.steps.map(step => {
            const completed = step.state === 'completed';
            const current = step.state === 'current';
            return (
              <ListItemButton
                key={step.week}
                disabled={actionDisabled || completed || current}
                selected={current}
                onClick={() => selectWeek(step.week)}
                aria-current={current ? 'step' : undefined}
                aria-label={
                  completed
                    ? `Week ${step.week}, complete`
                    : current
                      ? `Week ${step.week}, current week`
                      : `Sim to Week ${step.week}`
                }
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid',
                      borderColor: current ? 'primary.main' : 'divider',
                      backgroundColor: current ? 'primary.main' : 'background.paper',
                      color: current
                        ? 'primary.contrastText'
                        : completed
                          ? 'text.disabled'
                          : 'text.secondary',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    {step.week}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={`Week ${step.week}`}
                  secondary={
                    completed
                      ? 'Complete'
                      : current
                        ? 'Current week'
                        : step.phase === 'postseason'
                          ? 'Postseason · Sim to this week'
                          : 'Sim to this week'
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
        {!calendar.complete && calendar.currentWeek < calendar.lastWeek && (
          <>
            <Divider />
            <Button
              variant="contained"
              onClick={() => selectWeek(calendar.lastWeek + 1)}
              disabled={actionDisabled}
              sx={{ m: 2 }}
            >
              End of Season
            </Button>
          </>
        )}
      </Drawer>
    </>
  );
};
