import {
  Box,
  Button,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  StageAdvanceAction,
  StageInfo,
} from './navigation';

interface NonSeasonBannerProps {
  currentStage: StageInfo;
  nextStage: StageInfo;
  compact?: boolean;
  advancing: boolean;
  disabled?: boolean;
  onAdvance: () => void;
  advanceActions?: StageAdvanceAction[];
  advanceLabel?: string;
}

const NonSeasonBanner = ({
  currentStage,
  nextStage,
  compact = false,
  advancing,
  disabled = false,
  onAdvance,
  advanceActions,
  advanceLabel,
}: NonSeasonBannerProps) => {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const hasMenu = Boolean(advanceActions?.length);

  const handleAdvanceClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (hasMenu) {
      setMenuAnchor(event.currentTarget);
    } else {
      onAdvance();
    }
  };

  return (
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
            {currentStage.label}
          </Typography>
        </Box>
      )}
      <Button
        variant="contained"
        size="small"
        onClick={handleAdvanceClick}
        disabled={advancing || disabled}
        endIcon={hasMenu ? <ArrowDropDownIcon /> : undefined}
        aria-haspopup={hasMenu ? 'menu' : undefined}
        aria-expanded={hasMenu ? Boolean(menuAnchor) : undefined}
        sx={{
          flexShrink: 0,
          maxWidth: compact ? '58%' : 'none',
          lineHeight: 1.2,
          whiteSpace: compact ? 'normal' : 'nowrap',
        }}
      >
        {advancing
          ? 'Advancing…'
          : advanceLabel ?? `Next: ${nextStage.label}`}
      </Button>
      {hasMenu && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          {advanceActions?.map(action => (
            <MenuItem
              key={action.label}
              disabled={action.disabled}
              onClick={() => {
                setMenuAnchor(null);
                action.onSelect();
              }}
            >
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      )}
      {!compact && (
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate(currentStage.path)}
          disabled={advancing}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Open {currentStage.label}
        </Button>
      )}
    </Stack>
  );
};

export default NonSeasonBanner;
