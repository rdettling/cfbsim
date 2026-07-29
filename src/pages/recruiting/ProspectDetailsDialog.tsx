import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { RecruitingPageData } from '../../types/pages';

type Prospect = RecruitingPageData['prospects'][number];

interface ProspectDetailsDialogProps {
  open: boolean;
  prospect: Prospect | null;
  commitmentThreshold: number;
  boardCount: number;
  boardLimit: number;
  editable: boolean;
  busy: boolean;
  onClose: () => void;
  onChangeBoard: (prospectId: number, add: boolean) => void;
}

const unavailableReason = (
  prospect: Prospect,
  boardCount: number,
  boardLimit: number,
  editable: boolean,
) => {
  if (!editable) return 'Board changes are unavailable after week six.';
  if (prospect.commitment) {
    return `Committed to ${prospect.commitment.teamName}.`;
  }
  if (!prospect.canAcceptCommitment) {
    return 'Your current class cannot accept this position.';
  }
  if (boardCount >= boardLimit) {
    return `Your board is full (${boardLimit} prospects).`;
  }
  return null;
};

export const ProspectDetailsDialog = ({
  open,
  prospect,
  commitmentThreshold,
  boardCount,
  boardLimit,
  editable,
  busy,
  onClose,
  onChangeBoard,
}: ProspectDetailsDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  if (!prospect) return null;

  const preferences = [
    ['Prestige', prospect.preferenceWeights.prestige],
    ['Proximity', prospect.preferenceWeights.proximity],
    ['Playing Time', prospect.preferenceWeights.playingTime],
    ['Recent Success', prospect.preferenceWeights.recentSuccess],
  ] as const;
  const reason = prospect.onUserBoard
    ? editable
      ? null
      : 'Board changes are unavailable after week six.'
    : unavailableReason(prospect, boardCount, boardLimit, editable);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby="prospect-details-title"
      slotProps={{
        paper: { sx: { height: { sm: 'min(760px, 88vh)' } } },
      }}
    >
      <DialogTitle id="prospect-details-title">
        #{prospect.nationalRank} {prospect.first} {prospect.last}
        <Typography
          component="div"
          variant="body2"
          sx={{ color: 'text.secondary', mt: 0.25 }}
        >
          {prospect.position.toUpperCase()} · {prospect.stars}★ ·{' '}
          {prospect.state}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}
          >
            <Chip label={`Your fit ${Math.round(prospect.userFit)}`} />
            {prospect.commitment ? (
              <Chip
                label={`Committed: ${prospect.commitment.teamName}`}
                color="success"
              />
            ) : prospect.leaderTeamId ? (
              <Chip
                label={`Leader interest ${prospect.leaderInterest.toFixed(1)}`}
                color="primary"
                variant="outlined"
              />
            ) : (
              <Chip label="No eligible leader" variant="outlined" />
            )}
          </Stack>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Leader threshold progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(
              100,
              (prospect.leaderInterest / commitmentThreshold) * 100,
            )}
            aria-label="Leader threshold progress"
            sx={{ my: 0.75 }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {prospect.commitmentThresholdRemaining.toFixed(1)} interest and{' '}
            {prospect.commitmentLeadRemaining.toFixed(1)} lead still required
          </Typography>
        </Box>

        <Box
          component="section"
          aria-labelledby="prospect-preferences-title"
          sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Typography
            id="prospect-preferences-title"
            component="h3"
            variant="subtitle1"
            sx={{ fontWeight: 700, mb: 1 }}
          >
            Preferences
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {preferences.map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {value}%
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Box component="section" aria-labelledby="prospect-interest-title">
          <Typography
            id="prospect-interest-title"
            component="h3"
            variant="subtitle1"
            sx={{ fontWeight: 700, px: 2, pt: 2 }}
          >
            Interest standings
          </Typography>
          <TableContainer>
            <Table stickyHeader size="small" aria-label="Prospect interest standings">
              <TableHead>
                <TableRow>
                  <TableCell>Team</TableCell>
                  <TableCell align="right">Interest</TableCell>
                  <TableCell align="right">Points</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prospect.standings.map(standing => (
                  <TableRow key={standing.teamId}>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: standing.leader ? 700 : 400 }}
                      >
                        {standing.teamName}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}
                      >
                        {standing.leader
                          ? 'Eligible leader'
                          : standing.meaningful
                            ? standing.offerActive
                              ? 'Meaningful pursuit'
                              : 'Offer withdrawn'
                            : standing.offerActive
                              ? 'Offer active'
                              : 'Initial interest'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {standing.totalInterest.toFixed(1)}
                    </TableCell>
                    <TableCell align="right">
                      {standing.lifetimePoints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {prospect.standings.length === 0 && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2">
                No team interest has been recorded.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ alignItems: 'center' }}>
        {reason && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mr: 'auto', pl: 1 }}
          >
            {reason}
          </Typography>
        )}
        {prospect.onUserBoard ? (
          <Button
            color="error"
            onClick={() => onChangeBoard(prospect.id, false)}
            disabled={busy || !editable}
          >
            Remove from Board
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => onChangeBoard(prospect.id, true)}
            disabled={busy || Boolean(reason) || !prospect.canAdd}
          >
            Add to Board
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
