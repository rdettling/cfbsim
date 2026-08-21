import { Box, Button, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { useId, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { advanceWeeks } from '../../domain/sim/orchestrator';
import type { Info } from '../../types/domain';
import LoadingDialog from '../sim/LoadingDialog';

interface SeasonBannerProps {
  info: Info;
  compact?: boolean;
}

const SeasonBanner = ({ info, compact = false }: SeasonBannerProps) => {
  const navigate = useNavigate();
  const menuId = useId();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isEndOfSeason = info.currentWeek > info.lastWeek;

  const handleEndOfSeason = () => {
    setSimulationMessage('Simulating to Season Summary');
    setIsSimulating(true);
    setTimeout(() => {
      navigate(ROUTES.SEASON_SUMMARY);
      setIsSimulating(false);
    }, 500);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isEndOfSeason) {
      handleEndOfSeason();
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleAdvance = async (destWeek: number) => {
    setAnchorEl(null);
    setSimulationMessage(`Simulating to Week ${destWeek}`);
    setIsSimulating(true);
    try {
      await advanceWeeks(destWeek);
      if (destWeek > info.lastWeek) {
        navigate(ROUTES.SEASON_SUMMARY);
      } else {
        window.dispatchEvent(new Event('pageDataRefresh'));
      }
    } catch (error) {
      console.error('Error simulating weeks:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const availableWeeks = Array.from(
    { length: info.lastWeek - info.currentWeek },
    (_, index) => info.currentWeek + index + 1,
  );
  const menuOpen = Boolean(anchorEl);

  return (
    <>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          alignItems: 'center',
        }}
      >
        {!compact && (
          <Box
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {isEndOfSeason ? 'Season Complete' : `Week ${info.currentWeek}`}
            </Typography>
          </Box>
        )}
        <Button
          variant="contained"
          size="small"
          onClick={handleClick}
          aria-controls={menuOpen ? menuId : undefined}
          aria-expanded={menuOpen ? 'true' : undefined}
          aria-haspopup={isEndOfSeason ? undefined : 'menu'}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {isEndOfSeason ? 'Season Summary' : 'Advance'}
        </Button>
        <Menu
          id={menuId}
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={() => setAnchorEl(null)}
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
          {availableWeeks.map((week) => (
            <MenuItem key={week} onClick={() => handleAdvance(week)}>
              Simulate to Week {week}
            </MenuItem>
          ))}
          <MenuItem
            onClick={() => handleAdvance(info.lastWeek + 1)}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          >
            End of Season
          </MenuItem>
        </Menu>
      </Stack>
      <LoadingDialog open={isSimulating} message={simulationMessage} />
    </>
  );
};

export default SeasonBanner;
