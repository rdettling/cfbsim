import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamLogo } from '../team/TeamLogo';
import SeasonBanner from './SeasonBanner';
import NonSeasonBanner from './NonSeasonBanner';
import {
  isGroupActive,
  isPathActive,
  type AppNavigationData,
  type NavigationGroup,
  type NavigationModel,
  type StageAdvanceAction,
  type StageInfo,
} from './navigation';

interface DesktopNavigationProps {
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
  advanceActions?: StageAdvanceAction[];
  advanceLabel?: string;
}

const navButtonSx = (active: boolean) => ({
  minWidth: 'auto',
  px: 1.5,
  py: 1,
  borderRadius: 0,
  borderBottom: '2px solid',
  borderBottomColor: active ? 'primary.main' : 'transparent',
  color: active ? 'primary.main' : 'text.primary',
  backgroundColor: active ? 'action.selected' : 'transparent',
  '&:hover': {
    backgroundColor: 'action.hover',
  },
});

const DesktopNavigation = ({
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
  advanceActions,
  advanceLabel,
}: DesktopNavigationProps) => {
  const navigate = useNavigate();
  const [menuAnchors, setMenuAnchors] = useState<Record<string, HTMLElement | null>>({});

  const openMenu = (groupId: string) => (event: MouseEvent<HTMLElement>) => {
    setMenuAnchors((previous) => ({ ...previous, [groupId]: event.currentTarget }));
  };

  const closeMenu = (groupId: string) => {
    setMenuAnchors((previous) => ({ ...previous, [groupId]: null }));
  };

  const navigateFromMenu = (path: string, groupId: string) => {
    navigate(path);
    closeMenu(groupId);
  };

  const renderDirectItem = (item: NavigationModel['leading'][number]) => {
    const active = isPathActive(currentPath, item.path);
    return (
      <Button
        key={item.path}
        color="inherit"
        onClick={() => navigate(item.path)}
        aria-current={active ? 'page' : undefined}
        sx={navButtonSx(active)}
      >
        {item.label}
      </Button>
    );
  };

  const renderGroup = (group: NavigationGroup) => {
    const active = isGroupActive(currentPath, group);
    const open = Boolean(menuAnchors[group.id]);
    const menuId = `desktop-${group.id}-menu`;

    return (
      <Box key={group.id}>
        <Button
          color="inherit"
          onClick={openMenu(group.id)}
          aria-controls={open ? menuId : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="menu"
          sx={navButtonSx(active)}
        >
          {group.desktopLabel}
        </Button>
        <Menu
          id={menuId}
          anchorEl={menuAnchors[group.id]}
          open={open}
          onClose={() => closeMenu(group.id)}
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
          {group.items.map((item) => {
            const itemActive = isPathActive(currentPath, item.path);
            return (
              <MenuItem
                key={`${group.id}:${item.path}`}
                selected={itemActive}
                onClick={() => navigateFromMenu(item.path, group.id)}
                aria-current={itemActive ? 'page' : undefined}
              >
                {item.label}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>
    );
  };

  return (
    <AppBar
      component="div"
      position="static"
      color="default"
      elevation={0}
      sx={{
        display: { xs: 'none', lg: 'block' },
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', gap: 2.5, px: 3 }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: 'center',
            minWidth: 190,
          }}
        >
          <TeamLogo name={teamName} size={38} />
          <Typography
            variant="body2"
            sx={{
              maxWidth: 150,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
            title={teamName}
          >
            {teamName}
          </Typography>
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>{data.info.currentYear}</Typography>
            <Chip
              label={currentStageInfo?.banner_label ?? data.currentStage}
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Stack>

          <Divider orientation="vertical" flexItem />

          {data.currentStage === 'season' ? (
            <>
              <SeasonBanner info={data.info} />
              <Button variant="outlined" size="small" onClick={onLiveSim}>
                Live Sim
              </Button>
            </>
          ) : (
            currentStageInfo &&
            nextStageInfo && (
              <NonSeasonBanner
                currentStage={currentStageInfo}
                nextStage={nextStageInfo}
                advancing={advancingStage}
                disabled={advanceDisabled}
                onAdvance={onAdvanceStage}
                advanceActions={advanceActions}
                advanceLabel={advanceLabel}
              />
            )
          )}

          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Home">
              <IconButton
                aria-label="Home"
                onClick={() => navigate('/')}
                sx={{ color: 'text.secondary' }}
              >
                <HomeIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Toolbar>
      <Divider />
      <Toolbar
        component="nav"
        aria-label="Primary navigation"
        sx={{ minHeight: '44px !important', px: 3, gap: 0.25 }}
      >
        {model.leading.map(renderDirectItem)}
        {model.groups.map(renderGroup)}
        {model.trailing.map(renderDirectItem)}
      </Toolbar>
    </AppBar>
  );
};

export default DesktopNavigation;
