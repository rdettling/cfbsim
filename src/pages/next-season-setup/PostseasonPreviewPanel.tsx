import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import type {
  NextSeasonConfiguration,
  NextSeasonPreview,
} from '../../types/domain';

interface PostseasonPreviewPanelProps {
  configuration: NextSeasonConfiguration;
  preview: NextSeasonPreview;
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

export const PostseasonPreviewPanel = ({
  configuration,
  preview,
}: PostseasonPreviewPanelProps) => {
  const historical = preview.historicalPostseason;
  const historicalSelected = configuration.postseasonPolicy === 'historical';
  const rows = [
    {
      label: 'Playoff teams',
      current: String(configuration.playoffTeams),
      historical: String(historical.playoffTeams),
    },
    {
      label: 'Automatic bids',
      current: String(configuration.playoffAutobids ?? 0),
      historical: String(historical.playoffAutobids),
    },
    {
      label: 'Champion top seeds',
      current: yesNo(
        configuration.conferenceChampionsReceiveTopSeeds ?? false,
      ),
      historical: yesNo(
        historical.conferenceChampionsReceiveTopSeeds,
      ),
    },
  ];
  const changedRows = rows.filter(row => row.current !== row.historical);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 },
        height: '100%',
        overflowY: 'auto',
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
            Postseason preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Compare your current format with the historical source.
          </Typography>
        </Box>
        <Chip
          size="small"
          color={historicalSelected ? 'success' : 'default'}
          label={historicalSelected ? 'Will apply' : 'Custom selected'}
        />
      </Stack>

      {!historicalSelected && (
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: 1,
            backgroundColor: 'action.hover',
          }}
        >
          <Typography variant="overline" color="text.secondary">
            Effective custom format
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {configuration.playoffTeams} teams
            {configuration.playoffTeams === 12
              ? ` · ${configuration.playoffAutobids ?? 0} autobids · champion top seeds ${yesNo(
                  configuration.conferenceChampionsReceiveTopSeeds ?? false,
                ).toLowerCase()}`
              : ''}
          </Typography>
        </Box>
      )}

      {changedRows.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2">No postseason changes</Typography>
          <Typography variant="caption" color="text.secondary">
            The historical format matches the current configuration.
          </Typography>
        </Box>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {changedRows.map(row => (
            <Stack
              key={row.label}
              direction="row"
              justifyContent="space-between"
              spacing={2}
              sx={{ py: 1.25 }}
            >
              <Typography variant="body2">{row.label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {row.current} → {row.historical}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
};
