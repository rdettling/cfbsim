import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { RecruitingPageData } from '../../types/pages';

type Prospect = RecruitingPageData['prospects'][number];

const prospectStatus = (
  prospect: Prospect,
  userTeamId: number,
  meaningfulPursuitPoints: number,
) => {
  if (prospect.commitment?.teamId === userTeamId) {
    return { label: 'Signed', color: 'success' as const, detail: '' };
  }
  if (prospect.commitment) {
    return {
      label: 'Committed elsewhere',
      color: 'default' as const,
      detail: prospect.commitment.teamName,
    };
  }
  if (!prospect.canAcceptCommitment) {
    return {
      label: 'Roster constraint',
      color: 'warning' as const,
      detail: 'Your current class cannot accept this position.',
    };
  }
  const userStanding = prospect.standings.find(
    standing => standing.teamId === userTeamId,
  );
  if ((userStanding?.lifetimePoints ?? 0) < meaningfulPursuitPoints) {
    return {
      label: 'Building interest',
      color: 'info' as const,
      detail: `${meaningfulPursuitPoints - (userStanding?.lifetimePoints ?? 0)} more lifetime points creates a meaningful pursuit.`,
    };
  }
  if (prospect.leaderTeamId === userTeamId) {
    return {
      label: 'Leading',
      color: 'success' as const,
      detail: `Lead margin ${prospect.leadMargin.toFixed(1)} interest.`,
    };
  }
  return {
    label: 'Trailing',
    color: 'warning' as const,
    detail: `Behind the leader by ${Math.max(0, prospect.leaderInterest - (userStanding?.totalInterest ?? 0)).toFixed(1)} interest.`,
  };
};

export const RecruitingBoardRow = ({
  prospect,
  points,
  maximum,
  userTeamId,
  meaningfulPursuitPoints,
  editable,
  busy,
  last,
  onSelect,
  onAllocationChange,
  onRemove,
}: {
  prospect: Prospect;
  points: number;
  maximum: number;
  userTeamId: number;
  meaningfulPursuitPoints: number;
  editable: boolean;
  busy: boolean;
  last: boolean;
  onSelect: () => void;
  onAllocationChange: (points: number) => void;
  onRemove: () => void;
}) => {
  const status = prospectStatus(
    prospect,
    userTeamId,
    meaningfulPursuitPoints,
  );
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        alignItems: { sm: 'center' },
        px: 1.5,
        py: 1,
        borderBottom: last ? 0 : '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onSelect}
        sx={{
          flex: 1,
          minWidth: 0,
          p: 0,
          border: 0,
          bgcolor: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          #{prospect.nationalRank} {prospect.first} {prospect.last}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {prospect.position.toUpperCase()} · {prospect.stars}★ · Fit{' '}
          {Math.round(prospect.userFit)}
        </Typography>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', mt: 0.35 }}
        >
          <Chip
            size="small"
            label={status.label}
            color={status.color}
            variant="outlined"
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {status.detail}
          </Typography>
        </Stack>
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          type="number"
          label="Points"
          value={points}
          onChange={event => onAllocationChange(Number(event.target.value))}
          disabled={!editable || busy}
          slotProps={{
            htmlInput: {
              min: 0,
              max: maximum,
              step: 1,
              'aria-label': `Exact points for ${prospect.first} ${prospect.last}`,
            },
          }}
          sx={{ width: 92 }}
        />
        <Button
          size="small"
          onClick={() => onAllocationChange(maximum)}
          disabled={!editable || busy || points >= maximum}
        >
          Max
        </Button>
        <Button
          size="small"
          color="error"
          onClick={onRemove}
          disabled={!editable || busy}
          aria-label={`Remove ${prospect.first} ${prospect.last} from board`}
        >
          Remove
        </Button>
      </Stack>
    </Stack>
  );
};
