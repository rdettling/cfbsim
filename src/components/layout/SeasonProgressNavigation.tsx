import {
  Box,
  Button,
  ButtonBase,
  Divider,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useId, useState, type MouseEvent } from 'react';
import type { SeasonCalendarModel } from './leagueCalendar';

export interface SeasonProgressNavigationProps {
  calendar: SeasonCalendarModel;
  advancing: boolean;
  disabled: boolean;
  onAdvanceToWeek: (targetWeek: number) => void;
  onOpenSummary: () => void;
}

export const SeasonProgressDesktop = ({
  calendar,
  advancing,
  disabled,
  onAdvanceToWeek,
  onOpenSummary,
}: SeasonProgressNavigationProps) => {
  const menuId = useId();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const actionDisabled = advancing || disabled;
  const menuOpen = Boolean(menuAnchor);

  const selectDestination = (targetWeek: number) => {
    setMenuAnchor(null);
    onAdvanceToWeek(targetWeek);
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', alignSelf: 'stretch', minWidth: 0, flexShrink: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          gap: 0.35,
        }}
      >
        <Box
          component="ol"
          aria-label="Season progress"
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
          {calendar.steps.map((step, index) => {
            const completed = step.state === 'completed';
            const current = step.state === 'current';
            const postseasonStart = step.phase === 'postseason' &&
              calendar.steps[index - 1]?.phase === 'regular-season';
            return (
              <Box
                component="li"
                key={step.week}
                sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
              >
                {postseasonStart && (
                  <Divider
                    orientation="vertical"
                    flexItem
                    aria-label="Postseason"
                    sx={{ mx: { lg: 0.35, xl: 0.6 } }}
                  />
                )}
                {index > 0 && !postseasonStart && (
                  <Box
                    aria-hidden
                    sx={{
                      width: { lg: 2, xl: 5 },
                      height: 1,
                      backgroundColor:
                        step.week <= calendar.currentWeek ? 'primary.main' : 'divider',
                      flexShrink: 0,
                    }}
                  />
                )}
                <ButtonBase
                  disabled={actionDisabled || completed || current}
                  onClick={() => onAdvanceToWeek(step.week)}
                  aria-current={current ? 'step' : undefined}
                  aria-label={
                    completed
                      ? `Week ${step.week}, complete`
                      : current
                        ? `Week ${step.week}, current week`
                        : `Sim to Week ${step.week}`
                  }
                  title={step.phase === 'postseason'
                    ? `Week ${step.week} · Postseason`
                    : `Week ${step.week}`}
                  sx={{
                    width: { lg: 20, xl: 22 },
                    height: { lg: 20, xl: 22 },
                    borderRadius: '50%',
                    border: '1px solid',
                    borderColor: current ? 'primary.main' : 'divider',
                    backgroundColor: current ? 'primary.main' : 'background.paper',
                    color: current
                      ? 'primary.contrastText'
                      : completed
                        ? 'text.disabled'
                        : 'text.secondary',
                    fontSize: { lg: '0.61rem', xl: '0.66rem' },
                    fontWeight: 700,
                    flexShrink: 0,
                    '&:hover': {
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      backgroundColor: 'action.hover',
                    },
                    '&.Mui-disabled': {
                      color: current ? 'primary.contrastText' : 'text.disabled',
                    },
                  }}
                >
                  {step.week}
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `14fr ${calendar.lastWeek - 14}fr`,
            alignItems: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.6rem',
              fontWeight: 600,
              lineHeight: 1,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            Regular Season
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.6rem',
              fontWeight: 600,
              lineHeight: 1,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            Postseason
          </Typography>
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      {calendar.menuDestinations.length > 0 ? (
        <>
          <Button
            variant="contained"
            size="small"
            disabled={actionDisabled}
            aria-controls={menuOpen ? menuId : undefined}
            aria-expanded={menuOpen ? 'true' : undefined}
            aria-haspopup="menu"
            onClick={(event: MouseEvent<HTMLButtonElement>) =>
              setMenuAnchor(event.currentTarget)}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Advance
          </Button>
          <Menu
            id={menuId}
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={() => setMenuAnchor(null)}
            slotProps={{
              paper: {
                elevation: 1,
                sx: {
                  mt: 0.75,
                  minWidth: 180,
                  maxHeight: 420,
                  border: '1px solid',
                  borderColor: 'divider',
                },
              },
            }}
          >
            {calendar.menuDestinations.map(destination => (
              <MenuItem
                key={`${destination.kind}:${destination.targetWeek}`}
                onClick={() => selectDestination(destination.targetWeek)}
                sx={destination.kind === 'end'
                  ? { borderTop: '1px solid', borderColor: 'divider' }
                  : undefined}
              >
                {destination.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : (
        <Button
          variant="contained"
          size="small"
          onClick={onOpenSummary}
          disabled={actionDisabled}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {calendar.primaryAction.label}
        </Button>
      )}
    </Stack>
  );
};
