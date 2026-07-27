import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import type { HistoricalDataResolution } from '../../types/domain';

interface NextSeasonHeaderProps {
  targetYear: number;
  dataSource?: HistoricalDataResolution;
  previewError: string | null;
}

export const NextSeasonHeader = ({
  targetYear,
  dataSource,
  previewError,
}: NextSeasonHeaderProps) => (
  <Box sx={{ mb: 1.5 }}>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ sm: 'center' }}
      justifyContent="space-between"
      spacing={1}
    >
      <Box>
        <Typography component="h1" variant="h4">
          Next Season Setup
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Choose the conference structure and postseason format for {targetYear}.
        </Typography>
      </Box>
      {dataSource && (
        <Chip
          color={dataSource.resolution === 'fallback' ? 'warning' : 'default'}
          variant="outlined"
          label={
            dataSource.resolution === 'exact'
              ? `Historical source: ${dataSource.sourceYear}`
              : `Using ${dataSource.sourceYear} for ${dataSource.targetYear}`
          }
        />
      )}
    </Stack>
    {dataSource?.atHistoricalFrontier && (
      <Alert severity="info" sx={{ mt: 1 }}>
        {targetYear} is beyond the bundled history. The newest available
        structure from {dataSource.sourceYear} will be reused.
      </Alert>
    )}
    {previewError && (
      <Alert severity="error" sx={{ mt: 1 }}>
        {previewError} Advancement is unavailable until this data can be loaded.
      </Alert>
    )}
  </Box>
);
