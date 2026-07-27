import { Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { StageInfo } from './navigation';

interface NonSeasonBannerProps {
  currentStage: StageInfo;
  nextStage: StageInfo;
  compact?: boolean;
  advancing: boolean;
  disabled?: boolean;
  onAdvance: () => void;
}

const NonSeasonBanner = ({
  currentStage,
  nextStage,
  compact = false,
  advancing,
  disabled = false,
  onAdvance,
}: NonSeasonBannerProps) => {
  const navigate = useNavigate();

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
        onClick={onAdvance}
        disabled={advancing || disabled}
        sx={{
          flexShrink: 0,
          maxWidth: compact ? '58%' : 'none',
          lineHeight: 1.2,
          whiteSpace: compact ? 'normal' : 'nowrap',
        }}
      >
        {advancing ? 'Advancing…' : `Next: ${nextStage.label}`}
      </Button>
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
