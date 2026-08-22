import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  ButtonBase,
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
import {
  type OffseasonFlowStage,
} from '../../constants/stages';
import type { OffseasonCalendarModel } from './leagueCalendar';

interface OffseasonFlowNavigationProps {
  calendar: OffseasonCalendarModel;
  advancing: boolean;
  disabled: boolean;
  onSelectStage: (stage: OffseasonFlowStage) => void;
  onStartSeason: () => void;
}

export const OffseasonFlowDesktop = ({
  calendar,
  advancing,
  disabled,
  onSelectStage,
  onStartSeason,
}: OffseasonFlowNavigationProps) => {
  const { currentPosition, steps, year } = calendar;

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ alignItems: 'center', minWidth: 0, flexShrink: 0 }}
    >
      <Box
        component="ol"
        aria-label="Offseason stages"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minWidth: 0,
          m: 0,
          p: 0,
          listStyle: 'none',
        }}
      >
        {steps.map(step => {
          const { id: stage, position: index, label } = step;
          const completed = step.state === 'completed';
          const current = step.state === 'current';
          const stageDisabled =
            advancing || completed || (!current && disabled);
          return (
            <Box
              component="li"
              key={stage}
              sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
            >
              {index > 0 && (
                <Box
                  aria-hidden
                  sx={{
                    width: { lg: 8, xl: 16 },
                    height: 1,
                    backgroundColor:
                      index <= currentPosition ? 'primary.main' : 'divider',
                    flexShrink: 0,
                  }}
                />
              )}
              <ButtonBase
                disabled={stageDisabled}
                onClick={() => onSelectStage(stage)}
                aria-current={current ? 'step' : undefined}
                aria-label={!current && !completed ? `Sim to ${label}` : label}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                  minWidth: { lg: 54, xl: 66 },
                  px: 0.35,
                  py: 0.35,
                  borderRadius: 1,
                  color: current
                    ? 'primary.main'
                    : completed
                      ? 'success.main'
                      : 'text.secondary',
                  opacity: completed ? 0.85 : 1,
                  '&:hover': {
                    backgroundColor: current
                      ? 'action.selected'
                      : 'action.hover',
                  },
                  '&.Mui-disabled': {
                    color: completed ? 'success.main' : 'text.disabled',
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid',
                    borderColor: current
                      ? 'primary.main'
                      : completed
                        ? 'success.main'
                        : 'divider',
                    backgroundColor: current
                      ? 'primary.main'
                      : 'background.paper',
                    color: current ? 'primary.contrastText' : 'inherit',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}
                >
                  {completed ? <CheckIcon sx={{ fontSize: 14 }} /> : index + 1}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: { lg: '0.64rem', xl: '0.7rem' },
                    fontWeight: current ? 700 : 600,
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </Typography>
              </ButtonBase>
            </Box>
          );
        })}
      </Box>
      <Button
        variant="contained"
        size="small"
        onClick={onStartSeason}
        disabled={advancing || disabled}
        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        Start {year} Season
      </Button>
    </Stack>
  );
};

export const OffseasonFlowMobile = ({
  calendar,
  advancing,
  disabled,
  onSelectStage,
  onStartSeason,
}: OffseasonFlowNavigationProps) => {
  const [open, setOpen] = useState(false);
  const { currentPosition, steps, year } = calendar;

  const selectStage = (stage: OffseasonFlowStage) => {
    setOpen(false);
    onSelectStage(stage);
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
            {year} Offseason · {currentPosition + 1} of {steps.length}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {steps[currentPosition].label}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setOpen(true)}
          disabled={advancing}
          sx={{ flexShrink: 0 }}
        >
          View stages
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={onStartSeason}
          disabled={advancing || disabled}
          sx={{ flexShrink: 0, lineHeight: 1.15 }}
        >
          Start {year} Season
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
              {year} Offseason
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Select a future stage to simulate forward.
            </Typography>
          </Box>
          <IconButton
            aria-label="Close offseason stages"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />
        <List aria-label="Offseason stages" sx={{ py: 0 }}>
          {steps.map(step => {
            const { id: stage, position: index, label } = step;
            const completed = step.state === 'completed';
            const current = step.state === 'current';
            const stageDisabled =
              advancing || completed || (!current && disabled);
            return (
              <ListItemButton
                key={stage}
                disabled={stageDisabled}
                selected={current}
                onClick={() => selectStage(stage)}
                aria-current={current ? 'step' : undefined}
                aria-label={!current && !completed ? `Sim to ${label}` : label}
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
                      borderColor: current
                        ? 'primary.main'
                        : completed
                          ? 'success.main'
                          : 'divider',
                      backgroundColor: current
                        ? 'primary.main'
                        : 'background.paper',
                      color: current
                        ? 'primary.contrastText'
                        : completed
                          ? 'success.main'
                          : 'text.secondary',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {completed ? <CheckIcon sx={{ fontSize: 16 }} /> : index + 1}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  secondary={
                    completed
                      ? 'Complete'
                      : current
                        ? 'Current stage'
                        : 'Sim to this stage'
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
        <Divider />
        <Button
          variant="contained"
          onClick={() => {
            setOpen(false);
            onStartSeason();
          }}
          disabled={advancing || disabled}
          sx={{ m: 2 }}
        >
          Start {year} Season
        </Button>
      </Drawer>
    </>
  );
};
