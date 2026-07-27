import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type {
  ConferenceChange,
  ConferenceStructurePolicy,
} from '../../types/domain';
import { TeamLogo } from '../../components/team/TeamComponents';

interface ConferencePreviewPanelProps {
  changes: ConferenceChange[];
  policy: ConferenceStructurePolicy;
}

export const ConferencePreviewPanel = ({
  changes,
  policy,
}: ConferencePreviewPanelProps) => (
  <Paper
    variant="outlined"
    sx={{
      p: { xs: 2, md: 2.5 },
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}
  >
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="flex-start"
      spacing={1}
      sx={{ mb: 1.5 }}
    >
      <Box>
        <Typography component="h2" variant="h6">
          Conference preview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Historical membership changes for the upcoming season.
        </Typography>
      </Box>
      <Chip
        size="small"
        color={policy === 'historical' ? 'success' : 'default'}
        label={policy === 'historical' ? 'Will apply' : 'Not selected'}
      />
    </Stack>

    {changes.length === 0 ? (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2">No conference changes</Typography>
        <Typography variant="caption" color="text.secondary">
          The resolved historical membership matches the current league.
        </Typography>
      </Box>
    ) : (
      <Stack
        spacing={0}
        sx={{
          minHeight: 0,
          overflowY: 'auto',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {changes.map(change => (
          <Stack
            key={change.teamName}
            direction="row"
            alignItems="center"
            spacing={1.25}
            sx={{
              py: 1.1,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <TeamLogo name={change.teamName} size={28} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {change.teamName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {change.fromConference} → {change.toConference}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    )}
  </Paper>
);
