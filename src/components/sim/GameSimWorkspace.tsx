import { Box, Paper, Stack, Tab, Tabs, Typography, useTheme } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ReactNode } from 'react';

export type GameSimView = 'field' | 'drives';

type GameSimWorkspaceProps = {
  activeView: GameSimView;
  onViewChange: (view: GameSimView) => void;
  field: ReactNode;
  drives: ReactNode;
  coachPanel: ReactNode;
  showCoachPanelOnDrives?: boolean;
  situationLabel: string;
  driveNumber: number;
  lastPlayText: string;
};

const GameSimWorkspace = ({
  activeView,
  onViewChange,
  field,
  drives,
  coachPanel,
  showCoachPanelOnDrives = false,
  situationLabel,
  driveNumber,
  lastPlayText,
}: GameSimWorkspaceProps) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(0, 1.75fr) minmax(330px, 0.75fr)',
        },
        gridTemplateRows: { xs: 'auto auto', lg: 'auto minmax(0, 1fr)' },
        gridTemplateAreas: {
          xs: '"game" "coach"',
          lg: '"field drives" "coach drives"',
        },
        gap: 1.25,
        minHeight: 0,
        height: { xs: 'auto', lg: '100%' },
        overflow: { xs: 'visible', lg: 'hidden' },
        alignItems: 'stretch',
      }}
    >
      <Paper
        component="section"
        variant="outlined"
        aria-label="Game view"
        sx={{
          gridArea: { xs: 'game' },
          display: { xs: 'flex', lg: 'contents' },
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {!isDesktop && (
          <Tabs
            value={activeView}
            onChange={(_, view: GameSimView) => onViewChange(view)}
            variant="fullWidth"
            selectionFollowsFocus
            aria-label="Live simulation views"
            sx={{
              minHeight: 42,
              flexShrink: 0,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Tab
              id="live-sim-field-tab"
              aria-controls="live-sim-field-panel"
              value="field"
              label="Field"
              sx={{ minHeight: 42 }}
            />
            <Tab
              id="live-sim-drives-tab"
              aria-controls="live-sim-drives-panel"
              value="drives"
              label="Drives"
              sx={{ minHeight: 42 }}
            />
          </Tabs>
        )}

        <Box
          component="section"
          id="live-sim-field-panel"
          role={isDesktop ? 'region' : 'tabpanel'}
          aria-label={isDesktop ? 'Field' : undefined}
          aria-labelledby={isDesktop ? undefined : 'live-sim-field-tab'}
          hidden={!isDesktop && activeView !== 'field'}
          sx={{
            gridArea: { lg: 'field' },
            display: { xs: activeView === 'field' ? 'flex' : 'none', lg: 'flex' },
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            border: { xs: 0, lg: '1px solid' },
            borderColor: { lg: 'divider' },
            borderRadius: { lg: 1 },
            backgroundColor: 'background.paper',
          }}
        >
          <Stack spacing={1} sx={{ p: { xs: 1, sm: 1.25 } }}>
            {field}
            <Box
              component="section"
              aria-label="Current game status"
              aria-live="polite"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                columnGap: 1,
                rowGap: 0.15,
                px: 1,
                py: 0.65,
                minWidth: 0,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                backgroundColor: 'action.hover',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {situationLabel}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                Drive {driveNumber}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  gridColumn: '1 / -1',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'text.secondary',
                }}
              >
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Previous play:
                </Box>{' '}
                {lastPlayText || 'No plays yet'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box
          component="section"
          id="live-sim-drives-panel"
          role={isDesktop ? 'region' : 'tabpanel'}
          aria-label={isDesktop ? 'Drives' : undefined}
          aria-labelledby={isDesktop ? undefined : 'live-sim-drives-tab'}
          hidden={!isDesktop && activeView !== 'drives'}
          sx={{
            gridArea: { lg: 'drives' },
            display: { xs: activeView === 'drives' ? 'flex' : 'none', lg: 'flex' },
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            height: { lg: '100%' },
            maxHeight: {
              xs: 'min(40dvh, 340px)',
              sm: 'min(48dvh, 480px)',
              lg: 'none',
            },
            overflow: 'hidden',
            border: { xs: 0, lg: '1px solid' },
            borderColor: { lg: 'divider' },
            borderRadius: { lg: 1 },
            backgroundColor: 'background.paper',
          }}
        >
          {isDesktop && (
            <Typography
              component="h2"
              variant="subtitle2"
              sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              Drives
            </Typography>
          )}
          <Box
            component="section"
            aria-label="Drive history"
            tabIndex={0}
            sx={{
              minHeight: 0,
              flex: 1,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              p: { xs: 1, sm: 1.25 },
            }}
          >
            {drives}
          </Box>
        </Box>
      </Paper>

      <Box
        component="aside"
        aria-label="Coaching controls"
        sx={{
          gridArea: 'coach',
          display: {
            xs: activeView === 'field' || showCoachPanelOnDrives ? 'block' : 'none',
            lg: 'block',
          },
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          overflowY: { xs: 'visible', lg: 'auto' },
          scrollbarWidth: 'thin',
        }}
      >
        {coachPanel}
      </Box>
    </Box>
  );
};

export default GameSimWorkspace;
