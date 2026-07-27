import { AppBar, Box, Chip, Divider, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { TeamLogo } from '../team/TeamComponents';
import SeasonBanner from './SeasonBanner';
import NonSeasonBanner from './NonSeasonBanner';
import MobileNavigationDrawer from './MobileNavigationDrawer';
import type { AppNavigationData, NavigationModel, StageInfo } from './navigation';

interface MobileNavigationProps {
  data: AppNavigationData;
  teamName: string;
  model: NavigationModel;
  currentPath: string;
  currentStageInfo?: StageInfo;
  nextStageInfo?: StageInfo;
  onLiveSim: () => void;
  advancingStage: boolean;
  advanceDisabled: boolean;
  onAdvanceStage: () => void;
}

const MobileNavigation = ({
  data,
  teamName,
  model,
  currentPath,
  currentStageInfo,
  nextStageInfo,
  onLiveSim,
  advancingStage,
  advanceDisabled,
  onAdvanceStage,
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
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.info.currentYear}
            </Typography>
            <Chip
              label={currentStageInfo?.banner_label ?? data.currentStage}
              size="small"
              variant="outlined"
              sx={{ maxWidth: 150, fontWeight: 600 }}
            />
          </Stack>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {data.currentStage === 'season'
              ? `Week ${data.info.currentWeek}`
              : currentStageInfo?.label}
          </Typography>
        </Box>

        {data.currentStage === 'season' ? (
          <SeasonBanner info={data.info} compact />
        ) : (
          currentStageInfo &&
          nextStageInfo && (
            <NonSeasonBanner
              currentStage={currentStageInfo}
              nextStage={nextStageInfo}
              compact
              advancing={advancingStage}
              disabled={advanceDisabled}
              onAdvance={onAdvanceStage}
            />
          )
        )}
      </Stack>
      <MobileNavigationDrawer
        id={drawerId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={data}
        teamName={teamName}
        model={model}
        currentPath={currentPath}
        currentStageInfo={currentStageInfo}
        onLiveSim={onLiveSim}
      />
    </AppBar>
  );
};

export default MobileNavigation;
