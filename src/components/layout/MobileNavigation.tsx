import { AppBar, Divider, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { TeamLogo } from '../team/TeamLogo';
import MobileNavigationDrawer from './MobileNavigationDrawer';
import { OffseasonFlowMobile } from './OffseasonFlowNavigation';
import { SeasonProgressMobile } from './SeasonProgressMobile';
import type { OffseasonFlowStage } from '../../constants/stages';
import type { NavigationModel } from './navigation';
import type { LeagueCalendarModel } from './leagueCalendar';

interface MobileNavigationProps {
  teamName: string;
  model: NavigationModel;
  currentPath: string;
  calendar: LeagueCalendarModel;
  onLiveSim: () => void;
  advancing: boolean;
  advanceDisabled: boolean;
  onSelectFlowStage: (stage: OffseasonFlowStage) => void;
  onStartSeason: () => void;
  onAdvanceToWeek: (targetWeek: number) => void;
  onOpenSummary: () => void;
}

const MobileNavigation = ({
  teamName,
  model,
  currentPath,
  calendar,
  onLiveSim,
  advancing,
  advanceDisabled,
  onSelectFlowStage,
  onStartSeason,
  onAdvanceToWeek,
  onOpenSummary,
}: MobileNavigationProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = 'application-navigation-drawer';

  return (
    <AppBar
      component="div"
      position="static"
      color="default"
      elevation={0}
      sx={{
        display: { xs: 'block', lg: 'none' },
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: '56px !important', px: { xs: 1.5, sm: 2 } }}>
        <IconButton
          edge="start"
          aria-label="Open navigation"
          aria-controls={drawerId}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          sx={{ mr: 1 }}
        >
          <MenuIcon />
        </IconButton>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            minWidth: 0,
            flex: 1,
          }}
        >
          <TeamLogo name={teamName} size={32} />
          <Typography
            variant="body2"
            sx={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            {teamName}
          </Typography>
        </Stack>
      </Toolbar>
      <Divider />
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 48,
          px: { xs: 2, sm: 2.5 },
          py: 0.75,
        }}
      >
        {calendar.kind === 'season' ? (
          <SeasonProgressMobile
            calendar={calendar}
            advancing={advancing}
            disabled={advanceDisabled}
            onAdvanceToWeek={onAdvanceToWeek}
            onOpenSummary={onOpenSummary}
          />
        ) : (
          <OffseasonFlowMobile
            calendar={calendar}
            advancing={advancing}
            disabled={advanceDisabled}
            onSelectStage={onSelectFlowStage}
            onStartSeason={onStartSeason}
          />
        )}
      </Stack>
      <MobileNavigationDrawer
        id={drawerId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        teamName={teamName}
        model={model}
        currentPath={currentPath}
        calendar={calendar}
        onLiveSim={onLiveSim}
        actionsDisabled={advancing}
      />
    </AppBar>
  );
};

export default MobileNavigation;
