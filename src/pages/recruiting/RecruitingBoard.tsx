import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { RecruitingPageData } from '../../types/pages';
import { RecruitingBoardRow } from './RecruitingBoardRow';

type Prospect = RecruitingPageData['prospects'][number];

interface RecruitingBoardProps {
  prospects: Prospect[];
  allocations: Record<number, number>;
  pointBudget: number;
  perProspectCap: number;
  userTeamId: number;
  meaningfulPursuitPoints: number;
  positionNeeds: NonNullable<
    RecruitingPageData['userRecruiting']
  >['positions'];
  busy: boolean;
  editable: boolean;
  onSelect: (prospectId: number) => void;
  onAllocationChange: (prospectId: number, points: number) => void;
  onRemove: (prospectId: number) => void;
  onAddRecruits: () => void;
  onClear: () => void;
  advanceLabel: string;
  advanceDisabled: boolean;
  onAdvance: () => void;
}

export const RecruitingBoard = ({
  prospects,
  allocations,
  pointBudget,
  perProspectCap,
  userTeamId,
  meaningfulPursuitPoints,
  positionNeeds,
  busy,
  editable,
  onSelect,
  onAllocationChange,
  onRemove,
  onAddRecruits,
  onClear,
  advanceLabel,
  advanceDisabled,
  onAdvance,
}: RecruitingBoardProps) => {
  const allocated = Object.values(allocations).reduce(
    (total, points) => total + points,
    0,
  );

  return (
    <Paper
      component="section"
      aria-labelledby="recruiting-board-title"
      variant="outlined"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1.1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography id="recruiting-board-title" component="h2" variant="h6">
            My Board
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Your minimums: {allocated} · AI can assign up to{' '}
            {Math.max(0, pointBudget - allocated)}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={onAddRecruits}
          disabled={!editable || busy}
        >
          Add Recruits
        </Button>
      </Stack>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          px: 1.25,
          py: 0.9,
          flexWrap: 'wrap',
          rowGap: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {positionNeeds
          .filter(need => need.softDeficit > 0 || need.starterShortage > 0)
          .map(need => (
            <Chip
              key={need.position}
              size="small"
              color={need.starterShortage > 0 ? 'warning' : 'default'}
              variant="outlined"
              label={`${need.position.toUpperCase()} ${need.projected}/${need.softTarget}`}
            />
          ))}
      </Stack>
      {prospects.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Start your recruiting board
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            Add prospects, assign any points you want to control, and let AI
            handle the rest.
          </Typography>
          <Button
            variant="contained"
            onClick={onAddRecruits}
            disabled={!editable || busy}
          >
            Add Recruits
          </Button>
        </Box>
      ) : (
        <Stack sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {prospects.map((prospect, index) => {
            const points = allocations[prospect.id] ?? 0;
            const maximum = Math.min(
              perProspectCap,
              pointBudget - allocated + points,
            );
            return (
              <RecruitingBoardRow
                key={prospect.id}
                prospect={prospect}
                points={points}
                maximum={maximum}
                userTeamId={userTeamId}
                meaningfulPursuitPoints={meaningfulPursuitPoints}
                editable={editable}
                busy={busy}
                last={index === prospects.length - 1}
                onSelect={() => onSelect(prospect.id)}
                onAllocationChange={value =>
                  onAllocationChange(prospect.id, value)
                }
                onRemove={() => onRemove(prospect.id)}
              />
            );
          })}
        </Stack>
      )}
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1.25,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Weekly cap: {perProspectCap} per recruit
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            onClick={onClear}
            disabled={!editable || busy || allocated === 0}
          >
            Clear Points
          </Button>
          <Button
            variant="contained"
            onClick={onAdvance}
            disabled={advanceDisabled}
          >
            {advanceLabel}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
