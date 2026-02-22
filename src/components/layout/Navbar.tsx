import {
  AppBar,
  Toolbar,
  Button,
  Stack,
  Typography,
  Box,
  Menu,
  MenuItem,
  Divider,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import { useState } from 'react';
import { TeamLogo } from '../team/TeamComponents';
import SeasonBanner from './SeasonBanner';
import NonSeasonBanner from './NonSeasonBanner';
import { STAGES } from '../../constants/stages';
import GameSelectionModal from '../sim/GameSelectionModal';
import GameSimModal from '../sim/GameSimModal';
import type { NavbarProps } from '../../types/components';

type NavMenu = {
  id: string;
  label: string;
  items: Array<{ label: string; path: string }>;
};

const Navbar = ({ team, currentStage, info, conferences }: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentStageInfo = STAGES.find(stage => stage.id === currentStage);
  const nextStageInfo = STAGES.find(stage => stage.id === currentStageInfo?.next);
  const [menuAnchors, setMenuAnchors] = useState<Record<string, HTMLElement | null>>({});
  const [gameSelectionOpen, setGameSelectionOpen] = useState(false);
  const [liveSimOpen, setLiveSimOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedIsUserGame, setSelectedIsUserGame] = useState(false);

  const primaryColor = info.colorPrimary || team.colorPrimary || '#1976d2';
  const secondaryColor = info.colorSecondary || team.colorSecondary || '#ffffff';

  const navMenus: NavMenu[] = [
    {
      id: 'team',
      label: 'Team',
      items: [
        { label: 'Schedule', path: `/${team.name}/schedule` },
        { label: 'Roster', path: `/${team.name}/roster` },
        { label: 'History', path: `/${team.name}/history` },
      ],
    },
    {
      id: 'conferences',
      label: 'Conference Standings',
      items: [
        ...conferences.map(conf => ({
          label: conf.confName,
          path: `/standings/${conf.confName}`,
        })),
        { label: 'Independent', path: '/standings/independent' },
      ],
    },
    {
      id: 'stats',
      label: 'Stats',
      items: [
        { label: 'Team', path: '/stats/team' },
        { label: 'Individual', path: '/stats/individual' },
        { label: 'Ratings', path: '/stats/ratings' },
        { label: 'Awards', path: '/awards' },
      ],
    },
    {
      id: 'schedule',
      label: 'Schedule',
      items: Array.from({ length: info.lastWeek }, (_, index) => ({
        label: `Week ${index + 1}`,
        path: `/schedule/${index + 1}`,
      })),
    },
  ];

  const baseNavButtonSx = {
    px: 1.5,
    py: 1,
    borderRadius: 1.5,
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: '0.01em',
    minWidth: 'auto',
  } as const;

  const getNavButtonSx = (active: boolean) => ({
    ...baseNavButtonSx,
    color: active ? primaryColor : 'text.primary',
    backgroundColor: active ? `${primaryColor}1A` : 'transparent',
    boxShadow: active ? `inset 0 -2px 0 ${primaryColor}` : 'none',
    '&:hover': {
      backgroundColor: `${primaryColor}12`,
    },
  });

  const normalizePath = (path: string) => {
    const decoded = decodeURIComponent(path);
    const trimmed = decoded.endsWith('/') && decoded.length > 1
      ? decoded.slice(0, -1)
      : decoded;
    return trimmed.toLowerCase();
  };

  const currentPath = normalizePath(location.pathname);

  const isActivePath = (path: string) => {
    const targetPath = normalizePath(path);
    return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
  };

  const isAnyPathActive = (paths: string[]) => paths.some(path => isActivePath(path));

  const handleMenuOpen = (menuId: string) => (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchors(prev => ({ ...prev, [menuId]: event.currentTarget }));
  };

  const handleMenuClose = (menuId: string) => () => {
    setMenuAnchors(prev => ({ ...prev, [menuId]: null }));
  };

  const handleMenuClick = (path: string, menuId: string) => () => {
    navigate(path);
    handleMenuClose(menuId)();
  };

  const handleLiveSimClick = () => {
    setGameSelectionOpen(true);
  };

  const handleGameSelect = (gameId: number, isUserGame: boolean) => {
    setSelectedGameId(gameId);
    setSelectedIsUserGame(isUserGame);
    setLiveSimOpen(true);
  };

  const handleLiveSimClose = () => {
    setLiveSimOpen(false);
    setSelectedGameId(null);
    setSelectedIsUserGame(false);
    window.location.reload();
  };

  return (
    <>
      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{
          mb: 3,
          backgroundColor: 'white',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar
          sx={{
            minHeight: '76px !important',
            px: { xs: 2, lg: 3 },
            gap: 2,
            borderTop: `2px solid ${primaryColor}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 190,
              flexShrink: 0,
            }}
          >
            <TeamLogo name={team.name} size={42} />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                maxWidth: 130,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={team.name}
            >
              {team.name}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={0.25}
            sx={{
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
            }}
          >
            {currentStage === 'season' && (
              <Button
                color="inherit"
                onClick={() => navigate('/dashboard')}
                sx={getNavButtonSx(isActivePath('/dashboard') || currentPath === '/')}
              >
                Dashboard
              </Button>
            )}

            {navMenus.map(menu => {
              const active = isAnyPathActive(menu.items.map(item => item.path));
              return (
                <Box key={menu.id}>
                  <Button
                    color="inherit"
                    onClick={handleMenuOpen(menu.id)}
                    sx={getNavButtonSx(active)}
                  >
                    {menu.label}
                  </Button>
                  <Menu
                    anchorEl={menuAnchors[menu.id]}
                    open={Boolean(menuAnchors[menu.id])}
                    onClose={handleMenuClose(menu.id)}
                    PaperProps={{
                      elevation: 3,
                      sx: {
                        mt: 1,
                        borderRadius: 2,
                        minWidth: 170,
                      },
                    }}
                  >
                    {menu.items.map(item => (
                      <MenuItem
                        key={`${menu.id}:${item.path}`}
                        onClick={handleMenuClick(item.path, menu.id)}
                        sx={{
                          py: 1.1,
                          px: 2,
                          fontSize: '0.92rem',
                          '&:hover': {
                            backgroundColor: `${primaryColor}12`,
                          },
                        }}
                      >
                        {item.label}
                      </MenuItem>
                    ))}
                  </Menu>
                </Box>
              );
            })}

            <Button
              color="inherit"
              onClick={() => navigate('/rankings')}
              sx={getNavButtonSx(isActivePath('/rankings'))}
            >
              Rankings
            </Button>

            <Button
              color="inherit"
              onClick={() => navigate('/playoff')}
              sx={getNavButtonSx(isActivePath('/playoff'))}
            >
              Playoff
            </Button>
          </Stack>

          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                px: 1.5,
                py: 0.65,
                borderRadius: 2,
                border: '1px solid',
                borderColor: `${primaryColor}30`,
                backgroundColor: `${primaryColor}08`,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1 }}>
                {info.currentYear}
              </Typography>
              <Chip
                label={currentStageInfo?.banner_label || ''}
                size="small"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: primaryColor,
                  backgroundColor: `${primaryColor}1A`,
                  height: 24,
                }}
              />
            </Stack>

            {currentStage === 'season' ? (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  px: 1.1,
                  py: 0.45,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: `${primaryColor}26`,
                }}
              >
                <SeasonBanner
                  info={info}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                />
                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
                <Button
                  variant="outlined"
                  onClick={handleLiveSimClick}
                  sx={{
                    px: 1.9,
                    py: 0.55,
                    minWidth: 'auto',
                    textTransform: 'none',
                    borderRadius: 1.4,
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    color: primaryColor,
                    borderColor: primaryColor,
                    '&:hover': {
                      backgroundColor: `${primaryColor}10`,
                      borderColor: primaryColor,
                    },
                  }}
                >
                  Live Sim
                </Button>
              </Stack>
            ) : (
              currentStageInfo && nextStageInfo && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    px: 1.1,
                    py: 0.45,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: `${primaryColor}26`,
                  }}
                >
                  <NonSeasonBanner
                    currentStage={currentStageInfo}
                    nextStage={nextStageInfo}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                  />
                </Stack>
              )
            )}

            <Stack direction="row" spacing={0.2} alignItems="center">
              <Tooltip title="Settings">
                <IconButton onClick={() => navigate('/settings')} sx={{ color: 'text.secondary' }}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Home">
                <IconButton onClick={() => navigate('/')} sx={{ color: 'text.secondary' }}>
                  <HomeIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <GameSelectionModal
        open={gameSelectionOpen}
        onClose={() => setGameSelectionOpen(false)}
        onGameSelect={handleGameSelect}
      />
      <GameSimModal
        open={liveSimOpen}
        onClose={handleLiveSimClose}
        gameId={selectedGameId}
        isUserGame={selectedIsUserGame}
      />
    </>
  );
};

export default Navbar;
