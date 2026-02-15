import { AppBar, Toolbar, Button, Stack, Box, Chip, Menu, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Team, Info, Conference } from '../domain/types';
import { TeamLogo } from './TeamComponents';
import { ROUTES } from '../constants/routes';
import { useState } from 'react';

interface NavbarProps {
  team?: Team | null;
  info?: Info | null;
  conferences?: Conference[];
}

const Navbar = ({ team, info, conferences = [] }: NavbarProps) => {
  const navigate = useNavigate();
  const [menuAnchors, setMenuAnchors] = useState<Record<string, HTMLElement | null>>({});

  const primaryColor = info?.colorPrimary || team?.colorPrimary || '#1976d2';
  const secondaryColor = info?.colorSecondary || team?.colorSecondary || '#ffffff';

  const handleMenuOpen = (menu: string) => (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchors({ ...menuAnchors, [menu]: event.currentTarget });
  };

  const handleMenuClose = (menu: string) => () => {
    setMenuAnchors({ ...menuAnchors, [menu]: null });
  };

  const handleMenuClick = (path: string, menu: string) => () => {
    navigate(path);
    handleMenuClose(menu)();
  };

  const dropdownMenus = [
    {
      id: 'team',
      label: 'TEAM',
      items: team
        ? [
            { label: 'Schedule', path: `/${team.name}/schedule` },
            { label: 'Roster', path: `/${team.name}/roster` },
            { label: 'History', path: `/${team.name}/history` },
          ]
        : [],
    },
    {
      id: 'conferences',
      label: 'CONFERENCE STANDINGS',
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
      label: 'STATS',
      items: [
        { label: 'Team', path: '/stats/team' },
        { label: 'Individual', path: '/stats/individual' },
        { label: 'Ratings', path: '/stats/ratings' },
        { label: 'Awards', path: '/awards' },
      ],
    },
    {
      id: 'schedule',
      label: 'SCHEDULE',
      items: Array.from({ length: info?.lastWeek ?? 14 }, (_, i) => ({
        label: `Week ${i + 1}`,
        path: `/schedule/${i + 1}`,
      })),
    },
  ];

  return (
    <AppBar
      position="static"
      color="default"
      elevation={2}
      sx={{
        mb: 3,
        backgroundColor: 'white',
        borderTop: `3px solid ${primaryColor}`,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ py: 1, minHeight: '64px !important' }}>
        {team && (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
            <TeamLogo name={team.name} size={40} />
          </Box>
        )}

        <Stack direction="row" spacing={0} sx={{ flex: 1 }}>
          <Button
            color="inherit"
            onClick={() => navigate(ROUTES.HOME)}
            sx={{
              px: 2,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: `${primaryColor}15`,
              },
            }}
          >
            HOME
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate(ROUTES.NONCON)}
            sx={{
              px: 2,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: `${primaryColor}15`,
              },
            }}
          >
            NON-CON
          </Button>

          {dropdownMenus.map(menu => (
            <div key={menu.id}>
              <Button
                color="inherit"
                onClick={handleMenuOpen(menu.id)}
                sx={{
                  px: 2,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: 'text.primary',
                  '&:hover': {
                    backgroundColor: `${primaryColor}15`,
                  },
                }}
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
                    minWidth: 160,
                  },
                }}
              >
                {menu.items.map((item, index) => (
                  <MenuItem
                    key={`${menu.id}-${index}`}
                    onClick={handleMenuClick(item.path, menu.id)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      fontSize: '0.95rem',
                      '&:hover': {
                        backgroundColor: `${primaryColor}15`,
                      },
                    }}
                  >
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </div>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={{
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: `${primaryColor}15`,
              },
            }}
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/settings')}
            sx={{
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: `${primaryColor}15`,
              },
            }}
          >
            Settings
          </Button>
          {team && (
            <Chip
              label={team.name}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: primaryColor,
                color: secondaryColor,
              }}
            />
          )}
          {info?.stage && (
            <Chip
              label={`Stage: ${info.stage}`}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: `${primaryColor}15`,
              }}
            />
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
