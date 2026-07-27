import { Box, Chip, Stack, Typography } from '@mui/material';

type PostseasonHeaderProps = {
  year: number;
  week: number;
  format: number;
  autobids: number;
  conferenceChampByes: boolean;
  isProjection: boolean;
};

export const PostseasonHeader = ({
  year,
  week,
  format,
  autobids,
  conferenceChampByes,
  isProjection,
}: PostseasonHeaderProps) => (
  <Stack
    component="header"
    direction={{ xs: 'column', md: 'row' }}
    alignItems={{ xs: 'flex-start', md: 'center' }}
    justifyContent="space-between"
    spacing={1.5}
    sx={{ mb: 1.25, flexShrink: 0 }}
  >
    <Box>
      <Typography component="h1" variant="h4">
        Postseason Hub
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {year} season · Week {week} · {isProjection ? 'Projected field' : 'Postseason field'}
      </Typography>
    </Box>
    <Stack
      direction="row"
      spacing={0.75}
      useFlexGap
      flexWrap="wrap"
      aria-label="Playoff settings"
    >
      <Chip label={`${format}-team playoff`} size="small" variant="outlined" />
      {format === 12 && (
        <>
          <Chip label={`${autobids} autobids`} size="small" variant="outlined" />
          <Chip
            label={conferenceChampByes ? 'Top 4 champions receive byes' : 'Top 4 teams receive byes'}
            size="small"
            variant="outlined"
          />
        </>
      )}
    </Stack>
  </Stack>
);
