import {
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamLogo } from '../team/TeamComponents';
import {
  isGroupActive,
  isPathActive,
  type AppNavigationData,
  type NavigationItem,
  type NavigationModel,
  type StageInfo,
} from './navigation';

interface MobileNavigationDrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  data: AppNavigationData;
  teamName: string;
  model: NavigationModel;
  currentPath: string;
  currentStageInfo?: StageInfo;
  onLiveSim: () => void;
}

const MobileNavigationDrawer = ({
  id,
  open,
  onClose,
  data,
  teamName,
  model,
  currentPath,
  currentStageInfo,
  onLiveSim,
}: MobileNavigationDrawerProps) => {
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const navigateAndClose = (path: string) => {
    navigate(path);
    onClose();
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupId]: !previous[groupId],
    }));
  };

  const handleLiveSim = () => {
    onClose();
    onLiveSim();
  };

  const renderDirectItem = (item: NavigationItem) => {
    const active = isPathActive(currentPath, item.path);
    return (
      <ListItemButton
        key={item.path}
        selected={active}
        onClick={() => navigateAndClose(item.path)}
        aria-current={active ? 'page' : undefined}
      >
        <ListItemText primary={item.label} />
      </ListItemButton>
    );
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      slotProps={{
        paper: {
          id,
          sx: { width: 'min(320px, 85vw)' },
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          minHeight: 64,
          px: 2,
        }}
      >
        <TeamLogo name={teamName} size={36} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            {teamName}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {data.info.currentYear} · {currentStageInfo?.banner_label ?? data.currentStage}
          </Typography>
        </Box>
        <IconButton aria-label="Close navigation" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />
      <List component="nav" aria-label="Primary navigation" sx={{ py: 1 }}>
        {model.leading.map(renderDirectItem)}

        {model.groups.map((group) => {
          const expanded = Boolean(expandedGroups[group.id]);
          const active = isGroupActive(currentPath, group);
          const groupItemsId = `mobile-${group.id}-items`;
          return (
            <Box key={group.id}>
              <ListItemButton
                selected={active}
                onClick={() => toggleGroup(group.id)}
                aria-controls={groupItemsId}
                aria-expanded={expanded}
              >
                <ListItemText primary={group.mobileLabel} />
                {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              <Collapse id={groupItemsId} in={expanded} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {group.items.map((item) => {
                    const itemActive = isPathActive(currentPath, item.path);
                    return (
                      <ListItemButton
                        key={`${group.id}:${item.path}`}
                        selected={itemActive}
                        onClick={() => navigateAndClose(item.path)}
                        aria-current={itemActive ? 'page' : undefined}
                        sx={{ pl: 4 }}
                      >
                        <ListItemText primary={item.label} />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}

        {model.trailing.map(renderDirectItem)}
      </List>
      <Divider />
      <List subheader={<ListSubheader component="div">Actions and utilities</ListSubheader>}>
        {data.currentStage === 'season' && (
          <ListItemButton onClick={handleLiveSim}>
            <ListItemIcon>
              <PlayArrowIcon />
            </ListItemIcon>
            <ListItemText primary="Live Sim" />
          </ListItemButton>
        )}
        {data.currentStage !== 'season' && currentStageInfo && (
          <ListItemButton onClick={() => navigateAndClose(currentStageInfo.path)}>
            <ListItemText primary={`Open ${currentStageInfo.label}`} />
          </ListItemButton>
        )}
        <ListItemButton onClick={() => navigateAndClose('/')}>
          <ListItemIcon>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary="Home" />
        </ListItemButton>
      </List>
    </Drawer>
  );
};

export default MobileNavigationDrawer;
